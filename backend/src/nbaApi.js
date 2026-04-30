// Load environment variables from .env into process.env before anything else.
require("dotenv").config();

const axios = require('axios');

// Base URL for all NBA Stats API endpoints.
const NBA_URL = 'https://stats.nba.com/stats';

// The current NBA season. Used as the default parameter for all API functions
// so callers don't need to pass it explicitly in the common case.
// Update this constant at the start of each new season.
const CURRENT_SEASON = '2025-26';

// Custom HTTP headers required to avoid being blocked by stats.nba.com.
// The NBA API has progressive anti-scraping protections that reject requests
// that don't look like they came from a real browser navigating nba.com.
//
// Key headers and why each is needed:
//   User-Agent        — must be a full browser string; bare "Mozilla/5.0" is
//                       trivially detected as a bot and returns a cached 500.
//   x-nba-stats-origin / x-nba-stats-token — internal headers the NBA's own
//                       frontend sends on every stats request; their CDN (Varnish)
//                       now checks for these and rejects requests that omit them.
//   Referer / Origin  — must point to nba.com so the CORS/referrer check passes.
//   Accept-Language   — a real browser always sends this; its absence is a
//                       common bot-detection signal.
const NBA_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token':  'true',
  Referer:         'https://www.nba.com/',
  Origin:          'https://www.nba.com',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Insead of hard coding "current season" we have this function to get current season
function getCurrentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = Jan, 9 = Oct

  if (month >= 9) {
    // October–December → new season
    const nextYear = (year + 1).toString().slice(-2);
    return `${year}-${nextYear}`;
  } else {
    // January–September → still previous season
    const prevYear = year - 1;
    const nextYear = year.toString().slice(-2);
    return `${prevYear}-${nextYear}`;
  }
}

const CURRENT_SEASON = getCurrentSeason();

// Insead of hard coding "current season" we have this function to get current season
function getCurrentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = Jan, 9 = Oct

  if (month >= 9) {
    // October–December → new season
    const nextYear = (year + 1).toString().slice(-2);
    return `${year}-${nextYear}`;
  } else {
    // January–September → still previous season
    const prevYear = year - 1;
    const nextYear = year.toString().slice(-2);
    return `${prevYear}-${nextYear}`;
  }
}

const CURRENT_SEASON = getCurrentSeason();

// Core HTTP helper — sends a GET request to the NBA Stats API.
// All other functions in this module call nbaGet() rather than axios directly,
// keeping the header spoofing and base URL in one place.
async function nbaGet(path, params = {}) {
   const response = await axios.get(`${NBA_URL}/${path}`, {
    params, headers: NBA_HEADERS,
   });
   return response.data;
}

// ── Level 1: Static / roster data ───────────────────────────────────────────
// These functions fetch data that rarely changes during a season (team rosters,
// player identities, career histories). They are used by the one-time setup
// scripts (syncTeamNbaIds.js and enrichPlayers.js) and the existing API routes.

// Returns every NBA player, optionally filtered to only active-roster players.
// isOnlyCurrentSeason = '1' limits results to players on a current roster;
// '0' includes all-time players (used by the /api/players route for search).
async function getPlayers(isOnlyCurrentSeason = '1') {
  return nbaGet('commonallplayers', {
    IsOnlyCurrentSeason: isOnlyCurrentSeason,
    LeagueID: '00',
    Season: CURRENT_SEASON,
  });
}

// Returns a single player's career statistics broken out by season.
// Used by the existing /api/players/:playerId/career route.
async function getPlayerCareerStats(playerId) {
  return nbaGet('playercareerstats', {
    PlayerID: playerId,
    PerMode: 'PerGame',
  });
}

// --- NEW FUNCTION ---
// Returns detailed profile information for a single player from the
// commonplayerinfo endpoint. Used by enrichPlayers.js to fill in fields
// that commonallplayers doesn't provide: height, weight, birthDate,
// country, draftYear, draftPick, and jersey number.
// Called once per player during the enrichment script, with a 600ms
// delay between calls to avoid rate-limiting from stats.nba.com.
async function getPlayerInfo(nbaPlayerId) {
  return nbaGet('commonplayerinfo', {
    PlayerID: nbaPlayerId,
    LeagueID: '00',
  });
}

// ── Multi-season-type helper ──────────────────────────────────────────────────

/**
 * Fetches data for both 'Regular Season' and 'Playoffs' in parallel, then
 * merges the result sets into a single synthetic API response. This allows all
 * downstream code to treat regular season and playoff stats as one combined
 * dataset without any awareness of the distinction.
 *
 * Two merge strategies are supported:
 *
 *   Concatenation (mergeById = null):
 *     Used for game logs. A game belongs to exactly one season type, so rows
 *     from both calls can simply be concatenated — there are no duplicates.
 *     nightlySync.js deduplicates further via the (teamId/playerId, nbaGameId)
 *     compound unique index, so re-running is always safe.
 *
 *   Sum by ID (mergeById = field name):
 *     Used for season totals. The same team or player appears once per season
 *     type they participated in. Rows with the same ID value are merged by
 *     summing all numeric fields, producing a single combined row. Percentage
 *     fields (FG_PCT etc.) are also summed here but are discarded — callers
 *     always recompute them via safePct() from the summed makes/attempts totals.
 *
 * If one season type fails (e.g. Regular Season aggregate endpoint returns 500
 * after the season ends), the successful result is used alone rather than
 * throwing. Only if both fail is an error raised.
 *
 * @param {string}      endpoint   - NBA Stats API endpoint (e.g. 'leaguegamelog')
 * @param {Object}      paramsBase - Query params WITHOUT SeasonType (added internally)
 * @param {string}      rsName     - Expected resultSet name (e.g. 'LeagueGameLog')
 * @param {string|null} mergeById  - Header field to merge rows by, or null to concatenate
 * @returns {Object} Synthetic API response: { resultSets: [mergedResultSet] }
 */
async function fetchBothSeasonTypes(endpoint, paramsBase, rsName, mergeById = null) {
  // Fire both season type requests in parallel; use allSettled so one failure
  // doesn't prevent the other from completing.
  const [regularResult, playoffResult] = await Promise.allSettled([
    nbaGet(endpoint, { ...paramsBase, SeasonType: 'Regular Season' }),
    nbaGet(endpoint, { ...paramsBase, SeasonType: 'Playoffs' }),
  ]);

  // Extract the target result set from each successful response.
  const resultSets = [regularResult, playoffResult]
    .filter((r) => r.status === 'fulfilled')
    .map((r) => {
      const data = r.value;
      return data.resultSets?.find((s) => s.name === rsName) ?? data.resultSets?.[0];
    })
    .filter(Boolean);

  if (resultSets.length === 0) {
    throw new Error(`Both Regular Season and Playoffs requests failed for ${endpoint}`);
  }

  // Only one season type succeeded — no merging needed, return as-is.
  if (resultSets.length === 1) {
    return { resultSets };
  }

  let mergedResultSet;

  if (mergeById) {
    // Season totals strategy: merge rows for the same team/player by summing
    // all numeric fields. This correctly combines e.g. a team's 82-game regular
    // season totals with their 10-game playoff totals into one row.
    const headers = resultSets[0].headers;
    const idIndex = headers.indexOf(mergeById);
    const map     = new Map(); // id value → merged row array

    for (const rs of resultSets) {
      for (const row of rs.rowSet ?? []) {
        const id = row[idIndex];
        if (!map.has(id)) {
          // First time we've seen this team/player — copy the row as the base.
          map.set(id, [...row]);
        } else {
          // Already have an entry — add this row's numeric values to the existing ones.
          const existing = map.get(id);
          for (let i = 0; i < row.length; i++) {
            if (i !== idIndex && typeof row[i] === 'number' && typeof existing[i] === 'number') {
              existing[i] += row[i];
            }
          }
        }
      }
    }

    mergedResultSet = { ...resultSets[0], rowSet: [...map.values()] };
  } else {
    // Game log strategy: simple concatenation. Each game belongs to exactly one
    // season type, so there are no duplicate GAME_IDs across the two result sets.
    const rowSet = resultSets.flatMap((rs) => rs.rowSet ?? []);
    mergedResultSet = { ...resultSets[0], rowSet };
  }

  return { resultSets: [mergedResultSet] };
}

// ── Level 2: Season totals (first ingestion only) ────────────────────────────
// These functions are called once by seasonStatsService.js on the very first
// nightly sync to populate TeamSeasonStats and PlayerSeasonStats with accurate
// totals for every game played so far this season. After the baseline is set,
// only the incremental update functions in seasonStatsService.js are used.
//
// Both functions combine Regular Season and Playoffs totals into a single
// dataset so season stats reflect the full year, not just one phase.

// Returns combined Regular Season + Playoffs season TOTALS for all 30 teams.
// Key fields: TEAM_ID, TEAM_NAME, GP, W, L, PTS, REB, AST, STL, BLK, TOV,
// FGM, FGA, FG3M, FG3A, FTM, FTA. Percentage fields are recalculated by
// seasonStatsService.js from makes/attempts and are not used from this response.
// Note: leaguedashteamstats does NOT return TEAM_ABBREVIATION, so
// syncTeamNbaIds.js matches teams by TEAM_NAME instead.
async function getTeamSeasonTotals(season = CURRENT_SEASON) {
  const params = {
    Conference: '',
    DateFrom: '',
    DateTo: '',
    Division: '',
    GameScope: '',
    GameSegment: '',
    LastNGames: '0',
    LeagueID: '00',
    Location: '',
    MeasureType: 'Base',
    Month: '0',
    OpponentTeamID: '0',
    Outcome: '',
    PORound: '0',
    PaceAdjust: 'N',
    PerMode: 'Totals',
    Period: '0',
    PlayerExperience: '',
    PlayerPosition: '',
    PlusMinus: 'N',
    Rank: 'N',
    Season: season,
    ShotClockRange: '',
    StarterBench: '',
    TeamID: '0',
    TwoWay: '0',
    VsConference: '',
    VsDivision: '',
  };
  // Merge by TEAM_ID so each team has one combined row across both season types.
  return fetchBothSeasonTypes('leaguedashteamstats', params, 'LeagueDashTeamStats', 'TEAM_ID');
}

// Returns combined Regular Season + Playoffs season TOTALS for all active players.
// Key fields: PLAYER_ID, PLAYER_NAME, TEAM_ID, GP, MIN, PTS, REB, AST, STL,
// BLK, TOV, FGM, FGA, FG3M, FG3A, FTM, FTA.
// Merge by PLAYER_ID so each player has one combined row across both season types.
async function getPlayerSeasonTotals(season = CURRENT_SEASON) {
  const params = {
    College: '',
    Conference: '',
    Country: '',
    DateFrom: '',
    DateTo: '',
    Division: '',
    DraftPick: '',
    DraftYear: '',
    GameScope: '',
    GameSegment: '',
    Height: '',
    LastNGames: '0',
    LeagueID: '00',
    Location: '',
    MeasureType: 'Base',
    Month: '0',
    OpponentTeamID: '0',
    Outcome: '',
    PORound: '0',
    PaceAdjust: 'N',
    PerMode: 'Totals',
    Period: '0',
    PlayerExperience: '',
    PlayerPosition: '',
    PlusMinus: 'N',
    Rank: 'N',
    Season: season,
    SeasonSegment: '',
    ShotClockRange: '',
    StarterBench: '',
    TeamID: '0',
    TwoWay: '0',
    VsConference: '',
    VsDivision: '',
    Weight: '',
  };
  // Merge by PLAYER_ID so each player has one combined row across both season types.
  return fetchBothSeasonTypes('leaguedashplayerstats', params, 'LeagueDashPlayerStats', 'PLAYER_ID');
}

// ── Level 3: Per-game logs (nightly incremental sync) ────────────────────────
// These functions are called nightly by nightlySync.js to fetch every game
// played in the current season. The sync job compares the returned GAME_IDs
// against what is already stored in TeamGameStats/PlayerGameStats and inserts
// only the rows that are new, so re-running the sync is always safe.
//
// Both functions combine Regular Season and Playoffs game rows so the sync
// captures all games regardless of which phase of the season is active.

// Formats a Date object as the "MM/DD/YYYY" string that the NBA API's
// DateFrom / DateTo parameters expect.
function formatNbaDate(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

// Returns the DateFrom string for a rolling N-day lookback window ending today.
// Used by getTeamGameLog() and getPlayerGameLog() to limit results to recent
// games rather than fetching the entire season on every sync.
function rollingWindowStart(days = 14) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatNbaDate(date);
}

// Returns a row for every (team, game) combination within the past 14 days,
// combining both Regular Season and Playoffs games into one result set.
// PlayerOrTeam='T' selects the team-level game log.
// Key fields: GAME_ID, TEAM_ID, MATCHUP, GAME_DATE, WL, PTS, REB, AST,
// STL, BLK, TOV, FGM, FGA, FG3M, FG3A, FTM, FTA, PLUS_MINUS.
// MATCHUP format is "ABBR vs. ABBR" (home) or "ABBR @ ABBR" (away).
//
// The 14-day window matches the 2-week TTL on TeamGameStats documents —
// we never need box scores older than what MongoDB will auto-delete anyway.
async function getTeamGameLog(season = CURRENT_SEASON) {
  const params = {
    Counter: '0',
    DateFrom: rollingWindowStart(14), // only fetch the past 14 days
    DateTo:   '',                     // empty = through today
    Direction: 'DESC',                // most recent games first
    LeagueID: '00',
    PlayerOrTeam: 'T',               // T = team-level rows
    Season: season,
    Sorter: 'DATE',
  };
  // Concatenate rows from both season types — a game belongs to exactly one type
  // so there are no duplicate GAME_IDs to worry about.
  return fetchBothSeasonTypes('leaguegamelog', params, 'LeagueGameLog');
}

// Returns a row for every (player, game) combination within the past 14 days,
// combining both Regular Season and Playoffs games into one result set.
// PlayerOrTeam='P' selects the player-level game log.
// Same key fields as getTeamGameLog, plus PLAYER_ID and PLAYER_NAME.
// Minutes are returned in "MM:SS" format and converted to decimal by
// nightlySync.js before being stored.
async function getPlayerGameLog(season = CURRENT_SEASON) {
  const params = {
    Counter: '0',
    DateFrom: rollingWindowStart(14), // only fetch the past 14 days
    DateTo:   '',                     // empty = through today
    Direction: 'DESC',                // most recent games first
    LeagueID: '00',
    PlayerOrTeam: 'P',               // P = player-level rows
    Season: season,
    Sorter: 'DATE',
  };
  // Concatenate rows from both season types — same rationale as getTeamGameLog().
  return fetchBothSeasonTypes('leaguegamelog', params, 'LeagueGameLog');
}

// ── Legacy: per-game averages (existing /api/teams route) ───────────────────

// Returns per-game averages for all 30 teams. This is the original function
// used by the /api/teams route to serve live data to the frontend.
// It uses PerMode=PerGame rather than Totals, so the numbers represent
// averages rather than season-to-date sums.
// Kept unchanged so the existing teams route continues to work without modification.
async function getTeams(season = CURRENT_SEASON) {
  return nbaGet("leaguedashteamstats", {
    Conference: "",
    DateFrom: "",
    DateTo: "",
    Division: "",
    GameScope: "",
    GameSegment: "",
    LastNGames: "0",
    LeagueID: "00",
    Location: "",
    MeasureType: "Base",
    Month: "0",
    OpponentTeamID: "0",
    Outcome: "",
    PORound: "0",
    PaceAdjust: "N",
    PerMode: "PerGame",   // Per-game averages for the existing route
    Period: "0",
    PlayerExperience: "",
    PlayerPosition: "",
    PlusMinus: "N",
    Rank: "N",
    Season: season,
    SeasonType: "Regular Season",
    ShotClockRange: "",
    StarterBench: "",
    TeamID: "0",
    TwoWay: "0",
    VsConference: "",
    VsDivision: "",
  });
}

// Returns identity and metadata for a single NBA team from the
// 'teaminfocommon' endpoint.
//
// Input:
//   teamId — NBA team ID (e.g. 1610612738 for Boston Celtics)
//
// Key fields returned in resultSets[0]:
//   TEAM_ID             — unique team identifier
//   TEAM_CITY           — city (e.g. "Boston")
//   TEAM_NAME           — team name (e.g. "Celtics")
//   TEAM_ABBREVIATION   — 3-letter code (e.g. "BOS")
//   TEAM_CONFERENCE     — "East" or "West"
//   TEAM_DIVISION       — division (e.g. "Atlantic")
//   W, L                — wins and losses (also available here)
//
// This function is used to populate:
//   - team header (Boston Celtics)
//   - division label (Atlantic Division)
//   - conference if needed later
//
// Note: This endpoint does NOT include per-game stats like PPG, RPG, APG.
// Those come from getTeams().

async function getTeamInfo(teamId, season = CURRENT_SEASON) {
  return nbaGet('teaminfocommon', {
    LeagueID: '00',
    Season: season,
    SeasonType: 'Regular Season',
    TeamID: teamId,
  });
}

module.exports = {
  CURRENT_SEASON,
  CURRENT_SEASON,      // Exported so other modules use the same season string
  nbaGet,              // Low-level helper (available if routes need custom calls)
  // Level 1 — static/roster data
  getPlayers,
  getPlayerCareerStats,
  getPlayerInfo,       // NEW
  // Level 2 — season totals for first ingestion
  getTeamSeasonTotals, // NEW
  getPlayerSeasonTotals, // NEW
  // Level 3 — per-game logs for nightly sync
  getTeamGameLog,      // NEW
  getPlayerGameLog,    // NEW
  // Legacy
  getTeams,
  getTeamInfo
};

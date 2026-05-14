'use strict';

/**
 * nightlySync.js
 *
 * The single, unified sync pipeline for all NBA data.
 *
 * runSync() is the sole entry point and handles every step in sequence:
 *
 *   Step 0 — Prerequisites gate
 *     Verifies that Team and Player collections are populated. Throws immediately
 *     if either is empty, preventing a sync from running against an uninitialized
 *     database and producing silently incorrect data.
 *
 *   Step 1 — Season stats baseline (first run only)
 *     On the very first sync (no TeamSeasonStats documents for the current
 *     season), fetches combined Regular Season + Playoffs totals from the NBA
 *     API and populates TeamSeasonStats and PlayerSeasonStats with accurate
 *     season-to-date averages.
 *
 *   Step 2 — Game log sync
 *     Inserts new TeamGameStats and PlayerGameStats documents. On a first run,
 *     passes null as daysBack so the full season is fetched (no DateFrom filter)
 *     — this ensures the complete season history lands in TeamGameStats now that
 *     the old 14-day TTL has been removed. On subsequent nightly runs, only the
 *     past 14 days are fetched to keep API calls fast.
 *     Deduplication via the (teamId/playerId, nbaGameId) compound unique indexes
 *     makes re-running always safe.
 *
 *   Step 3 — Career stats (first population only)
 *     If PlayerCareerStats is empty, fetches career history for every player in
 *     the Player collection and upserts one document per player per season.
 *     Rate-limited to 600 ms between players to avoid NBA API throttling.
 *     Skipped instantly on all subsequent runs once the collection is populated.
 *     Non-fatal if individual player requests fail.
 *
 *   Step 4 — Today's schedule
 *     Fetches today's games from scoreboardv2 and upserts them into
 *     GameSchedule. Runs on every sync so scores and status stay current.
 *     Marked non-fatal — a blocked scoreboardv2 call logs a warning but does
 *     not abort the rest of the sync.
 *
 *   Summary — Prints elapsed time and insert/upsert counts for all steps.
 *
 * Called automatically by the 2:00 AM cron job (startNightlySync), and also
 * exported so manualSync.js can trigger it on demand without waiting for 2 AM.
 */

const cron = require('node-cron');

const Team              = require('../models/Team');
const Player            = require('../models/Player');
const TeamGameStats     = require('../models/TeamGameStats');
const PlayerGameStats   = require('../models/PlayerGameStats');
const TeamSeasonStats   = require('../models/TeamSeasonStats');
const GameSchedule      = require('../models/GameSchedule');
const PlayerCareerStats = require('../models/PlayerCareerStats');

const {
  getTeamGameLog,
  getPlayerGameLog,
  getPlayerCareerStats,
  nbaGet,
  CURRENT_SEASON,
} = require('../nbaApi');
const { rowsToObjects } = require('../utils/nbaUtils');
const {
  ingestTeamSeasonBaseline,
  ingestPlayerSeasonBaseline,
  updateTeamSeasonStats,
  updatePlayerSeasonStats,
} = require('../services/seasonStatsService');

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Extracts the opponent's team abbreviation from the NBA API's MATCHUP field.
 *
 * MATCHUP formats:
 *   "BOS vs. MIA"  — home game for BOS, opponent is MIA
 *   "BOS @ MIA"    — away game for BOS, opponent is MIA
 *
 * Returns null if the string is missing or doesn't match either pattern.
 */
function parseOpponentAbbr(matchup) {
  if (!matchup) return null;
  const parts = matchup.split(/\s+(?:vs\.|@)\s+/);
  return parts.length === 2 ? parts[1].trim() : null;
}

/**
 * Returns true if this is a home game for the team.
 * "BOS vs. MIA" contains "vs." → BOS is home.
 * "BOS @ MIA"   contains "@"   → BOS is away.
 */
function parseIsHome(matchup) {
  return typeof matchup === 'string' && matchup.includes('vs.');
}

/**
 * Formats a Date as "MM/DD/YYYY" — the format the NBA API's DateFrom/DateTo
 * parameters expect.
 */
function formatNbaDate(date) {
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const dd   = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/** Returns a Promise that resolves after ms milliseconds. */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Step 2a: Team game log sync ───────────────────────────────────────────────

/**
 * Fetches the team game log for the current season and inserts any
 * TeamGameStats documents that don't already exist in the database.
 *
 * On a first-run sync (shouldUpdateSeasonStats = false), game docs are inserted
 * so the full season history is available, but updateTeamSeasonStats() is NOT
 * called — the baseline ingestion that ran just before already wrote accurate
 * season-to-date totals, and calling the incremental updater here would
 * double-count every historical game.
 *
 * On all subsequent nightly syncs (shouldUpdateSeasonStats = true, the default),
 * only genuinely new games reach the insert path, so each insert correctly
 * increments the season totals by exactly one game.
 *
 * @param {Map}         teamByNbaId             - nbaId → Team MongoDB document
 * @param {Map}         teamByAbbr              - abbreviation → Team MongoDB document
 * @param {boolean}     shouldUpdateSeasonStats - false on first run
 * @param {number|null} daysBack                - null = full season, number = rolling window
 * @returns {{ inserted: number, skipped: number }}
 */
async function syncTeamGames(teamByNbaId, teamByAbbr, shouldUpdateSeasonStats, daysBack) {
  console.log('[runSync] Fetching team game log from NBA API...');
  const data = await getTeamGameLog(CURRENT_SEASON, daysBack);

  const resultSet =
    data.resultSets?.find((s) => s.name === 'LeagueGameLog') ||
    data.resultSets?.[0];

  if (!resultSet) throw new Error('LeagueGameLog (teams) not found');

  const rows = rowsToObjects(resultSet);
  console.log(`[runSync] ${rows.length} team game rows received.`);

  let inserted = 0;
  let skipped  = 0;

  for (const row of rows) {
    const nbaGameId = Number(row.GAME_ID);
    const nbaTeamId = row.TEAM_ID;

    const team = teamByNbaId.get(nbaTeamId);
    if (!team) { skipped++; continue; }

    // Deduplication: skip if this (team, game) pair is already stored.
    const exists = await TeamGameStats.exists({ teamId: team._id, nbaGameId });
    if (exists) { skipped++; continue; }

    const opponentAbbr = parseOpponentAbbr(row.MATCHUP);
    const opponent     = opponentAbbr ? teamByAbbr.get(opponentAbbr) : null;
    if (!opponent) {
      console.warn(`[runSync] Cannot resolve opponent for: ${row.MATCHUP}`);
      skipped++;
      continue;
    }

    const gameDoc = await TeamGameStats.create({
      nbaGameId,
      season:                  CURRENT_SEASON,
      teamId:                  team._id,
      opponentTeamId:          opponent._id,
      gameDate:                new Date(row.GAME_DATE),
      isHome:                  parseIsHome(row.MATCHUP),
      result:                  row.WL === 'W' ? 'W' : 'L',
      points:                  row.PTS        ?? 0,
      // oppPoints = our score minus point differential (exact math, no extra API call needed)
      oppPoints:               row.PTS - (row.PLUS_MINUS ?? 0),
      rebounds:                row.REB        ?? 0,
      assists:                 row.AST        ?? 0,
      steals:                  row.STL        ?? 0,
      blocks:                  row.BLK        ?? 0,
      turnovers:               row.TOV        ?? 0,
      fieldGoalsMade:          row.FGM        ?? 0,
      fieldGoalsAttempted:     row.FGA        ?? 0,
      threePointersMade:       row.FG3M       ?? 0,
      threePointersAttempted:  row.FG3A       ?? 0,
      freeThrowsMade:          row.FTM        ?? 0,
      freeThrowsAttempted:     row.FTA        ?? 0,
    });

    if (shouldUpdateSeasonStats) {
      await updateTeamSeasonStats(gameDoc, CURRENT_SEASON);
    }
    inserted++;
  }

  console.log(`[runSync] Team games — inserted: ${inserted}, skipped: ${skipped}`);
  return { inserted, skipped };
}

// ── Step 2b: Player game log sync ─────────────────────────────────────────────

/**
 * Fetches the player game log for the current season and inserts any
 * PlayerGameStats documents that don't already exist.
 *
 * The shouldUpdateSeasonStats flag follows the same logic as syncTeamGames().
 *
 * @param {Map}         playerByNbaId           - nbaId → Player MongoDB document
 * @param {Map}         teamByNbaId             - nbaId → Team MongoDB document
 * @param {Map}         teamByAbbr              - abbreviation → Team MongoDB document
 * @param {boolean}     shouldUpdateSeasonStats - false on first run
 * @param {number|null} daysBack                - null = full season, number = rolling window
 * @returns {{ inserted: number, skipped: number }}
 */
async function syncPlayerGames(playerByNbaId, teamByNbaId, teamByAbbr, shouldUpdateSeasonStats, daysBack) {
  console.log('[runSync] Fetching player game log from NBA API...');
  const data = await getPlayerGameLog(CURRENT_SEASON, daysBack);

  const resultSet =
    data.resultSets?.find((s) => s.name === 'LeagueGameLog') ||
    data.resultSets?.[0];

  if (!resultSet) throw new Error('LeagueGameLog (players) not found');

  const rows = rowsToObjects(resultSet);
  console.log(`[runSync] ${rows.length} player game rows received.`);

  let inserted = 0;
  let skipped  = 0;

  for (const row of rows) {
    const nbaGameId   = Number(row.GAME_ID);
    const nbaPlayerId = row.PLAYER_ID;
    const nbaTeamId   = row.TEAM_ID;

    const player = playerByNbaId.get(nbaPlayerId);
    const team   = teamByNbaId.get(nbaTeamId);
    if (!player || !team) { skipped++; continue; }

    const exists = await PlayerGameStats.exists({ playerId: player._id, nbaGameId });
    if (exists) { skipped++; continue; }

    const opponentAbbr = parseOpponentAbbr(row.MATCHUP);
    const opponent     = opponentAbbr ? teamByAbbr.get(opponentAbbr) : null;
    if (!opponent) { skipped++; continue; }

    // Convert "MM:SS" string to a decimal minute value (e.g. "32:45" → 32.75).
    let minutes = 0;
    if (row.MIN) {
      const parts = String(row.MIN).split(':');
      minutes = parts.length === 2
        ? Number(parts[0]) + Number(parts[1]) / 60
        : Number(row.MIN);
    }

    const gameDoc = await PlayerGameStats.create({
      nbaGameId,
      season:                  CURRENT_SEASON,
      playerId:                player._id,
      teamId:                  team._id,
      opponentTeamId:          opponent._id,
      gameDate:                new Date(row.GAME_DATE),
      minutes:                 Math.round(minutes * 10) / 10,
      points:                  row.PTS  ?? 0,
      rebounds:                row.REB  ?? 0,
      assists:                 row.AST  ?? 0,
      steals:                  row.STL  ?? 0,
      blocks:                  row.BLK  ?? 0,
      turnovers:               row.TOV  ?? 0,
      fieldGoalsMade:          row.FGM  ?? 0,
      fieldGoalsAttempted:     row.FGA  ?? 0,
      threePointersMade:       row.FG3M ?? 0,
      threePointersAttempted:  row.FG3A ?? 0,
      freeThrowsMade:          row.FTM  ?? 0,
      freeThrowsAttempted:     row.FTA  ?? 0,
    });

    if (shouldUpdateSeasonStats) {
      await updatePlayerSeasonStats(gameDoc, CURRENT_SEASON);
    }
    inserted++;
  }

  console.log(`[runSync] Player games — inserted: ${inserted}, skipped: ${skipped}`);
  return { inserted, skipped };
}

// ── Step 3: Career stats ingestion ────────────────────────────────────────────

/**
 * Fetches career history for every player in the Player collection and upserts
 * one PlayerCareerStats document per player per season. Called only when the
 * collection is completely empty.
 *
 * Uses PerMode=PerGame so the API returns per-game averages directly — no
 * division needed. Only the SeasonTotalsRegularSeason result set is used;
 * playoff career splits are not currently stored.
 *
 * Rate-limited to 600 ms between player requests to avoid NBA API throttling
 * (~480 players × 600 ms = ~5 minutes total).
 *
 * @param {Array} allPlayers - Array of Player Mongoose documents with nbaId set
 */
async function ingestAllCareerStats(allPlayers) {
  const players = allPlayers.filter((p) => p.nbaId);
  console.log(`[runSync] Ingesting career stats for ${players.length} players (this takes ~5 min)...`);

  let upserted = 0;
  let failed   = 0;

  for (let i = 0; i < players.length; i++) {
    const player = players[i];

    try {
      const data = await getPlayerCareerStats(player.nbaId);

      // SeasonTotalsRegularSeason has one row per season played.
      // With PerMode=PerGame all counting stats are already per-game averages.
      const resultSet = data.resultSets?.find((rs) => rs.name === 'SeasonTotalsRegularSeason');
      if (!resultSet) continue;

      const rows = rowsToObjects(resultSet);

      for (const row of rows) {
        await PlayerCareerStats.findOneAndUpdate(
          { playerId: player._id, season: row.SEASON_ID },
          {
            $set: {
              nbaPlayerId:  player.nbaId,
              teamAbbr:     row.TEAM_ABBREVIATION ?? '',
              gamesPlayed:  row.GP    ?? 0,
              avgMinutes:   row.MIN   ?? 0,
              avgPoints:    row.PTS   ?? 0,
              avgRebounds:  row.REB   ?? 0,
              avgAssists:   row.AST   ?? 0,
              avgSteals:    row.STL   ?? 0,
              avgBlocks:    row.BLK   ?? 0,
              avgTurnovers: row.TOV   ?? 0,
              fgPct:        row.FG_PCT  ?? 0,
              fg3Pct:       row.FG3_PCT ?? 0,
              ftPct:        row.FT_PCT  ?? 0,
            },
          },
          { upsert: true },
        );
        upserted++;
      }
    } catch (err) {
      console.warn(`[runSync] Career stats failed for player ${player.nbaId}: ${err.message}`);
      failed++;
    }

    // 600 ms between requests to stay under the NBA API rate limit.
    if (i < players.length - 1) await delay(600);

    // Progress log every 50 players so the console doesn't go silent.
    if ((i + 1) % 50 === 0) {
      console.log(`[runSync] Career stats: ${i + 1}/${players.length} players processed...`);
    }
  }

  console.log(`[runSync] Career stats done — ${upserted} season rows upserted, ${failed} players failed.`);
  return upserted;
}

// ── Step 4: Today's schedule sync ────────────────────────────────────────────

/**
 * Fetches today's NBA games from the scoreboardv2 endpoint and upserts each
 * game into the GameSchedule collection. Re-running is always safe — the
 * nbaGameId unique index means existing documents are updated, not duplicated.
 *
 * @param {Map} teamByNbaId - nbaId → Team document (for resolving MongoDB _ids)
 * @returns {number} Number of games upserted
 */
async function syncTodaySchedule(teamByNbaId) {
  const today = formatNbaDate(new Date());
  console.log(`[runSync] Fetching today's schedule (${today})...`);

  const data = await nbaGet('scoreboardv2', {
    GameDate:  today,
    LeagueID:  '00',
    DayOffset: '0',
  });

  const gameHeaderRS = data.resultSets?.find((rs) => rs.name === 'GameHeader');
  const lineScoreRS  = data.resultSets?.find((rs) => rs.name === 'LineScore');

  if (!gameHeaderRS) {
    console.log('[runSync] No games scheduled today.');
    return 0;
  }

  const gameHeaders = rowsToObjects(gameHeaderRS);
  const lineScores  = lineScoreRS ? rowsToObjects(lineScoreRS) : [];

  // Build a score lookup: gameId → { [teamId]: score }
  const scoreMap = {};
  for (const ls of lineScores) {
    if (!scoreMap[ls.GAME_ID]) scoreMap[ls.GAME_ID] = {};
    scoreMap[ls.GAME_ID][ls.TEAM_ID] = ls.PTS ?? null;
  }

  const STATUS = { 1: 'Upcoming', 2: 'Live', 3: 'Final' };
  let upserted = 0;

  for (const g of gameHeaders) {
    const homeTeam = teamByNbaId.get(g.HOME_TEAM_ID);
    const awayTeam = teamByNbaId.get(g.VISITOR_TEAM_ID);
    const scores   = scoreMap[g.GAME_ID] ?? {};

    await GameSchedule.findOneAndUpdate(
      { nbaGameId: String(g.GAME_ID) },
      {
        $set: {
          gameDate:   new Date(g.GAME_DATE_EST),
          status:     STATUS[g.GAME_STATUS_ID] ?? 'Upcoming',
          startTime:  g.GAME_STATUS_TEXT ?? '',
          homeTeamId: homeTeam?._id ?? null,
          awayTeamId: awayTeam?._id ?? null,
          homeScore:  scores[g.HOME_TEAM_ID]    ?? null,
          awayScore:  scores[g.VISITOR_TEAM_ID] ?? null,
          fetchedAt:  new Date(),
        },
      },
      { upsert: true },
    );
    upserted++;
  }

  console.log(`[runSync] Schedule sync done — ${upserted} games upserted.`);
  return upserted;
}

// ── Main sync entry point ─────────────────────────────────────────────────────

/**
 * The unified sync pipeline. All four steps run in sequence on every call.
 * Steps 1, 3 are self-gating (they check counts before doing any work) so
 * the cron job and manualSync.js can call the same function without special-casing.
 */
async function runSync() {
  const startTime = Date.now();

  // ── Step 0: Prerequisites gate ────────────────────────────────────────────
  // Verify the foundation collections are populated before touching any stats.
  // An empty Team or Player collection means the setup scripts haven't been run
  // yet — syncing against them would silently produce corrupt data.
  const teamCount   = await Team.countDocuments();
  const playerCount = await Player.countDocuments();

  if (teamCount === 0 || playerCount === 0) {
    throw new Error(
      `[runSync] Prerequisites not met — teams: ${teamCount}, players: ${playerCount}. ` +
      'Run syncTeamNbaIds.js and enrichPlayers.js before running sync.',
    );
  }

  console.log(`\n[runSync] ── Starting sync at ${new Date().toISOString()} ──`);
  console.log(`[runSync] ${teamCount} teams and ${playerCount} players found in DB.`);

  // Build lookup maps once — all subsequent steps share these in-memory maps
  // rather than issuing additional DB queries per row.
  const allTeams  = await Team.find({});
  const teamByNbaId = new Map(
    allTeams.filter((t) => t.nbaId).map((t) => [t.nbaId, t]),
  );
  const teamByAbbr = new Map(allTeams.map((t) => [t.abbreviation, t]));

  const allPlayers    = await Player.find({ nbaId: { $exists: true } });
  const playerByNbaId = new Map(allPlayers.map((p) => [p.nbaId, p]));

  // ── Step 1: Season stats baseline (first run only) ─────────────────────
  // Check whether TeamSeasonStats already has documents for the current season.
  // If not, this is a first run — fetch totals from the NBA API and populate
  // both TeamSeasonStats and PlayerSeasonStats before the game log sync runs.
  const seasonStatsCount  = await TeamSeasonStats.countDocuments({ season: CURRENT_SEASON });
  const isFirstRun        = seasonStatsCount === 0;
  let   baselineSucceeded = false;

  if (isFirstRun) {
    console.log('[runSync] First run detected — running full season stats baseline...');
    try {
      await ingestTeamSeasonBaseline(CURRENT_SEASON);
      await ingestPlayerSeasonBaseline(CURRENT_SEASON);
      baselineSucceeded = true;
      console.log('[runSync] Baseline ingestion complete.');
    } catch (err) {
      console.warn(
        '[runSync] Baseline ingestion failed — season stats will be built ' +
        'incrementally from game logs. Stats may be incomplete until a ' +
        'successful baseline run.',
        err.message,
      );
    }
  }

  // ── Step 2: Game log sync ─────────────────────────────────────────────────
  // daysBack = null on the first run so getTeamGameLog/getPlayerGameLog omit
  // the DateFrom filter and return the entire season's games. This is what
  // populates TeamGameStats with the full season history now that the 14-day
  // TTL has been removed. On all subsequent syncs, only the past 14 days are
  // fetched — fast and sufficient since we only need to pick up new games.
  //
  // shouldUpdateSeasonStats is false on a successful first run because the
  // baseline already set accurate season totals. Calling the incremental updater
  // on top of those would double-count every historical game.
  const shouldUpdateSeasonStats = !isFirstRun || !baselineSucceeded;
  const daysBack                = isFirstRun ? null : 14;

  const teamResult   = await syncTeamGames(teamByNbaId, teamByAbbr, shouldUpdateSeasonStats, daysBack);
  const playerResult = await syncPlayerGames(playerByNbaId, teamByNbaId, teamByAbbr, shouldUpdateSeasonStats, daysBack);

  // ── Step 3: Career stats (first population only) ──────────────────────────
  // If PlayerCareerStats is empty, fetch per-game career history for every
  // player. This runs once and takes ~5 minutes (~480 players × 600 ms delay).
  // Once the collection is populated it is permanently skipped.
  const careerCount = await PlayerCareerStats.countDocuments();
  let   careerNote  = `${careerCount} records already present, skipped`;

  if (careerCount === 0) {
    console.log('[runSync] PlayerCareerStats is empty — starting career stats ingestion...');
    try {
      const upserted = await ingestAllCareerStats(allPlayers);
      careerNote = `freshly ingested (${upserted} season rows)`;
    } catch (err) {
      console.warn('[runSync] Career stats ingestion failed (non-fatal):', err.message);
      careerNote = 'ingestion failed (non-fatal)';
    }
  } else {
    console.log(`[runSync] Career stats: ${careerNote}.`);
  }

  // ── Step 4: Today's schedule ──────────────────────────────────────────────
  // Fetch live scoreboardv2 data and upsert into GameSchedule every run.
  // Non-fatal — a blocked or failed request logs a warning and the sync continues.
  let scheduleUpserted = 0;
  try {
    scheduleUpserted = await syncTodaySchedule(teamByNbaId);
  } catch (err) {
    console.warn('[runSync] Schedule sync failed (non-fatal):', err.message);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[runSync] ── Sync complete in ${elapsed}s at ${new Date().toISOString()} ──`);
  console.log(`[runSync]   Team games inserted:   ${teamResult.inserted}`);
  console.log(`[runSync]   Player games inserted: ${playerResult.inserted}`);
  console.log(`[runSync]   Schedule upserted:     ${scheduleUpserted}`);
  console.log(`[runSync]   Career stats:          ${careerNote}`);
}

// ── Cron scheduling ───────────────────────────────────────────────────────────

function startNightlySync() {
  cron.schedule('0 2 * * *', () => {
    // Errors are caught here so a single sync failure doesn't crash the server.
    runSync().catch((err) => {
      console.error('[runSync] Sync failed:', err);
    });
  });

  console.log('[runSync] Nightly sync scheduled for 2:00 AM.');
}

module.exports = { startNightlySync, runSync };

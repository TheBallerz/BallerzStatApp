'use strict';

/**
 * nightlySync.js
 *
 * Scheduled job that runs automatically at 2:00 AM every night using node-cron.
 * Also exports runSync() so it can be triggered manually via a script or admin route.
 *
 * OVERVIEW
 * --------
 * The sync job keeps our MongoDB game stats collections in sync with the NBA Stats
 * API. It handles two scenarios automatically:
 *
 *   First run (no TeamSeasonStats documents exist for the current season):
 *     → Calls seasonStatsService to pull full season totals from the NBA API
 *       and populate TeamSeasonStats and PlayerSeasonStats with baseline data.
 *       This ensures we have accurate stats for all games played before the
 *       pipeline was turned on.
 *
 *   Subsequent runs (season stats already exist):
 *     → Fetches the full game log for the current season from the NBA API.
 *       For each row, checks whether a TeamGameStats or PlayerGameStats doc
 *       already exists with that nbaGameId. Existing records are skipped;
 *       new ones are inserted and the corresponding season stats are updated
 *       incrementally via seasonStatsService.
 *
 * DEDUPLICATION
 * -------------
 * The nbaGameId field on TeamGameStats / PlayerGameStats, combined with the
 * compound unique index on (teamId, nbaGameId) and (playerId, nbaGameId),
 * ensures each game is stored at most once per team/player. The pre-insert
 * .exists() check is an additional guard that avoids hitting the unique
 * constraint error on every row that was already imported.
 *
 * OPPONENT RESOLUTION
 * -------------------
 * The leaguegamelog API returns a MATCHUP field (e.g., "BOS vs. MIA" or
 * "BOS @ MIA"). parseOpponentAbbr() extracts the opponent's abbreviation
 * from this string, which is then used to look up the opponent's MongoDB
 * Team document from the pre-loaded teamByAbbr map.
 */

const cron = require('node-cron');

const Team           = require('../models/Team');
const Player         = require('../models/Player');
const TeamGameStats  = require('../models/TeamGameStats');
const PlayerGameStats = require('../models/PlayerGameStats');
const TeamSeasonStats = require('../models/TeamSeasonStats');
const {
  getTeamGameLog,
  getPlayerGameLog,
  CURRENT_SEASON,
} = require('../nbaApi');
const { rowsToObjects } = require('../utils/nbaUtils');
const {
  ingestTeamSeasonBaseline,
  ingestPlayerSeasonBaseline,
  updateTeamSeasonStats,
  updatePlayerSeasonStats,
} = require('../services/seasonStatsService');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts the opponent's team abbreviation from the NBA API's MATCHUP field.
 *
 * The MATCHUP field uses one of two formats:
 *   "BOS vs. MIA"  — home game for BOS, opponent is MIA
 *   "BOS @ MIA"    — away game for BOS, opponent is MIA
 *
 * In both cases the opponent abbreviation is the part after "vs." or "@".
 * Returns null if the MATCHUP string is missing or doesn't match either pattern.
 */
function parseOpponentAbbr(matchup) {
  if (!matchup) return null;
  // Split on " vs. " or " @ " with surrounding whitespace.
  const parts = matchup.split(/\s+(?:vs\.|@)\s+/);
  return parts.length === 2 ? parts[1].trim() : null;
}

// ── Core sync functions ───────────────────────────────────────────────────────

/**
 * Fetches the full team game log for the current season and inserts any
 * TeamGameStats documents that don't already exist in the database.
 *
 * On a first-run sync (shouldUpdateSeasonStats = false), game docs are inserted
 * so recent box scores are available in the UI, but updateTeamSeasonStats() is
 * NOT called — the baseline ingestion that ran just before already wrote accurate
 * season-to-date totals, and calling the incremental updater on top of those
 * would double-count every historical game.
 *
 * On all subsequent nightly syncs (shouldUpdateSeasonStats = true, the default),
 * only genuinely new games reach the insert path, so every new insert correctly
 * increments the season totals by exactly one game.
 *
 * @param {Map}     teamByNbaId           - Map of NBA numeric team ID → Team MongoDB document
 * @param {Map}     teamByAbbr            - Map of team abbreviation → Team MongoDB document
 * @param {boolean} [shouldUpdateSeasonStats=true] - Whether to call updateTeamSeasonStats()
 *                                                   after each insert. Pass false on first run.
 */
async function syncTeamGames(teamByNbaId, teamByAbbr, shouldUpdateSeasonStats = true) {
  console.log('[nightlySync] Fetching team game log from NBA API...');
  const data = await getTeamGameLog(CURRENT_SEASON);

  const resultSet =
    data.resultSets?.find((s) => s.name === 'LeagueGameLog') ||
    data.resultSets?.[0];

  if (!resultSet) throw new Error('LeagueGameLog (teams) not found');

  // Convert the row/header format to plain objects for field-name access.
  const rows = rowsToObjects(resultSet);
  console.log(`[nightlySync] ${rows.length} team game rows received.`);

  let inserted = 0;
  let skipped  = 0;

  for (const row of rows) {
    // GAME_ID is a string in the API response — cast to Number for consistent
    // storage and comparison against the nbaGameId index.
    const nbaGameId = Number(row.GAME_ID);
    const nbaTeamId = row.TEAM_ID;

    // Look up the MongoDB Team document by the API's numeric team ID.
    const team = teamByNbaId.get(nbaTeamId);
    if (!team) {
      // Team not in our DB (shouldn't happen for NBA teams, but guard defensively).
      skipped++;
      continue;
    }

    // Deduplication check: if this (team, game) pair already exists, skip it.
    // This is the primary guard against double-inserts on re-runs.
    const exists = await TeamGameStats.exists({ teamId: team._id, nbaGameId });
    if (exists) { skipped++; continue; }

    // Parse the opponent's abbreviation from the MATCHUP string and resolve
    // it to a MongoDB Team document using the abbreviation map.
    const opponentAbbr = parseOpponentAbbr(row.MATCHUP);
    const opponent     = opponentAbbr ? teamByAbbr.get(opponentAbbr) : null;
    if (!opponent) {
      // Log with context so the malformed row can be investigated.
      console.warn(`[nightlySync] Cannot resolve opponent for: ${row.MATCHUP}`);
      skipped++;
      continue;
    }

    // Insert the new game document. All numeric fields default to 0 via the
    // schema, so the ?? 0 fallbacks here guard against null API values.
    const gameDoc = await TeamGameStats.create({
      nbaGameId,
      season:               CURRENT_SEASON,
      teamId:               team._id,
      opponentTeamId:       opponent._id,
      gameDate:             new Date(row.GAME_DATE),
      result:               row.WL === 'W' ? 'W' : 'L',
      points:               row.PTS        ?? 0,
      // oppPoints is not directly returned by leaguegamelog, but can be derived:
      // the API provides PTS (our score) and PLUS_MINUS (point differential),
      // so opponent score = PTS - PLUS_MINUS.
      oppPoints:            row.PTS - (row.PLUS_MINUS ?? 0),
      rebounds:             row.REB        ?? 0,
      assists:              row.AST        ?? 0,
      steals:               row.STL        ?? 0,
      blocks:               row.BLK        ?? 0,
      turnovers:            row.TOV        ?? 0,
      fieldGoalsMade:       row.FGM        ?? 0,
      fieldGoalsAttempted:  row.FGA        ?? 0,
      threePointersMade:    row.FG3M       ?? 0,
      threePointersAttempted: row.FG3A     ?? 0,
      freeThrowsMade:       row.FTM        ?? 0,
      freeThrowsAttempted:  row.FTA        ?? 0,
    });

    // Only update season stats if this is an incremental (non-first-run) sync.
    // On the first run, the baseline ingestion already set accurate totals via
    // the NBA API's season aggregates. Calling updateTeamSeasonStats() here on
    // top of those would add every historical game's stats a second time.
    if (shouldUpdateSeasonStats) {
      await updateTeamSeasonStats(gameDoc, CURRENT_SEASON);
    }
    inserted++;
  }

  console.log(`[nightlySync] Team games — inserted: ${inserted}, skipped: ${skipped}`);
}

/**
 * Fetches the full player game log for the current season and inserts any
 * PlayerGameStats documents that don't already exist in the database.
 *
 * The shouldUpdateSeasonStats flag follows the same logic as syncTeamGames():
 * pass false on a first-run sync so the baseline totals aren't double-counted,
 * and leave it at the default true on all subsequent nightly runs.
 *
 * @param {Map}     playerByNbaId         - Map of NBA numeric player ID → Player MongoDB document
 * @param {Map}     teamByNbaId           - Map of NBA numeric team ID → Team MongoDB document
 * @param {Map}     teamByAbbr            - Map of team abbreviation → Team MongoDB document
 * @param {boolean} [shouldUpdateSeasonStats=true] - Whether to call updatePlayerSeasonStats()
 *                                                   after each insert. Pass false on first run.
 */
async function syncPlayerGames(playerByNbaId, teamByNbaId, teamByAbbr, shouldUpdateSeasonStats = true) {
  console.log('[nightlySync] Fetching player game log from NBA API...');
  const data = await getPlayerGameLog(CURRENT_SEASON);

  const resultSet =
    data.resultSets?.find((s) => s.name === 'LeagueGameLog') ||
    data.resultSets?.[0];

  if (!resultSet) throw new Error('LeagueGameLog (players) not found');

  const rows = rowsToObjects(resultSet);
  console.log(`[nightlySync] ${rows.length} player game rows received.`);

  let inserted = 0;
  let skipped  = 0;

  for (const row of rows) {
    const nbaGameId   = Number(row.GAME_ID);
    const nbaPlayerId = row.PLAYER_ID;
    const nbaTeamId   = row.TEAM_ID;

    // Look up both the player and their team by NBA ID.
    const player = playerByNbaId.get(nbaPlayerId);
    const team   = teamByNbaId.get(nbaTeamId);

    // Skip rows for players or teams not in our database (G-League call-ups,
    // two-way contracts, players on teams we don't track, etc.).
    if (!player || !team) { skipped++; continue; }

    // Deduplication: skip if this (player, game) pair was already imported.
    const exists = await PlayerGameStats.exists({ playerId: player._id, nbaGameId });
    if (exists) { skipped++; continue; }

    // Resolve the opponent team from the MATCHUP string.
    const opponentAbbr = parseOpponentAbbr(row.MATCHUP);
    const opponent     = opponentAbbr ? teamByAbbr.get(opponentAbbr) : null;
    if (!opponent) { skipped++; continue; }

    // Convert minutes from the NBA API's "MM:SS" string format to a decimal number.
    // Examples: "32:45" → 32.75, "0:00" → 0, "38" → 38 (fallback for plain number).
    let minutes = 0;
    if (row.MIN) {
      const parts = String(row.MIN).split(':');
      minutes = parts.length === 2
        ? Number(parts[0]) + Number(parts[1]) / 60
        : Number(row.MIN);
    }

    const gameDoc = await PlayerGameStats.create({
      nbaGameId,
      season:               CURRENT_SEASON,
      playerId:             player._id,
      teamId:               team._id,
      opponentTeamId:       opponent._id,
      gameDate:             new Date(row.GAME_DATE),
      // Round minutes to 1 decimal place (e.g., 32.8 not 32.75).
      minutes:              Math.round(minutes * 10) / 10,
      points:               row.PTS  ?? 0,
      rebounds:             row.REB  ?? 0,
      assists:              row.AST  ?? 0,
      steals:               row.STL  ?? 0,
      blocks:               row.BLK  ?? 0,
      turnovers:            row.TOV  ?? 0,
      fieldGoalsMade:       row.FGM  ?? 0,
      fieldGoalsAttempted:  row.FGA  ?? 0,
      threePointersMade:    row.FG3M ?? 0,
      threePointersAttempted: row.FG3A ?? 0,
      freeThrowsMade:       row.FTM  ?? 0,
      freeThrowsAttempted:  row.FTA  ?? 0,
    });

    // Only update season stats on incremental (non-first-run) syncs.
    // Same reasoning as syncTeamGames() — baseline ingestion already captured
    // accurate totals, so skipping this on first run prevents double-counting.
    if (shouldUpdateSeasonStats) {
      await updatePlayerSeasonStats(gameDoc, CURRENT_SEASON);
    }
    inserted++;
  }

  console.log(`[nightlySync] Player games — inserted: ${inserted}, skipped: ${skipped}`);
}

// ── Main sync entry point ─────────────────────────────────────────────────────

/**
 * Runs the full sync pipeline. Called automatically by the cron schedule,
 * and also exported so it can be triggered manually (e.g., via a script or
 * admin route) without waiting for 2:00 AM.
 */
async function runSync() {
  console.log(`\n[nightlySync] ── Starting sync at ${new Date().toISOString()} ──`);

  // Build in-memory lookup maps from MongoDB so game log rows can be resolved
  // to MongoDB documents without issuing a DB query per row.
  const allTeams = await Team.find({});
  // teamByNbaId: used to match the primary team in each game log row (TEAM_ID).
  const teamByNbaId = new Map(
    allTeams.filter((t) => t.nbaId).map((t) => [t.nbaId, t]),
  );
  // teamByAbbr: used to resolve the opponent team from the MATCHUP string.
  const teamByAbbr = new Map(allTeams.map((t) => [t.abbreviation, t]));

  // playerByNbaId: used to match each player game log row (PLAYER_ID).
  const allPlayers  = await Player.find({ nbaId: { $exists: true } });
  const playerByNbaId = new Map(allPlayers.map((p) => [p.nbaId, p]));

  // ── First-run detection ───────────────────────────────────────────────────
  // If no TeamSeasonStats documents exist for this season, this is the first
  // sync. Attempt the baseline ingestion first to populate complete season-to-date
  // totals from the NBA API before the incremental game sync runs.
  // On all subsequent syncs this check passes and baseline is skipped entirely.
  const seasonStatsCount = await TeamSeasonStats.countDocuments({
    season: CURRENT_SEASON,
  });

  // Capture first-run status BEFORE the baseline writes any documents.
  const isFirstRun = seasonStatsCount === 0;

  // Track whether the baseline succeeded so we can decide how to handle
  // season stats updates in the incremental sync below.
  let baselineSucceeded = false;

  if (isFirstRun) {
    console.log('[nightlySync] No season stats found — attempting full baseline ingestion...');
    try {
      await ingestTeamSeasonBaseline(CURRENT_SEASON);
      await ingestPlayerSeasonBaseline(CURRENT_SEASON);
      baselineSucceeded = true;
      console.log('[nightlySync] Baseline ingestion complete.');
    } catch (err) {
      // The NBA Stats API occasionally fails on season aggregate endpoints —
      // this is common when the regular season has just ended or the API is
      // temporarily degraded. Rather than crashing the whole sync, we fall back
      // to building season stats incrementally from the game logs below.
      // The resulting stats will reflect only the past 14 days of games on this
      // first run, but every subsequent nightly sync will keep them current.
      console.warn(
        '[nightlySync] Baseline ingestion failed — season stats will be built ' +
        'incrementally from game logs instead. Stats may be incomplete until ' +
        'the next successful baseline run.',
        err.message,
      );
    }
  }

  // ── Incremental game sync ─────────────────────────────────────────────────
  // Fetch and insert any new team and player game records.
  // Both functions skip rows that are already in the database, so this is
  // safe to run repeatedly without creating duplicate records.
  //
  // shouldUpdateSeasonStats controls whether each new game insert also triggers
  // an incremental season stats update. The logic has three cases:
  //
  //   Subsequent run (not first run):
  //     → true. Only genuinely new games reach the insert path, so each
  //       increments the season totals exactly once.
  //
  //   First run, baseline succeeded:
  //     → false. The baseline already wrote accurate full-season totals via a
  //       single API call. Calling the incremental updater on top of those
  //       would double-count every historical game.
  //
  //   First run, baseline failed:
  //     → true. There are no season stats docs yet, so the incremental updater
  //       must run to build them from the game logs. Stats will be partial
  //       (only the past 14 days) but accurate for what's inserted.
  const shouldUpdateSeasonStats = !isFirstRun || !baselineSucceeded;
  await syncTeamGames(teamByNbaId, teamByAbbr, shouldUpdateSeasonStats);
  await syncPlayerGames(playerByNbaId, teamByNbaId, teamByAbbr, shouldUpdateSeasonStats);

  console.log(`[nightlySync] ── Sync complete at ${new Date().toISOString()} ──\n`);
}

// ── Cron schedule ─────────────────────────────────────────────────────────────

/**
 * Registers the nightly sync job with node-cron and starts it.
 * Called once from server.js after the MongoDB connection is established.
 *
 * Cron expression '0 2 * * *' means: at minute 0 of hour 2, every day.
 * 2:00 AM is chosen because all West Coast games (latest time zone) are
 * reliably finished by then, so the game log will include complete results.
 */
function startNightlySync() {
  cron.schedule('0 2 * * *', () => {
    // Errors are caught here so a single sync failure doesn't crash the server.
    runSync().catch((err) => {
      console.error('[nightlySync] Sync failed:', err);
    });
  });

  console.log('[nightlySync] Nightly sync scheduled for 2:00 AM.');
}

module.exports = { startNightlySync, runSync };

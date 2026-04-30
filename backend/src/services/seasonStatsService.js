'use strict';

/**
 * seasonStatsService.js
 *
 * Responsible for all writes to TeamSeasonStats and PlayerSeasonStats.
 * Every season stats document stores per-game AVERAGES, never raw totals.
 *
 * Exports four functions used by nightlySync.js:
 *
 *   ingestTeamSeasonBaseline()   — first-run: populate averages from NBA API totals
 *   ingestPlayerSeasonBaseline() — first-run: same for players
 *   updateTeamSeasonStats()      — incremental: update averages after a new game
 *   updatePlayerSeasonStats()    — incremental: same for players
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DESIGN: AVERAGES-ONLY SEASON STATS
 * ─────────────────────────────────────────────────────────────────────────────
 * Season stats store only per-game averages (PPG, RPG, APG, FG%, etc.) and
 * win/loss counts. Raw cumulative totals (totalPoints, totalFgm, etc.) are not
 * stored — the frontend reads averages directly without any client-side math.
 *
 * BASELINE (first sync)
 *   The NBA API is queried with PerMode=Totals for both Regular Season and
 *   Playoffs. The two result sets are merged (stats summed by team/player ID).
 *   Each counting stat is then divided by gamesPlayed to produce the initial
 *   per-game average:
 *     avgPoints = PTS / GP,  avgRebounds = REB / GP, etc.
 *   Shooting percentages are calculated directly from the totals:
 *     fgPct = FGM / FGA
 *   The per-game shooting makes/attempts averages (avgFgm, avgFga, etc.) are
 *   also stored — they are needed by the incremental updater to maintain
 *   correct percentages without storing raw cumulative totals (see below).
 *
 * INCREMENTAL UPDATE (every subsequent sync)
 *   After a new game document is inserted, the running-average formula updates
 *   every stat in one step:
 *     newAvg = (oldAvg × n + newGameValue) / (n + 1)
 *   where n = gamesPlayed before this game.
 *   Shooting percentages are then recomputed from the updated avg makes/attempts:
 *     fgPct = avgFgm / avgFga
 *   This is mathematically correct because:
 *     avgFgm / avgFga  =  (totalFgm / n) / (totalFga / n)  =  totalFgm / totalFga
 *   So we get the exact season FG% without ever storing the raw cumulative totals.
 *
 * COMBINED REGULAR SEASON + PLAYOFFS
 *   Both season types are treated as a single combined season. The baseline
 *   merges Regular Season and Playoffs totals before computing averages. The
 *   game log sync picks up games from both types automatically (nbaApi.js
 *   fetches both in parallel). So a player's stats reflect their entire year.
 */

const Team             = require('../models/Team');
const Player           = require('../models/Player');
const TeamSeasonStats  = require('../models/TeamSeasonStats');
const PlayerSeasonStats = require('../models/PlayerSeasonStats');
const {
  getTeamSeasonTotals,
  getPlayerSeasonTotals,
  CURRENT_SEASON,
} = require('../nbaApi');
const { rowsToObjects } = require('../utils/nbaUtils');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Safely divides two numbers, returning 0 when the denominator is 0.
 * Used to compute per-game averages without division-by-zero errors.
 * Result is rounded to 1 decimal place (e.g. 25.3 for PPG).
 */
function safeAvg(total, games) {
  return games > 0 ? Math.round((total / games) * 10) / 10 : 0;
}

/**
 * Safely computes a shooting percentage from made and attempted values.
 * Returns 0 if attempted is 0 to avoid division-by-zero.
 * Result is rounded to 3 decimal places (e.g. 0.463 for 46.3%).
 */
function safePct(made, attempted) {
  return attempted > 0 ? Math.round((made / attempted) * 1000) / 1000 : 0;
}

/**
 * Applies the running-average formula to update a single stat after a new game:
 *   newAvg = (oldAvg × n + newValue) / (n + 1)
 *
 * This is mathematically exact — no floating-point accumulation over the season.
 * Result is rounded to 1 decimal place.
 *
 * @param {number} oldAvg   - The current season average before this game
 * @param {number} n        - Games played before this game (the old count)
 * @param {number} newValue - The stat value from the new game
 */
function runningAvg(oldAvg, n, newValue) {
  return Math.round(((oldAvg * n + newValue) / (n + 1)) * 10) / 10;
}

// ── Baseline ingestion ────────────────────────────────────────────────────────

/**
 * Pulls combined Regular Season + Playoffs TOTALS from the NBA API for all
 * 30 teams, computes per-game averages, and upserts a TeamSeasonStats document
 * for each. Called once on the first nightly sync when no TeamSeasonStats
 * documents exist for the current season.
 *
 * Uses findOneAndUpdate with upsert: true so re-running this function is safe —
 * it overwrites existing data rather than creating duplicates.
 *
 * @param {string} season - Season string, e.g. '2025-26'
 */
async function ingestTeamSeasonBaseline(season = CURRENT_SEASON) {
  console.log(`[seasonStats] Fetching team season totals from NBA API (${season})...`);

  // getTeamSeasonTotals fetches both Regular Season and Playoffs in parallel
  // and returns a merged result set where each team's stats are summed across
  // both season types.
  const data = await getTeamSeasonTotals(season);

  const resultSet =
    data.resultSets?.find((s) => s.name === 'LeagueDashTeamStats') ||
    data.resultSets?.[0];

  if (!resultSet) throw new Error('LeagueDashTeamStats not found in API response');

  const apiTeams = rowsToObjects(resultSet);

  // Build an in-memory map of nbaId → Team document so we can look up the
  // MongoDB _id for each team without issuing a DB query per team.
  const allTeams    = await Team.find({ nbaId: { $exists: true } });
  const teamByNbaId = new Map(allTeams.map((t) => [t.nbaId, t]));

  let upserted = 0;
  let skipped  = 0;

  for (const row of apiTeams) {
    const nbaTeamId = row.TEAM_ID;
    const team      = teamByNbaId.get(nbaTeamId);

    if (!team) {
      console.warn(`[seasonStats] No MongoDB team for nbaId ${nbaTeamId} (${row.TEAM_NAME})`);
      skipped++;
      continue;
    }

    // gamesPlayed is the denominator for all per-game averages.
    // For the merged dataset, GP = regularSeasonGP + playoffGP.
    const gp = row.GP ?? 0;

    await TeamSeasonStats.findOneAndUpdate(
      { teamId: team._id, season },
      {
        $set: {
          nbaTeamId,
          wins:          row.W  ?? 0,
          losses:        row.L  ?? 0,
          gamesPlayed:   gp,

          // Divide each cumulative total by gamesPlayed to produce per-game averages.
          avgPoints:     safeAvg(row.PTS ?? 0, gp),
          avgRebounds:   safeAvg(row.REB ?? 0, gp),
          avgAssists:    safeAvg(row.AST ?? 0, gp),
          avgSteals:     safeAvg(row.STL ?? 0, gp),
          avgBlocks:     safeAvg(row.BLK ?? 0, gp),
          avgTurnovers:  safeAvg(row.TOV ?? 0, gp),

          // Store per-game shooting averages so the incremental updater can
          // maintain correct percentages without cumulative totals.
          avgFgm:  safeAvg(row.FGM  ?? 0, gp),
          avgFga:  safeAvg(row.FGA  ?? 0, gp),
          avgFg3m: safeAvg(row.FG3M ?? 0, gp),
          avgFg3a: safeAvg(row.FG3A ?? 0, gp),
          avgFtm:  safeAvg(row.FTM  ?? 0, gp),
          avgFta:  safeAvg(row.FTA  ?? 0, gp),

          // Compute percentages directly from the API totals for maximum accuracy.
          fgPct:  safePct(row.FGM  ?? 0, row.FGA  ?? 0),
          fg3Pct: safePct(row.FG3M ?? 0, row.FG3A ?? 0),
          ftPct:  safePct(row.FTM  ?? 0, row.FTA  ?? 0),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    upserted++;
  }

  console.log(`[seasonStats] Team baseline done. Upserted: ${upserted}, Skipped: ${skipped}`);
}

/**
 * Pulls combined Regular Season + Playoffs TOTALS from the NBA API for all
 * active players, computes per-game averages, and upserts a PlayerSeasonStats
 * document for each. Called once on the first nightly sync.
 *
 * Players not found in our MongoDB (G-League, two-way, etc.) are skipped.
 *
 * @param {string} season - Season string, e.g. '2025-26'
 */
async function ingestPlayerSeasonBaseline(season = CURRENT_SEASON) {
  console.log(`[seasonStats] Fetching player season totals from NBA API (${season})...`);

  const data = await getPlayerSeasonTotals(season);

  const resultSet =
    data.resultSets?.find((s) => s.name === 'LeagueDashPlayerStats') ||
    data.resultSets?.[0];

  if (!resultSet) throw new Error('LeagueDashPlayerStats not found in API response');

  const apiPlayers = rowsToObjects(resultSet);

  const allPlayers    = await Player.find({ nbaId: { $exists: true } });
  const playerByNbaId = new Map(allPlayers.map((p) => [p.nbaId, p]));

  const allTeams    = await Team.find({ nbaId: { $exists: true } });
  const teamByNbaId = new Map(allTeams.map((t) => [t.nbaId, t]));

  let upserted = 0;
  let skipped  = 0;

  for (const row of apiPlayers) {
    const nbaPlayerId = row.PLAYER_ID;
    const nbaTeamId   = row.TEAM_ID;

    const player = playerByNbaId.get(nbaPlayerId);
    const team   = teamByNbaId.get(nbaTeamId);

    if (!player || !team) {
      skipped++;
      continue;
    }

    const gp = row.GP ?? 0;

    await PlayerSeasonStats.findOneAndUpdate(
      { playerId: player._id, season },
      {
        $set: {
          nbaPlayerId,
          teamId:        team._id,
          gamesPlayed:   gp,

          // Divide each cumulative total by gamesPlayed to produce per-game averages.
          avgMinutes:    safeAvg(row.MIN ?? 0, gp),
          avgPoints:     safeAvg(row.PTS ?? 0, gp),
          avgRebounds:   safeAvg(row.REB ?? 0, gp),
          avgAssists:    safeAvg(row.AST ?? 0, gp),
          avgSteals:     safeAvg(row.STL ?? 0, gp),
          avgBlocks:     safeAvg(row.BLK ?? 0, gp),
          avgTurnovers:  safeAvg(row.TOV ?? 0, gp),

          // Per-game shooting averages for incremental percentage maintenance.
          avgFgm:  safeAvg(row.FGM  ?? 0, gp),
          avgFga:  safeAvg(row.FGA  ?? 0, gp),
          avgFg3m: safeAvg(row.FG3M ?? 0, gp),
          avgFg3a: safeAvg(row.FG3A ?? 0, gp),
          avgFtm:  safeAvg(row.FTM  ?? 0, gp),
          avgFta:  safeAvg(row.FTA  ?? 0, gp),

          // Compute percentages directly from the API totals.
          fgPct:  safePct(row.FGM  ?? 0, row.FGA  ?? 0),
          fg3Pct: safePct(row.FG3M ?? 0, row.FG3A ?? 0),
          ftPct:  safePct(row.FTM  ?? 0, row.FTA  ?? 0),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    upserted++;
  }

  console.log(`[seasonStats] Player baseline done. Upserted: ${upserted}, Skipped: ${skipped}`);
}

// ── Incremental updates ───────────────────────────────────────────────────────

/**
 * Called by nightlySync.js immediately after inserting a new TeamGameStats
 * document. Updates every per-game average to include the new game using the
 * running-average formula: newAvg = (oldAvg × n + newValue) / (n + 1).
 *
 * Process:
 *   Step 1 — findOneAndUpdate with $setOnInsert ensures the document exists.
 *             Returns the document BEFORE the update (new: false default) so
 *             the old averages and gamesPlayed are available for the formula.
 *             If the doc didn't exist (upserted), returns null — all old values
 *             default to 0 and n defaults to 0, which is correct for the first game.
 *
 *   Step 2 — Compute all new averages and percentages.
 *
 *   Step 3 — Write the computed values back with $set, and push the game
 *             reference into the gameStats array.
 *
 * @param {Object} gameDoc - The newly inserted TeamGameStats Mongoose document
 * @param {string} season  - Season string, e.g. '2025-26'
 */
async function updateTeamSeasonStats(gameDoc, season = CURRENT_SEASON) {
  // Step 1: Ensure the document exists. $setOnInsert only runs on a fresh
  // upsert — it won't overwrite values on an existing document.
  const current = await TeamSeasonStats.findOneAndUpdate(
    { teamId: gameDoc.teamId, season },
    {
      $setOnInsert: {
        wins: 0, losses: 0, gamesPlayed: 0,
        avgPoints: 0, avgRebounds: 0, avgAssists: 0,
        avgSteals: 0, avgBlocks: 0, avgTurnovers: 0,
        avgFgm: 0, avgFga: 0, avgFg3m: 0, avgFg3a: 0, avgFtm: 0, avgFta: 0,
        fgPct: 0, fg3Pct: 0, ftPct: 0,
      },
    },
    { upsert: true }, // new: false is the default — returns original doc (or null)
  );

  // n = games played BEFORE this new game.
  // If current is null the doc was just created, so n = 0.
  const n  = current?.gamesPlayed ?? 0;
  const n1 = n + 1;

  // Step 2: Compute all new averages using the running-average formula.
  const newAvgFgm  = runningAvg(current?.avgFgm  ?? 0, n, gameDoc.fieldGoalsMade);
  const newAvgFga  = runningAvg(current?.avgFga  ?? 0, n, gameDoc.fieldGoalsAttempted);
  const newAvgFg3m = runningAvg(current?.avgFg3m ?? 0, n, gameDoc.threePointersMade);
  const newAvgFg3a = runningAvg(current?.avgFg3a ?? 0, n, gameDoc.threePointersAttempted);
  const newAvgFtm  = runningAvg(current?.avgFtm  ?? 0, n, gameDoc.freeThrowsMade);
  const newAvgFta  = runningAvg(current?.avgFta  ?? 0, n, gameDoc.freeThrowsAttempted);

  // Step 3: Write back the updated values.
  await TeamSeasonStats.findOneAndUpdate(
    { teamId: gameDoc.teamId, season },
    {
      $set: {
        gamesPlayed:   n1,
        wins:          (current?.wins   ?? 0) + (gameDoc.result === 'W' ? 1 : 0),
        losses:        (current?.losses ?? 0) + (gameDoc.result === 'L' ? 1 : 0),

        avgPoints:     runningAvg(current?.avgPoints    ?? 0, n, gameDoc.points),
        avgRebounds:   runningAvg(current?.avgRebounds  ?? 0, n, gameDoc.rebounds),
        avgAssists:    runningAvg(current?.avgAssists   ?? 0, n, gameDoc.assists),
        avgSteals:     runningAvg(current?.avgSteals    ?? 0, n, gameDoc.steals),
        avgBlocks:     runningAvg(current?.avgBlocks    ?? 0, n, gameDoc.blocks),
        avgTurnovers:  runningAvg(current?.avgTurnovers ?? 0, n, gameDoc.turnovers),

        avgFgm:  newAvgFgm,
        avgFga:  newAvgFga,
        avgFg3m: newAvgFg3m,
        avgFg3a: newAvgFg3a,
        avgFtm:  newAvgFtm,
        avgFta:  newAvgFta,

        // Recompute percentages from the updated per-game shooting averages.
        // avgFgm / avgFga = totalFgm / totalFga (the n cancels), so this
        // gives the exact season FG% without needing cumulative totals.
        fgPct:  safePct(newAvgFgm,  newAvgFga),
        fg3Pct: safePct(newAvgFg3m, newAvgFg3a),
        ftPct:  safePct(newAvgFtm,  newAvgFta),
      },
      $push: { gameStats: gameDoc._id },
    },
  );
}

/**
 * Called by nightlySync.js immediately after inserting a new PlayerGameStats
 * document. Updates every per-game average using the same running-average
 * formula as updateTeamSeasonStats(). See that function for full process notes.
 *
 * @param {Object} gameDoc - The newly inserted PlayerGameStats Mongoose document
 * @param {string} season  - Season string, e.g. '2025-26'
 */
async function updatePlayerSeasonStats(gameDoc, season = CURRENT_SEASON) {
  // Step 1: Ensure the document exists.
  const current = await PlayerSeasonStats.findOneAndUpdate(
    { playerId: gameDoc.playerId, season },
    {
      $setOnInsert: {
        teamId: gameDoc.teamId,
        gamesPlayed: 0,
        avgMinutes: 0, avgPoints: 0, avgRebounds: 0, avgAssists: 0,
        avgSteals: 0, avgBlocks: 0, avgTurnovers: 0,
        avgFgm: 0, avgFga: 0, avgFg3m: 0, avgFg3a: 0, avgFtm: 0, avgFta: 0,
        fgPct: 0, fg3Pct: 0, ftPct: 0,
      },
    },
    { upsert: true }, // new: false is the default
  );

  const n  = current?.gamesPlayed ?? 0;
  const n1 = n + 1;

  // Step 2: Compute new shooting averages (needed for percentage recalculation).
  const newAvgFgm  = runningAvg(current?.avgFgm  ?? 0, n, gameDoc.fieldGoalsMade);
  const newAvgFga  = runningAvg(current?.avgFga  ?? 0, n, gameDoc.fieldGoalsAttempted);
  const newAvgFg3m = runningAvg(current?.avgFg3m ?? 0, n, gameDoc.threePointersMade);
  const newAvgFg3a = runningAvg(current?.avgFg3a ?? 0, n, gameDoc.threePointersAttempted);
  const newAvgFtm  = runningAvg(current?.avgFtm  ?? 0, n, gameDoc.freeThrowsMade);
  const newAvgFta  = runningAvg(current?.avgFta  ?? 0, n, gameDoc.freeThrowsAttempted);

  // Step 3: Write back updated values.
  await PlayerSeasonStats.findOneAndUpdate(
    { playerId: gameDoc.playerId, season },
    {
      $set: {
        // Always update teamId to reflect the player's current team.
        // Handles mid-season trades — stats stay on one document but the
        // team reference updates to wherever the player is now.
        teamId:        gameDoc.teamId,
        gamesPlayed:   n1,

        avgMinutes:    runningAvg(current?.avgMinutes   ?? 0, n, gameDoc.minutes),
        avgPoints:     runningAvg(current?.avgPoints    ?? 0, n, gameDoc.points),
        avgRebounds:   runningAvg(current?.avgRebounds  ?? 0, n, gameDoc.rebounds),
        avgAssists:    runningAvg(current?.avgAssists   ?? 0, n, gameDoc.assists),
        avgSteals:     runningAvg(current?.avgSteals    ?? 0, n, gameDoc.steals),
        avgBlocks:     runningAvg(current?.avgBlocks    ?? 0, n, gameDoc.blocks),
        avgTurnovers:  runningAvg(current?.avgTurnovers ?? 0, n, gameDoc.turnovers),

        avgFgm:  newAvgFgm,
        avgFga:  newAvgFga,
        avgFg3m: newAvgFg3m,
        avgFg3a: newAvgFg3a,
        avgFtm:  newAvgFtm,
        avgFta:  newAvgFta,

        fgPct:  safePct(newAvgFgm,  newAvgFga),
        fg3Pct: safePct(newAvgFg3m, newAvgFg3a),
        ftPct:  safePct(newAvgFtm,  newAvgFta),
      },
      $push: { gameStats: gameDoc._id },
    },
  );
}

module.exports = {
  ingestTeamSeasonBaseline,
  ingestPlayerSeasonBaseline,
  updateTeamSeasonStats,
  updatePlayerSeasonStats,
};

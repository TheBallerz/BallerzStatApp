'use strict';

/**
 * ONE-TIME BACKFILL SCRIPT: backfillPlayerGameStats.js
 *
 * PURPOSE
 * -------
 * Repopulates the PlayerGameStats collection with the full current season so
 * the player detail panel game-history chart shows the complete season, not
 * just the last 14 days.
 *
 * The previous 14-day TTL index auto-deleted any PlayerGameStats document
 * older than two weeks. The nightly sync's rolling 14-day window meant those
 * deleted documents were never re-fetched. This script fixes that by pulling
 * the full season from the NBA API with no DateFrom filter.
 *
 * WHAT IT DOES
 * ------------
 * 1. Drops the old TTL index (createdAt_1) if it still exists on the collection.
 * 2. Deletes all existing PlayerGameStats for the current season.
 * 3. Fetches the full season player game log from the NBA API (no DateFrom filter).
 * 4. Re-inserts every game document.
 *
 * PlayerSeasonStats is NOT touched — season averages are stored separately
 * and are already accurate. Re-running the incremental updater on every
 * historical game would double-count them all.
 *
 * WHEN TO RUN
 * -----------
 * Run once after dropping the TTL index to restore the full season of game logs.
 * Safe to re-run — step 2 clears the collection before re-inserting, so
 * running twice produces the same result.
 *
 *   npm run backfill:player-games
 *   (or: node src/scripts/backfillPlayerGameStats.js)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const Player          = require('../models/Player');
const Team            = require('../models/Team');
const PlayerGameStats = require('../models/PlayerGameStats');
const { getPlayerGameLog, CURRENT_SEASON } = require('../nbaApi');
const { rowsToObjects } = require('../utils/nbaUtils');

function parseOpponentAbbr(matchup) {
  if (!matchup) return null;
  const parts = matchup.split(/\s+(?:vs\.|@)\s+/);
  return parts.length === 2 ? parts[1].trim() : null;
}

async function backfillPlayerGameStats() {
  await connectDB();
  const startTime = Date.now();

  // ── Step 1: Drop the old TTL index if still present ──────────────────────
  try {
    await PlayerGameStats.collection.dropIndex('createdAt_1');
    console.log('[backfill] Dropped old TTL index (createdAt_1).');
  } catch (err) {
    if (err.codeName === 'IndexNotFound') {
      console.log('[backfill] TTL index (createdAt_1) not present — nothing to drop.');
    } else {
      console.warn('[backfill] Could not drop TTL index:', err.message);
    }
  }

  // ── Step 2: Delete existing PlayerGameStats for the current season ────────
  const deleted = await PlayerGameStats.deleteMany({ season: CURRENT_SEASON });
  console.log(`[backfill] Deleted ${deleted.deletedCount} existing PlayerGameStats documents.`);

  // ── Step 3: Build lookup maps ─────────────────────────────────────────────
  const allPlayers = await Player.find({});
  const allTeams   = await Team.find({});

  const playerByNbaId = new Map(
    allPlayers.filter((p) => p.nbaId).map((p) => [p.nbaId, p]),
  );
  const teamByNbaId = new Map(
    allTeams.filter((t) => t.nbaId).map((t) => [t.nbaId, t]),
  );
  const teamByAbbr = new Map(allTeams.map((t) => [t.abbreviation, t]));

  console.log(`[backfill] Loaded ${allPlayers.length} players, ${allTeams.length} teams.`);

  // ── Step 4: Fetch the full season player game log (no DateFrom filter) ────
  console.log(`[backfill] Fetching full season player game log for ${CURRENT_SEASON}...`);
  const data = await getPlayerGameLog(CURRENT_SEASON, null); // null = no DateFrom

  const resultSet =
    data.resultSets?.find((s) => s.name === 'LeagueGameLog') ||
    data.resultSets?.[0];

  if (!resultSet) throw new Error('LeagueGameLog result set not found in API response');

  const rows = rowsToObjects(resultSet);
  console.log(`[backfill] ${rows.length} player game rows received from API.`);

  // ── Step 5: Insert all rows ───────────────────────────────────────────────
  // shouldUpdateSeasonStats is false — PlayerSeasonStats already has accurate
  // season averages. Re-running the incremental updater on every historical
  // game would double-count them all.
  let inserted = 0;
  let skipped  = 0;

  for (const row of rows) {
    const nbaGameId   = Number(row.GAME_ID);
    const nbaPlayerId = row.PLAYER_ID;
    const nbaTeamId   = row.TEAM_ID;

    const player = playerByNbaId.get(nbaPlayerId);
    const team   = teamByNbaId.get(nbaTeamId);
    if (!player || !team) { skipped++; continue; }

    const opponentAbbr = parseOpponentAbbr(row.MATCHUP);
    const opponent     = opponentAbbr ? teamByAbbr.get(opponentAbbr) : null;
    if (!opponent) {
      console.warn(`[backfill] Cannot resolve opponent for: ${row.MATCHUP}`);
      skipped++;
      continue;
    }

    // Convert "MM:SS" string to a decimal minute value (e.g. "32:45" → 32.75).
    let minutes = 0;
    if (row.MIN) {
      const parts = String(row.MIN).split(':');
      minutes = parts.length === 2
        ? Number(parts[0]) + Number(parts[1]) / 60
        : Number(row.MIN);
    }

    try {
      await PlayerGameStats.create({
        nbaGameId,
        season:                 CURRENT_SEASON,
        playerId:               player._id,
        teamId:                 team._id,
        opponentTeamId:         opponent._id,
        gameDate:               new Date(row.GAME_DATE),
        minutes:                Math.round(minutes * 10) / 10,
        points:                 row.PTS  ?? 0,
        rebounds:               row.REB  ?? 0,
        assists:                row.AST  ?? 0,
        steals:                 row.STL  ?? 0,
        blocks:                 row.BLK  ?? 0,
        turnovers:              row.TOV  ?? 0,
        fieldGoalsMade:         row.FGM  ?? 0,
        fieldGoalsAttempted:    row.FGA  ?? 0,
        threePointersMade:      row.FG3M ?? 0,
        threePointersAttempted: row.FG3A ?? 0,
        freeThrowsMade:         row.FTM  ?? 0,
        freeThrowsAttempted:    row.FTA  ?? 0,
      });
      inserted++;
    } catch (err) {
      if (err.code === 11000) {
        skipped++; // duplicate — already inserted in this run
      } else {
        console.warn(`[backfill] Insert failed for game ${nbaGameId}: ${err.message}`);
        skipped++;
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[backfill] Done in ${elapsed}s.`);
  console.log(`[backfill]   Inserted: ${inserted}`);
  console.log(`[backfill]   Skipped:  ${skipped}`);

  await mongoose.disconnect();
}

backfillPlayerGameStats().catch((err) => {
  console.error('[backfill] Failed:', err);
  process.exit(1);
});

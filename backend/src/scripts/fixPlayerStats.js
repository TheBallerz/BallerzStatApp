'use strict';

/**
 * fixPlayerStats.js
 *
 * One-time repair script for when the `players` collection has been re-seeded
 * (generating new _id values) while PlayerSeasonStats and PlayerGameStats still
 * hold references to the old, now-deleted ObjectIds.
 *
 * The normal `npm run sync` script will NOT fix this on its own because it uses
 * TeamSeasonStats to detect a "first run". Since TeamSeasonStats is intact (teams
 * were not re-seeded), the sync sees isFirstRun = false, skips the player baseline,
 * and goes straight to the incremental game log sync — leaving PlayerSeasonStats empty.
 *
 * This script bypasses that check and:
 *   1. Clears any remaining stale PlayerSeasonStats and PlayerGameStats documents.
 *   2. Calls ingestPlayerSeasonBaseline() directly to rebuild PlayerSeasonStats
 *      with correct references to the current player _id values.
 *   3. Attempts syncPlayerGames() to populate PlayerGameStats with the last 14
 *      days of per-game data. This step is non-fatal — if the NBA API rejects
 *      the request (rate limiting is common), the script reports the issue but
 *      exits cleanly. PlayerSeasonStats will still have accurate full-season
 *      averages from the baseline, so the Top Players section will work regardless.
 *
 * Run with:
 *   node src/scripts/fixPlayerStats.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/database');

const Player          = require('../models/Player');
const Team            = require('../models/Team');
const PlayerSeasonStats = require('../models/PlayerSeasonStats');
const PlayerGameStats   = require('../models/PlayerGameStats');

const { ingestPlayerSeasonBaseline } = require('../services/seasonStatsService');
const {
  getPlayerGameLog,
  CURRENT_SEASON,
} = require('../nbaApi');
const { rowsToObjects } = require('../utils/nbaUtils');

// ── Helpers (copied from nightlySync.js) ──────────────────────────────────────

function parseOpponentAbbr(matchup) {
  if (!matchup) return null;
  const parts = matchup.split(/\s+(?:vs\.|@)\s+/);
  return parts.length === 2 ? parts[1].trim() : null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await connectDB();

  // ── Step 1: Clear stale collections ────────────────────────────────────────
  console.log('\n[fixPlayerStats] Step 1 — Clearing stale PlayerSeasonStats and PlayerGameStats...');
  const pssResult = await PlayerSeasonStats.deleteMany({});
  const pgsResult = await PlayerGameStats.deleteMany({});
  console.log(`  Deleted ${pssResult.deletedCount} PlayerSeasonStats documents.`);
  console.log(`  Deleted ${pgsResult.deletedCount} PlayerGameStats documents.`);

  // ── Step 2: Rebuild PlayerSeasonStats from the NBA API baseline ─────────────
  console.log('\n[fixPlayerStats] Step 2 — Rebuilding PlayerSeasonStats from NBA API baseline...');
  console.log('  (This fetches full season totals for all players — may take 10–30 seconds.)');
  try {
    await ingestPlayerSeasonBaseline(CURRENT_SEASON);
    const newCount = await PlayerSeasonStats.countDocuments();
    console.log(`  ✓ Baseline complete. PlayerSeasonStats now has ${newCount} documents.`);

    // Sanity check: confirm a sample doc references a real player
    const sample = await PlayerSeasonStats.findOne({ gamesPlayed: { $gte: 10 } }).lean();
    if (sample) {
      const player = await Player.findById(sample.playerId).lean();
      if (player) {
        console.log(`  ✓ Reference check passed (e.g. ${player.firstName} ${player.lastName}).`);
      } else {
        console.warn('  ✗ Reference check FAILED — sample playerId does not match any Player document.');
      }
    }
  } catch (err) {
    console.error('\n[fixPlayerStats] ✗ Baseline ingestion failed:', err.message);
    console.error('  The NBA API may be temporarily unavailable. Wait a few minutes and try again.');
    await mongoose.disconnect();
    process.exit(1);
  }

  // ── Step 3: Sync last 14 days of player game logs (non-fatal) ──────────────
  console.log('\n[fixPlayerStats] Step 3 — Syncing recent player game logs (last 14 days)...');
  console.log('  (This step is optional — season averages from Step 2 are already sufficient.)');
  try {
    const allPlayers  = await Player.find({ nbaId: { $exists: true } });
    const playerByNbaId = new Map(allPlayers.map((p) => [p.nbaId, p]));

    const allTeams    = await Team.find({});
    const teamByNbaId = new Map(allTeams.filter((t) => t.nbaId).map((t) => [t.nbaId, t]));
    const teamByAbbr  = new Map(allTeams.map((t) => [t.abbreviation, t]));

    const data = await getPlayerGameLog(CURRENT_SEASON);
    const resultSet =
      data.resultSets?.find((s) => s.name === 'LeagueGameLog') ||
      data.resultSets?.[0];

    if (!resultSet) throw new Error('LeagueGameLog not found in API response');

    const rows = rowsToObjects(resultSet);
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

      let minutes = 0;
      if (row.MIN) {
        const parts = String(row.MIN).split(':');
        minutes = parts.length === 2
          ? Number(parts[0]) + Number(parts[1]) / 60
          : Number(row.MIN);
      }

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
    }

    console.log(`  ✓ Game log sync complete. Inserted: ${inserted}, Skipped: ${skipped}`);
  } catch (err) {
    console.warn('\n[fixPlayerStats] ⚠ Game log sync failed (non-fatal):', err.message);
    console.warn('  Season averages from Step 2 are still valid. The Top Players section');
    console.warn('  will show full-season averages. Incremental per-game data will be added');
    console.warn('  automatically the next time the nightly sync runs successfully.');
  }

  // ── Done ────────────────────────────────────────────────────────────────────
  console.log('\n[fixPlayerStats] Done. Reload the home page to see Top Players.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[fixPlayerStats] Unexpected error:', err);
  process.exit(1);
});

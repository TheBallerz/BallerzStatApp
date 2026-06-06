'use strict';

/**
 * ONE-TIME MIGRATION SCRIPT: backfillTeamGameStats.js
 *
 * PURPOSE
 * -------
 * Repopulates the TeamGameStats collection for the current season with the
 * new isHome field. Existing documents do not have this field because it was
 * added after the initial data load, and the nightly sync's deduplication
 * check skips rows that already exist — so they would never be updated.
 *
 * WHAT IT DOES
 * ------------
 * 1. Drops all existing TeamGameStats documents for the current season.
 * 2. Fetches the full season game log from the NBA API (no DateFrom filter).
 * 3. Re-inserts every game with isHome correctly derived from the MATCHUP string.
 *
 * TeamSeasonStats and PlayerSeasonStats are NOT touched — season averages are
 * stored in a separate collection and are unaffected by this operation.
 *
 * WHEN TO RUN
 * -----------
 * Run once after the isHome field was added to the TeamGameStats schema.
 * Safe to re-run — step 1 clears the collection before re-inserting, so
 * running twice produces the same result.
 *
 * Also drops the old 14-day TTL index (createdAt_1) from the collection if
 * it is still present, since that index was removed from the schema.
 *
 *   npm run backfill:team-games
 *   (or: node src/scripts/backfillTeamGameStats.js)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const Team          = require('../models/Team');
const TeamGameStats = require('../models/TeamGameStats');
const { getTeamGameLog, CURRENT_SEASON } = require('../nbaApi');
const { rowsToObjects } = require('../utils/nbaUtils');

function parseOpponentAbbr(matchup) {
  if (!matchup) return null;
  const parts = matchup.split(/\s+(?:vs\.|@)\s+/);
  return parts.length === 2 ? parts[1].trim() : null;
}

function parseIsHome(matchup) {
  return typeof matchup === 'string' && matchup.includes('vs.');
}

async function backfillTeamGameStats() {
  await connectDB();
  const startTime = Date.now();

  // ── Step 1: Drop the old TTL index if still present ──────────────────────
  // The 14-day TTL index was removed from the schema but may still be live on
  // the Atlas collection. Leaving it active would continue to delete game docs
  // older than 14 days, defeating the purpose of keeping the full season.
  try {
    await TeamGameStats.collection.dropIndex('createdAt_1');
    console.log('[backfill] Dropped old TTL index (createdAt_1).');
  } catch (err) {
    if (err.codeName === 'IndexNotFound') {
      console.log('[backfill] TTL index (createdAt_1) not present — nothing to drop.');
    } else {
      // Log but continue — a failed index drop is not fatal.
      console.warn('[backfill] Could not drop TTL index:', err.message);
    }
  }

  // ── Step 2: Drop existing TeamGameStats for the current season ────────────
  const deleted = await TeamGameStats.deleteMany({ season: CURRENT_SEASON });
  console.log(`[backfill] Deleted ${deleted.deletedCount} existing TeamGameStats documents.`);

  // ── Step 3: Build team lookup maps ────────────────────────────────────────
  const allTeams    = await Team.find({});
  const teamByNbaId = new Map(
    allTeams.filter((t) => t.nbaId).map((t) => [t.nbaId, t]),
  );
  const teamByAbbr  = new Map(allTeams.map((t) => [t.abbreviation, t]));

  console.log(`[backfill] Loaded ${allTeams.length} teams.`);

  // ── Step 4: Fetch the full season game log (no DateFrom filter) ───────────
  console.log(`[backfill] Fetching full season game log for ${CURRENT_SEASON}...`);
  const data = await getTeamGameLog(CURRENT_SEASON, null); // null = no DateFrom

  const resultSet =
    data.resultSets?.find((s) => s.name === 'LeagueGameLog') ||
    data.resultSets?.[0];

  if (!resultSet) throw new Error('LeagueGameLog result set not found in API response');

  const rows = rowsToObjects(resultSet);
  console.log(`[backfill] ${rows.length} game rows received from API.`);

  // ── Step 5: Insert all rows with the correct isHome value ─────────────────
  // shouldUpdateSeasonStats is false — TeamSeasonStats already has accurate
  // season averages from the existing baseline ingestion. Re-running the
  // incremental updater on every historical game would double-count them all.
  let inserted = 0;
  let skipped  = 0;

  for (const row of rows) {
    
    const nbaGameId = Number(row.GAME_ID);
    const nbaTeamId = row.TEAM_ID;

    const team = teamByNbaId.get(nbaTeamId);
    if (!team) { skipped++; continue; }

    const opponentAbbr = parseOpponentAbbr(row.MATCHUP);
    const opponent     = opponentAbbr ? teamByAbbr.get(opponentAbbr) : null;
    if (!opponent) {
      console.warn(`[backfill] Cannot resolve opponent for: ${row.MATCHUP}`);
      skipped++;
      continue;
    }
    console.log(row);
    try {
      await TeamGameStats.create({
        nbaGameId,
        season:                  CURRENT_SEASON,
        teamId:                  team._id,
        opponentTeamId:          opponent._id,
        gameDate:                new Date(row.GAME_DATE),
        isHome:                  parseIsHome(row.MATCHUP),
        result:                  row.WL === 'W' ? 'W' : 'L',
        points:                  row.PTS        ?? 0,
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
        seasonType: row.SEASON_TYPE,
      });
      inserted++;
    } catch (err) {
      // Unique index violation means this doc was already inserted earlier in
      // this same run (shouldn't happen after the deleteMany, but guard anyway).
      if (err.code === 11000) {
        skipped++;
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

backfillTeamGameStats().catch((err) => {
  console.error('[backfill] Failed:', err);
  process.exit(1);
});

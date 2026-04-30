'use strict';

/**
 * ONE-TIME CLEANUP SCRIPT: dropDuplicateCollections.js
 *
 * Drops the all-lowercase duplicate collections that were accidentally created
 * alongside the correctly-cased originals. Safe to run — it only targets the
 * four known duplicates and confirms each drop before proceeding.
 *
 * Originals to keep (camelCase, created by Mongoose):
 *   playerGameStats, playerSeasonStats, teamGameStats, teamSeasonStats
 *
 * Duplicates to remove (all lowercase):
 *   playergamestats, playerseasonstats, teamgamestats, teamseasonstats
 *
 * Run once with:
 *   node src/scripts/dropDuplicateCollections.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/database');

const COLLECTIONS_TO_DROP = [
  'playergamestats',
  'playerseasonstats',
  'teamgamestats',
  'teamseasonstats',
];

async function dropDuplicates() {
  await connectDB();

  const db = mongoose.connection.db;

  // List every collection currently in the database so we can confirm each
  // target exists before attempting to drop it.
  const existing = await db.listCollections().toArray();
  const existingNames = new Set(existing.map((c) => c.name));

  for (const name of COLLECTIONS_TO_DROP) {
    if (existingNames.has(name)) {
      await db.dropCollection(name);
      console.log(`  ✓ Dropped: ${name}`);
    } else {
      console.log(`  – Not found (already gone): ${name}`);
    }
  }

  console.log('\nDone. Remaining collections:');
  const remaining = await db.listCollections().toArray();
  remaining.forEach((c) => console.log(`  ${c.name}`));

  await mongoose.disconnect();
}

dropDuplicates().catch((err) => {
  console.error('dropDuplicateCollections failed:', err);
  process.exit(1);
});

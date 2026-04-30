'use strict';

/**
 * MANUAL TRIGGER SCRIPT: manualSync.js
 *
 * Runs the full nightly data ingestion pipeline immediately, without waiting
 * for the 2:00 AM cron job. Useful for:
 *   - First-time setup after running syncTeamNbaIds and enrichPlayers
 *   - Backfilling data after the server was offline
 *   - Testing the sync pipeline during development
 *   - Manually catching up after a missed nightly run
 *
 * This script calls the exact same runSync() function used by the cron job,
 * so the behavior is identical — including baseline detection, deduplication,
 * and incremental season stats updates.
 *
 * Run with:
 *   npm run sync
 *   (or: node src/scripts/manualSync.js)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const { runSync } = require('../jobs/nightlySync');

async function main() {
  // Establish the MongoDB connection before running the sync.
  // runSync() expects the DB to already be connected since it's normally
  // called from within the server process (which connects on boot).
  await connectDB();

  // Run the full sync pipeline — baseline detection, team game log,
  // player game log, and season stats updates all happen inside runSync().
  await runSync();

  // Disconnect cleanly so the Node process exits when the sync completes.
  await mongoose.disconnect();
  console.log('[manualSync] Done. Database connection closed.');
}

main().catch((err) => {
  console.error('[manualSync] Failed:', err);
  process.exit(1);
});

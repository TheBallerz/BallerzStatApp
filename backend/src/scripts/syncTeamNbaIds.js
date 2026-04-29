'use strict';

/**
 * ONE-TIME SCRIPT: syncTeamNbaIds.js
 *
 * PURPOSE
 * -------
 * The NBA Stats API identifies teams by a numeric ID (e.g., 1610612738 for the
 * Boston Celtics). Our MongoDB Team documents use MongoDB ObjectIds. Without a
 * bridge between these two ID systems, the nightly sync job cannot reliably link
 * incoming API data to the correct Team document.
 *
 * This script fetches all 30 teams from the NBA API, matches each one to its
 * MongoDB Team document by TEAM_NAME, and writes the API's numeric ID into the
 * Team.nbaId field. After this runs once, every Team document has an nbaId and
 * the nightly sync can use it as the lookup key.
 *
 * MATCHING STRATEGY
 * -----------------
 * The leaguedashteamstats endpoint does not return TEAM_ABBREVIATION in its
 * response, so we match by TEAM_NAME instead (e.g., "Boston Celtics"). The
 * names in our seed data were chosen to match the NBA API exactly, so this
 * should always produce a 1:1 match for all 30 teams.
 *
 * RUN ORDER
 * ---------
 * Run this script FIRST, before enrichPlayers.js and before starting the server.
 * The nightly sync and season stats baseline both require Team.nbaId to be set.
 *
 *   npm run sync:team-ids
 *   (or: node src/scripts/syncTeamNbaIds.js)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const Team = require('../models/Team');
const { getTeams } = require('../nbaApi');
const { rowsToObjects } = require('../utils/nbaUtils');

async function syncTeamNbaIds() {
  await connectDB();

  console.log('Fetching teams from NBA API...');
  const data = await getTeams();

  // Find the LeagueDashTeamStats result set, falling back to the first available
  // result set if the named one isn't found (defensive guard against API changes).
  const resultSet =
    data.resultSets?.find((s) => s.name === 'LeagueDashTeamStats') ||
    data.resultSets?.[0];

  if (!resultSet) {
    throw new Error('LeagueDashTeamStats result set not found in API response');
  }

  // Convert the NBA API's row/header format into an array of plain objects
  // so each team's fields are accessible by name (e.g., row.TEAM_NAME).
  const apiTeams = rowsToObjects(resultSet);
  console.log(`Retrieved ${apiTeams.length} teams from NBA API.`);

  let updated = 0;
  let skipped = 0;

  // The NBA API occasionally uses shortened city names that differ from the full
  // names stored in our seed data. This map translates known mismatches so the
  // name-based lookup still finds the correct MongoDB document.
  //
  // Known discrepancy:
  //   API returns "LA Clippers" → our DB stores "Los Angeles Clippers"
  //   (The Lakers use the full "Los Angeles Lakers" in both places.)
  const NAME_ALIASES = {
    'LA Clippers': 'Los Angeles Clippers',
  };

  // leaguedashteamstats does not include TEAM_ABBREVIATION in its response,
  // so we match against Team.name instead. Our seed data uses the same full
  // team names as the NBA API (e.g., "Boston Celtics"), making this reliable
  // for 29/30 teams; the alias map above handles the one exception.
  for (const apiTeam of apiTeams) {
    const nbaId = apiTeam.TEAM_ID;
    // Apply the alias map if the API name doesn't match our stored name directly.
    const teamName = NAME_ALIASES[apiTeam.TEAM_NAME] ?? apiTeam.TEAM_NAME;

    // Guard against malformed rows (missing required fields).
    if (!nbaId || !teamName) {
      console.warn(`Skipping malformed API row (missing TEAM_ID or TEAM_NAME)`);
      skipped++;
      continue;
    }

    // Find the MongoDB Team document by name and write the nbaId field.
    // returnDocument: 'after' returns the updated document (used here only to confirm success).
    const result = await Team.findOneAndUpdate(
      { name: teamName },
      { $set: { nbaId } },
      { returnDocument: 'after' },
    );

    if (result) {
      console.log(`  ✓ ${teamName} → nbaId ${nbaId}`);
      updated++;
    } else {
      // This would only happen if a team name in the API doesn't match any
      // document in our DB — investigate the exact name returned by the API.
      console.warn(`  ✗ No MongoDB team found for name: "${teamName}"`);
      skipped++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

// Run the function and exit with a non-zero code on failure so CI/CD pipelines
// and shell scripts can detect errors.
syncTeamNbaIds().catch((err) => {
  console.error('syncTeamNbaIds failed:', err);
  process.exit(1);
});

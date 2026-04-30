'use strict';

/**
 * SETUP SCRIPT: enrichPlayers.js
 *
 * PURPOSE
 * -------
 * Synchronizes our MongoDB Player collection with the full active NBA roster
 * from the NBA Stats API. This script does two things depending on whether a
 * player already exists in our database:
 *
 *   EXISTING players (matched by normalized name):
 *     → Writes nbaId immediately, then fetches commonplayerinfo to fill in
 *       height, weight, birthDate, draftYear, draftPick, jerseyNumber, imageUrl.
 *
 *   NEW players (no matching DB document):
 *     → Fetches commonplayerinfo, creates a full Player document from scratch,
 *       and links it to the correct Team document via the team's nbaId.
 *       This ensures our DB always has the complete active NBA roster after
 *       this script runs, even if our seed data was only a partial sample.
 *
 * PROCESS
 * -------
 * Step 1 — Fetch the current-season player roster from commonallplayers.
 *           This returns every active NBA player with their PERSON_ID (nbaId),
 *           display name, and TEAM_ID.
 *
 * Step 2 — Load all Team and Player documents from MongoDB into memory maps
 *           so we can look up documents by nbaId or normalized name without
 *           issuing a DB query per player.
 *
 * Step 3 — For each API player:
 *             a. Check if they already exist in our DB (by normalized name).
 *             b. If yes → update (enrich) the existing document.
 *             c. If no  → fetch their profile and create a new document.
 *
 * PREREQUISITES
 * -------------
 * syncTeamNbaIds.js must be run first so that every Team document has its
 * nbaId set. New players are linked to their team via Team.nbaId, so if that
 * field is missing the player will be skipped (no valid teamId to assign).
 *
 *   npm run sync:team-ids   ← run first
 *   npm run sync:players    ← run second
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const Player = require('../models/Player');
const Team   = require('../models/Team');
const { getPlayers, getPlayerInfo } = require('../nbaApi');
const { rowsToObjects } = require('../utils/nbaUtils');

// Delay between commonplayerinfo calls (milliseconds).
// stats.nba.com rate-limits aggressive scrapers — 600ms keeps us well under
// any documented or observed threshold while still completing in ~3 minutes
// for the full 500+ player active roster.
const RATE_LIMIT_MS = 600;

/**
 * Normalizes a player name for fuzzy matching between our seed data and the
 * NBA API's display names. Handles:
 *   - Accented characters: "Jokić" → "jokic" (NFD decompose + strip combining marks)
 *   - Apostrophes and dots: "De'Aaron" → "deaaron", "T.J." → "tj"
 *   - Case and extra whitespace
 */
function normalizeName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks (accents)
    .replace(/[^a-z0-9\s]/gi, '')    // strip punctuation (apostrophes, dots, hyphens)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');           // collapse multiple spaces into one
}

/**
 * Maps the NBA API's POSITION string to one of the valid enum values in our
 * Player schema: ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F'].
 *
 * The API returns full English words and compound positions (e.g., "Guard",
 * "Forward-Center"). We map these to the closest schema value. Compound
 * positions are resolved by their primary (first-listed) role.
 * Falls back to 'G' (Guard) if the value is unrecognized or missing.
 */
function mapPosition(apiPosition) {
  if (!apiPosition) return 'G';
  const pos = String(apiPosition).trim();

  // Direct abbreviation match — already in the right format.
  const VALID = ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F'];
  if (VALID.includes(pos)) return pos;

  // Full-word and compound position mappings from the NBA API.
  const POSITION_MAP = {
    'Point Guard':      'PG',
    'Shooting Guard':   'SG',
    'Small Forward':    'SF',
    'Power Forward':    'PF',
    'Center':           'C',
    'Guard':            'G',
    'Forward':          'F',
    // Compound positions: resolve to the primary (first) role.
    'Guard-Forward':    'G',
    'Forward-Guard':    'F',
    'Forward-Center':   'F',
    'Center-Forward':   'C',
  };

  return POSITION_MAP[pos] ?? 'G'; // default to 'G' if unrecognized
}

// Simple promise-based sleep used to throttle API calls.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches commonplayerinfo for a single player and returns a populated
 * profile object ready to be spread into a Player.create() or $set update.
 * Returns null if the result set is missing from the API response.
 *
 * @param {number} nbaId    - The NBA API's numeric player ID
 * @param {string} fullName - Display name used only for logging
 */
async function fetchPlayerProfile(nbaId, fullName) {
  const infoData = await getPlayerInfo(nbaId);

  const infoSet = infoData.resultSets?.find(
    (s) => s.name === 'CommonPlayerInfo',
  );

  if (!infoSet) {
    console.warn(`  ⚠ No CommonPlayerInfo for: ${fullName}`);
    return null;
  }

  // commonplayerinfo returns a single-row result — take index [0].
  const info = rowsToObjects(infoSet)[0];

  const profile = {
    // imageUrl is always constructible from the nbaId — the NBA CDN uses a
    // standard pattern for all active players' headshot images.
    imageUrl: `https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaId}.png`,
  };

  // HEIGHT: stored as a string (e.g., "6-8") to preserve the NBA API format.
  if (info.HEIGHT)    profile.height    = info.HEIGHT;

  // WEIGHT: returned as a numeric string (e.g., "210"), cast to Number.
  if (info.WEIGHT)    profile.weight    = Number(info.WEIGHT) || undefined;

  // BIRTHDATE: returned as an ISO datetime string (e.g., "1998-03-03T00:00:00").
  if (info.BIRTHDATE) profile.birthDate = new Date(info.BIRTHDATE);

  // COUNTRY: player's country of origin.
  if (info.COUNTRY)   profile.country   = info.COUNTRY;

  // DRAFT_YEAR: calendar year of draft (e.g., 2019). Empty for undrafted players.
  if (info.DRAFT_YEAR)   profile.draftYear = Number(info.DRAFT_YEAR) || undefined;

  // DRAFT_NUMBER: overall pick number (e.g., 3). Empty for undrafted players.
  if (info.DRAFT_NUMBER) profile.draftPick = Number(info.DRAFT_NUMBER) || undefined;

  // JERSEY: override seeded jersey number with the current API value.
  // Players occasionally change numbers mid-career.
  if (info.JERSEY != null && info.JERSEY !== '') {
    const jersey = Number(info.JERSEY);
    // Guard against out-of-range values before writing (schema enforces 0–99).
    if (jersey >= 0 && jersey <= 99) profile.jerseyNumber = jersey;
  }

  // POSITION: map the API's full English string to our schema enum value.
  if (info.POSITION) profile.position = mapPosition(info.POSITION);

  return profile;
}

async function enrichPlayers() {
  await connectDB();

  // ── Step 1: Fetch all current-season players from the NBA API ──────────────
  // IsOnlyCurrentSeason='1' limits results to players on active rosters,
  // filtering out retired players and reducing unnecessary profile lookups.
  console.log('Fetching current-season player list from NBA API...');
  const data = await getPlayers('1');

  const resultSet =
    data.resultSets?.find((s) => s.name === 'CommonAllPlayers') ||
    data.resultSet;

  if (!resultSet) throw new Error('CommonAllPlayers result set not found');

  // Filter to only roster-active players (ROSTERSTATUS === 1).
  // The API may return players with an active season but no current roster spot
  // (e.g., players on two-way contracts or recently waived).
  const apiPlayers = rowsToObjects(resultSet).filter(
    (p) => p.ROSTERSTATUS === 1 || p.ROSTERSTATUS === '1',
  );
  console.log(`Found ${apiPlayers.length} active players in NBA API.\n`);

  // ── Step 2: Build lookup maps from MongoDB ─────────────────────────────────

  // teamByNbaId: used to resolve a new player's TEAM_ID to a MongoDB Team _id.
  // Requires syncTeamNbaIds.js to have already run.
  const allTeams = await Team.find({ nbaId: { $exists: true } });
  const teamByNbaId = new Map(allTeams.map((t) => [t.nbaId, t]));

  // dbByNormalizedName: used to check whether a player already exists in our DB.
  // Keyed by normalized full name to handle accents and punctuation differences.
  const dbPlayers = await Player.find({});
  const dbByNormalizedName = new Map();
  for (const p of dbPlayers) {
    const key = normalizeName(`${p.firstName} ${p.lastName}`);
    dbByNormalizedName.set(key, p);
  }

  let enriched  = 0; // Existing players updated with profile data
  let created   = 0; // New players added to the DB from the API
  let skipped   = 0; // Players skipped due to missing team or API error

  // ── Step 3: Match and enrich / create each API player ─────────────────────
  for (const apiPlayer of apiPlayers) {
    const nbaId            = apiPlayer.PERSON_ID;
    const fullName         = apiPlayer.DISPLAY_FIRST_LAST;
    const normalizedApiName = normalizeName(fullName);

    // Throttle before every API call (both the enrich and create paths call
    // getPlayerInfo) to avoid rate-limiting from stats.nba.com.
    await sleep(RATE_LIMIT_MS);

    // ── Path A: Player already exists in our DB ──────────────────────────────
    const dbPlayer = dbByNormalizedName.get(normalizedApiName);

    if (dbPlayer) {
      // Write nbaId immediately as a safety measure — if the profile fetch
      // below fails for any reason, the player is still linkable via nbaId.
      await Player.findByIdAndUpdate(dbPlayer._id, { $set: { nbaId } });

      try {
        const profile = await fetchPlayerProfile(nbaId, fullName);
        if (profile) {
          await Player.findByIdAndUpdate(dbPlayer._id, { $set: profile });
          console.log(`  ✓ Enriched: ${fullName} (nbaId: ${nbaId})`);
          enriched++;
        }
      } catch (err) {
        // Log individual failures without stopping the whole script.
        // The player retains their nbaId so game stats will still work.
        console.error(`  ✗ Profile fetch failed for ${fullName}: ${err.message}`);
        skipped++;
      }

      continue;
    }

    // ── Path B: Player does not exist in our DB — create them ────────────────
    // Resolve their team from the NBA API's TEAM_ID field. If we can't find
    // the team (e.g., syncTeamNbaIds hasn't been run, or TEAM_ID is 0 for a
    // free agent), we skip the player since teamId is a required field.
    const nbaTeamId = apiPlayer.TEAM_ID;
    const team      = teamByNbaId.get(nbaTeamId);

    if (!team) {
      // TEAM_ID of 0 means the player is currently a free agent with no roster.
      // We skip free agents because teamId is required on the Player schema.
      // They'll be picked up on the next sync once they sign with a team.
      console.warn(
        `  ✗ Skipped (no team): "${fullName}" (TEAM_ID: ${nbaTeamId})`,
      );
      skipped++;
      continue;
    }

    try {
      const profile = await fetchPlayerProfile(nbaId, fullName);
      if (!profile) { skipped++; continue; }

      // Split the display name into firstName and lastName.
      // DISPLAY_FIRST_LAST format is "Firstname Lastname" — split on the first
      // space so multi-word last names ("Karl-Anthony Towns") are handled correctly.
      const spaceIdx = fullName.indexOf(' ');
      const firstName = spaceIdx !== -1 ? fullName.slice(0, spaceIdx) : fullName;
      const lastName  = spaceIdx !== -1 ? fullName.slice(spaceIdx + 1) : fullName;

      await Player.create({
        nbaId,
        firstName,
        lastName,
        // Use position from the profile if available; fall back to generic 'G'.
        position: profile.position ?? 'G',
        teamId:   team._id,
        ...profile,
      });

      console.log(`  + Created: ${fullName} (nbaId: ${nbaId}, team: ${team.name})`);
      created++;
    } catch (err) {
      console.error(`  ✗ Failed to create "${fullName}": ${err.message}`);
      skipped++;
    }
  }

  console.log(`\nDone.`);
  console.log(`  Enriched (existing): ${enriched}`);
  console.log(`  Created  (new):      ${created}`);
  console.log(`  Skipped:             ${skipped}`);

  await mongoose.disconnect();
}

// Run the function and exit with a non-zero code on failure so shell scripts
// and CI/CD pipelines can detect errors.
enrichPlayers().catch((err) => {
  console.error('enrichPlayers failed:', err);
  process.exit(1);
});

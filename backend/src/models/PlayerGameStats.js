const mongoose = require('mongoose');

const playerGameStatsSchema = new mongoose.Schema(
  {
    // --- NEW FIELD ---
    // The NBA Stats API's internal numeric game identifier.
    // Paired with playerId as a compound unique index to prevent duplicate
    // inserts. nightlySync.js checks for an existing document with this
    // (playerId, nbaGameId) pair before inserting — if found, the row is skipped.
    nbaGameId: {
      type: Number,
      required: true,
    },

    // --- NEW FIELD ---
    // The NBA season this game belongs to (e.g., '2025-26').
    // Stored directly on each game doc for clean, index-friendly season filtering
    // instead of computing date ranges.
    season: {
      type: String,
      required: true,
    },

    // Reference to the Player document whose stats are stored in this record.
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
    },

    // Reference to the Team document the player was on when this game was played.
    // Stored separately from the player's current teamId in case of mid-season trades.
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },

    // Reference to the opposing team's Team document.
    // Resolved by nightlySync.js by parsing the MATCHUP string from the API
    // (e.g., "BOS @ MIA" → opponent abbreviation "MIA" → Team lookup).
    opponentTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },

    // The calendar date this game was played. Parsed from the API's GAME_DATE field.
    gameDate: {
      type: Date,
      required: true,
    },

    // Minutes played, stored as a decimal number (e.g., 32.75 for 32 minutes 45 seconds).
    // The NBA API sends this in "MM:SS" format (e.g., "32:45"), so nightlySync.js
    // converts it: minutes = wholePart + (seconds / 60), then rounds to 1 decimal place.
    minutes: { type: Number, default: 0, min: 0 },

    // Points scored by the player in this game.
    points: { type: Number, default: 0, min: 0 },

    // Assists recorded by the player.
    assists: { type: Number, default: 0, min: 0 },

    // Total rebounds (offensive + defensive).
    rebounds: { type: Number, default: 0, min: 0 },

    // Steals recorded by the player.
    steals: { type: Number, default: 0, min: 0 },

    // Blocks recorded by the player.
    blocks: { type: Number, default: 0, min: 0 },

    // Turnovers committed by the player.
    turnovers: { type: Number, default: 0, min: 0 },

    // Field goals made (2-pointers + 3-pointers combined).
    fieldGoalsMade: { type: Number, default: 0, min: 0 },

    // Field goals attempted. Accumulated into PlayerSeasonStats.totalFga so
    // that FG% can be correctly computed across the full season.
    fieldGoalsAttempted: { type: Number, default: 0, min: 0 },

    // Three-pointers made.
    threePointersMade: { type: Number, default: 0, min: 0 },

    // Three-pointers attempted. Accumulated for season-level 3P% calculation.
    threePointersAttempted: { type: Number, default: 0, min: 0 },

    // Free throws made.
    freeThrowsMade: { type: Number, default: 0, min: 0 },

    // Free throws attempted. Accumulated for season-level FT% calculation.
    freeThrowsAttempted: { type: Number, default: 0, min: 0 },
  },
  // timestamps: true adds createdAt and updatedAt automatically.
  { timestamps: true },
);

// --- NEW INDEX ---
// Compound unique index — one document per player per game.
// Prevents duplicate inserts even if the nightly sync job runs more than once
// on the same night. MongoDB will reject any insert that conflicts with an
// existing (playerId, nbaGameId) pair.
playerGameStatsSchema.index({ playerId: 1, nbaGameId: 1 }, { unique: true });

// NOTE: The old 14-day TTL index on createdAt has been removed. The full
// season of game logs is now retained so the game history chart can display
// the complete season. If you have an existing MongoDB collection with
// this index still active, drop it manually:
//   db.playerGameStats.dropIndex('createdAt_1')

// The third argument pins the MongoDB collection name to 'playerGameStats'.
// Without it, Mongoose auto-lowercases the model name to 'playergamestats',
// which would silently create a duplicate collection alongside the existing one.
module.exports = mongoose.model('PlayerGameStats', playerGameStatsSchema, 'playerGameStats');

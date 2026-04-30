const mongoose = require('mongoose');

// Two weeks expressed in seconds, used for the TTL (time-to-live) index below.
// MongoDB will automatically delete any document whose createdAt timestamp is
// older than this value. This keeps game-level storage small while still
// giving the frontend enough recent games to show a "last 2 weeks" view.
// To change the retention window, update this constant and drop/recreate the index.
const TWO_WEEKS_SECONDS = 60 * 60 * 24 * 14; // 1,209,600 seconds

const teamGameStatsSchema = new mongoose.Schema(
  {
    // --- NEW FIELD ---
    // The NBA Stats API's internal numeric game identifier (e.g., 22401234).
    // This is the primary deduplication key: before inserting a new document,
    // nightlySync.js checks whether a TeamGameStats doc already exists for this
    // teamId + nbaGameId pair. If it does, the game is skipped. This ensures
    // that running the nightly sync multiple times never creates duplicate records.
    nbaGameId: {
      type: Number,
      required: true,
    },

    // --- NEW FIELD ---
    // The NBA season this game belongs to (e.g., '2025-26').
    // Stored on every game doc so we can efficiently query "all team games
    // this season" without relying on date range arithmetic.
    season: {
      type: String,
      required: true,
    },

    // Reference to the Team document for the team whose stats are recorded here.
    // Each game produces two TeamGameStats documents — one per team — so both
    // perspectives of a game are independently stored.
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },

    // Reference to the opposing team's Team document.
    // Resolved by nightlySync.js by parsing the MATCHUP string from the API
    // (e.g., "BOS vs. MIA" → opponent abbreviation "MIA" → Team lookup).
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

    // --- NEW FIELD ---
    // Win or loss result for this team in this game.
    // Taken directly from the WL field in the NBA API's leaguegamelog response.
    // Used by seasonStatsService.js to increment the wins or losses counter
    // on the corresponding TeamSeasonStats document.
    result: {
      type: String,
      enum: ['W', 'L'],
      required: true,
    },

    // Points this team scored in the game.
    points: { type: Number, default: 0, min: 0 },

    // Points the opponent scored. Derived in nightlySync.js as:
    //   oppPoints = PTS - PLUS_MINUS
    // since the API provides both the team's points and the point differential
    // but not the opponent's raw score in the leaguegamelog endpoint.
    oppPoints: { type: Number, default: 0, min: 0 },

    // Total rebounds (offensive + defensive).
    rebounds: { type: Number, default: 0, min: 0 },

    // Total assists.
    assists: { type: Number, default: 0, min: 0 },

    // Total steals.
    steals: { type: Number, default: 0, min: 0 },

    // Total blocks.
    blocks: { type: Number, default: 0, min: 0 },

    // Total turnovers.
    turnovers: { type: Number, default: 0, min: 0 },

    // Field goals made (2-pointers + 3-pointers combined).
    fieldGoalsMade: { type: Number, default: 0, min: 0 },

    // Field goals attempted. Used with fieldGoalsMade to compute FG% in
    // TeamSeasonStats via seasonStatsService.safePct().
    fieldGoalsAttempted: { type: Number, default: 0, min: 0 },

    // Three-pointers made.
    threePointersMade: { type: Number, default: 0, min: 0 },

    // Three-pointers attempted. Used to compute 3P% in TeamSeasonStats.
    threePointersAttempted: { type: Number, default: 0, min: 0 },

    // Free throws made.
    freeThrowsMade: { type: Number, default: 0, min: 0 },

    // Free throws attempted. Used to compute FT% in TeamSeasonStats.
    freeThrowsAttempted: { type: Number, default: 0, min: 0 },
  },
  // timestamps: true adds createdAt and updatedAt automatically.
  // The createdAt field is also used by the TTL index below.
  { timestamps: true },
);

// --- NEW INDEX ---
// Compound unique index that enforces one document per team per game.
// This is the deduplication guard — MongoDB rejects any insert that would
// create a second TeamGameStats for the same (teamId, nbaGameId) pair,
// so even if the nightly sync runs twice, only one record is ever written.
teamGameStatsSchema.index({ teamId: 1, nbaGameId: 1 }, { unique: true });

// --- NEW INDEX ---
// TTL index on the createdAt field. MongoDB's TTL monitor checks this index
// every 60 seconds and deletes any document where:
//   Date.now() - createdAt >= TWO_WEEKS_SECONDS
// This keeps the game-level collections small (rolling 2-week window) without
// any manual cleanup. Season-level aggregates in TeamSeasonStats are preserved
// permanently and are unaffected by this deletion.
teamGameStatsSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: TWO_WEEKS_SECONDS },
);

// The third argument pins the MongoDB collection name to 'teamGameStats'.
// Without it, Mongoose auto-lowercases the model name to 'teamgamestats',
// which would silently create a duplicate collection alongside the existing one.
module.exports = mongoose.model('TeamGameStats', teamGameStatsSchema, 'teamGameStats');

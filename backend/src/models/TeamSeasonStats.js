const mongoose = require('mongoose');

// TeamSeasonStats holds one document per team per season.
// Every field is a per-game average or a win/loss count — raw cumulative totals
// are never stored here. The frontend can read these values directly without
// any client-side math.
//
// It is populated in two ways:
//
//   1. BASELINE (first sync): seasonStatsService.ingestTeamSeasonBaseline()
//      fetches combined Regular Season + Playoffs totals from the NBA API
//      (PerMode=Totals) and divides each stat by gamesPlayed to compute the
//      initial averages. This gives accurate season-to-date averages for all
//      games played before nightly syncing began.
//
//   2. INCREMENTAL (every nightly sync thereafter): when nightlySync.js inserts
//      a new TeamGameStats document, seasonStatsService.updateTeamSeasonStats()
//      recalculates each average using the running-average formula:
//        newAvg = (oldAvg × n + newGameValue) / (n + 1)
//      where n is gamesPlayed before the new game. This is mathematically exact
//      and avoids storing raw totals.

const teamSeasonStatsSchema = new mongoose.Schema(
  {
    // The NBA Stats API's numeric team ID, mirrored from Team.nbaId.
    // Stored here so API responses can be matched to this document without
    // an extra Team lookup in hot code paths.
    nbaTeamId: {
      type: Number,
    },

    // Reference to the Team document this season record belongs to.
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },

    // Season identifier string matching the NBA API's convention (e.g. '2025-26').
    // Combined with teamId in the unique index below to ensure exactly one season
    // stats document exists per team per season.
    season: {
      type: String,
      required: true,
    },

    // Array of ObjectId references to the TeamGameStats documents that have been
    // ingested for this team this season. Because TeamGameStats docs are deleted
    // after two weeks (TTL index), this array represents only the most recent
    // games — not the full season. The averages below, however, reflect every
    // game since the first sync.
    gameStats: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TeamGameStats',
      },
    ],

    // ── Win/loss record ──────────────────────────────────────────────────────
    // Wins and losses are cumulative counts, not averages. Win% can be derived
    // as wins / gamesPlayed if needed by the frontend.

    wins:        { type: Number, default: 0, min: 0 },
    losses:      { type: Number, default: 0, min: 0 },

    // Total games played this season. Used as n in the running-average formula
    // when updateTeamSeasonStats() processes a new game.
    gamesPlayed: { type: Number, default: 0, min: 0 },

    // ── Per-game averages — counting stats ───────────────────────────────────
    // All fields below represent per-game season averages, rounded to 1 decimal
    // place. They are updated after every new game insertion.

    // Points per game.
    avgPoints:     { type: Number, default: 0, min: 0 },

    // Rebounds per game (offensive + defensive combined).
    avgRebounds:   { type: Number, default: 0, min: 0 },

    // Assists per game.
    avgAssists:    { type: Number, default: 0, min: 0 },

    // Steals per game.
    avgSteals:     { type: Number, default: 0, min: 0 },

    // Blocks per game.
    avgBlocks:     { type: Number, default: 0, min: 0 },

    // Turnovers per game.
    avgTurnovers:  { type: Number, default: 0, min: 0 },

    // ── Per-game averages — shooting volume ──────────────────────────────────
    // These per-game shooting averages are stored alongside the percentages
    // because they enable correct incremental percentage updates without needing
    // cumulative totals. The key identity is:
    //   fgPct = avgFgm / avgFga  (ratio of averages = ratio of totals)
    // So when a new game is added, avgFgm and avgFga are updated via the
    // running-average formula, and fgPct is recomputed from their new values.

    // Field goals made per game.
    avgFgm:  { type: Number, default: 0, min: 0 },

    // Field goals attempted per game.
    avgFga:  { type: Number, default: 0, min: 0 },

    // Three-pointers made per game.
    avgFg3m: { type: Number, default: 0, min: 0 },

    // Three-pointers attempted per game.
    avgFg3a: { type: Number, default: 0, min: 0 },

    // Free throws made per game.
    avgFtm:  { type: Number, default: 0, min: 0 },

    // Free throws attempted per game.
    avgFta:  { type: Number, default: 0, min: 0 },

    // ── Computed shooting percentages ────────────────────────────────────────
    // Derived from the avg shooting fields above, recomputed after every update.
    // Stored so the frontend can read them directly without recalculating.
    // Rounded to 3 decimal places (e.g. 0.463 represents 46.3%).

    // Season field goal percentage: avgFgm / avgFga.
    fgPct:  { type: Number, default: 0 },

    // Season three-point percentage: avgFg3m / avgFg3a.
    fg3Pct: { type: Number, default: 0 },

    // Season free throw percentage: avgFtm / avgFta.
    ftPct:  { type: Number, default: 0 },
  },
  // Automatically adds createdAt and updatedAt to every document.
  { timestamps: true },
);

// Compound unique index — enforces exactly one season stats document per team
// per season. findOneAndUpdate with { upsert: true } relies on this to either
// update the existing doc or create a new one on first write.
teamSeasonStatsSchema.index({ teamId: 1, season: 1 }, { unique: true });

// The third argument pins the MongoDB collection name to 'teamSeasonStats'.
// Without it, Mongoose auto-lowercases the model name to 'teamseasonstats',
// which would silently create a duplicate collection alongside the existing one.
module.exports = mongoose.model('TeamSeasonStats', teamSeasonStatsSchema, 'teamSeasonStats');

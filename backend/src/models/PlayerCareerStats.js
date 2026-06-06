'use strict';

/**
 * PlayerCareerStats.js
 *
 * Stores one document per player per season covering their full career history.
 * Populated once by runSync() when the collection is first empty, by calling
 * the playercareerstats endpoint (PerMode=PerGame) for each player in the
 * Player collection.
 *
 * Unlike PlayerSeasonStats (which only tracks the current season and uses
 * incremental running-average updates), this collection is a snapshot of the
 * career history up to the point of ingestion. It is not updated nightly —
 * new seasons are only added when runSync() detects the collection is empty
 * (i.e. after a database reset) or can be refreshed manually.
 *
 * Used by GET /api/players/:playerId/career to render the career stats table
 * on the player detail page.
 */

const mongoose = require('mongoose');

const playerCareerStatsSchema = new mongoose.Schema(
  {
    // Reference to the Player document this record belongs to.
    playerId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Player',
      required: true,
    },

    // NBA's numeric player ID, mirrored from Player.nbaId.
    // Stored here so this collection can be queried by NBA ID without a join.
    nbaPlayerId: {
      type:     Number,
      required: true,
    },

    // Season identifier string as returned by the NBA API, e.g. '2024-25'.
    // Combined with playerId in the unique index — one document per player per season.
    season: {
      type:     String,
      required: true,
    },

    // Team abbreviation for the team the player was on in this season.
    // For traded players the API returns the season totals for their final team.
    teamAbbr: {
      type:    String,
      default: '',
    },

    // Number of games the player appeared in during this season.
    gamesPlayed: { type: Number, default: 0, min: 0 },

    // ── Per-game averages ─────────────────────────────────────────────────────
    // All values come from the NBA API with PerMode=PerGame and are already
    // per-game averages — no further division is needed.

    avgMinutes:   { type: Number, default: 0, min: 0 },
    avgPoints:    { type: Number, default: 0, min: 0 },
    avgRebounds:  { type: Number, default: 0, min: 0 },
    avgAssists:   { type: Number, default: 0, min: 0 },
    avgSteals:    { type: Number, default: 0, min: 0 },
    avgBlocks:    { type: Number, default: 0, min: 0 },
    avgTurnovers: { type: Number, default: 0, min: 0 },

    // ── Shooting percentages ──────────────────────────────────────────────────
    // Taken directly from FG_PCT, FG3_PCT, FT_PCT in the API response.
    // Stored as decimal fractions (e.g. 0.463 for 46.3%).

    fgPct:  { type: Number, default: 0 },
    fg3Pct: { type: Number, default: 0 },
    ftPct:  { type: Number, default: 0 },
  },
  { timestamps: true },
);

// One document per player per season — the primary lookup pattern.
playerCareerStatsSchema.index({ playerId: 1, season: 1 }, { unique: true });

// Secondary index for lookups by NBA player ID without a Player join.
playerCareerStatsSchema.index({ nbaPlayerId: 1 });

module.exports = mongoose.model(
  'PlayerCareerStats',
  playerCareerStatsSchema,
  'playerCareerStats',
);

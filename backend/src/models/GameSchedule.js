'use strict';

/**
 * GameSchedule.js
 *
 * Stores today's NBA games as fetched from the scoreboardv2 endpoint.
 * Populated by runSync() on every sync run, keyed on nbaGameId so repeated
 * syncs safely upsert (update scores/status) rather than inserting duplicates.
 *
 * The schedule route (GET /api/schedule/today) reads from this collection
 * instead of calling the NBA API live on every request. This means the route
 * works even when stats.nba.com is blocked on the deployed server — it falls
 * back to the cached data from the most recent successful sync.
 *
 * fetchedAt is updated on every upsert so routes can check data freshness.
 */

const mongoose = require('mongoose');

const gameScheduleSchema = new mongoose.Schema(
  {
    // NBA's internal game identifier string (e.g. "0022401234").
    // Used as the upsert key — one document per game.
    nbaGameId: {
      type:     String,
      required: true,
      unique:   true,
    },

    // Calendar date the game is played (UTC midnight of game day).
    gameDate: {
      type:     Date,
      required: true,
    },

    // Human-readable game status from GAME_STATUS_TEXT:
    //   Upcoming: "7:30 pm ET"
    //   Live:     "Q3 4:22"
    //   Final:    "Final"
    startTime: {
      type:    String,
      default: '',
    },

    // Derived from GAME_STATUS_ID: 1 = Upcoming, 2 = Live, 3 = Final.
    status: {
      type:    String,
      enum:    ['Upcoming', 'Live', 'Final'],
      default: 'Upcoming',
    },

    // MongoDB reference to the home Team document.
    // Null if the team is not found in our Team collection (shouldn't happen).
    homeTeamId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Team',
      default: null,
    },

    // MongoDB reference to the away Team document.
    awayTeamId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Team',
      default: null,
    },

    // Home team's current score (null before the game tips off).
    homeScore: {
      type:    Number,
      default: null,
    },

    // Away team's current score (null before the game tips off).
    awayScore: {
      type:    Number,
      default: null,
    },

    // Timestamp of the last successful upsert. Routes can compare this against
    // Date.now() to decide whether to show a "data may be stale" warning.
    fetchedAt: {
      type:    Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

// Fast range queries when loading games for a specific date.
gameScheduleSchema.index({ gameDate: 1 });

module.exports = mongoose.model('GameSchedule', gameScheduleSchema, 'gameSchedule');

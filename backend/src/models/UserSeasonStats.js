const mongoose = require('mongoose');

// Pre-aggregated season averages for a user, recomputed whenever they log/edit/delete a game.
// Mirrors PlayerSeasonStats shape so comparison UI can treat users and players uniformly.
const schema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    gamesPlayed:  { type: Number, default: 0 },
    avgPoints:    { type: Number, default: 0 },
    avgAssists:   { type: Number, default: 0 },
    avgRebounds:  { type: Number, default: 0 },
    avgFg3m:      { type: Number, default: 0 },
    avgSteals:    { type: Number, default: 0 },
    avgBlocks:    { type: Number, default: 0 },
    avgTurnovers: { type: Number, default: 0 },
    avgMinutes:   { type: Number, default: 0 },
  },
  { timestamps: true },
);

schema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('UserSeasonStats', schema, 'userSeasonStats');

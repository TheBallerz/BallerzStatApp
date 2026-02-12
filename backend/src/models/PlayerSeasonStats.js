const mongoose = require('mongoose');

const playerSeasonStatsSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    season: {
      type: String,
      required: true,
    },
    gameStats: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PlayerGameStats',
      },
    ],
    totalPoints: { type: Number, default: 0, min: 0 },
    totalAssists: { type: Number, default: 0, min: 0 },
    totalRebounds: { type: Number, default: 0, min: 0 },
    totalSteals: { type: Number, default: 0, min: 0 },
    totalBlocks: { type: Number, default: 0, min: 0 },
    totalTurnovers: { type: Number, default: 0, min: 0 },
    totalMinutes: { type: Number, default: 0, min: 0 },
    gamesPlayed: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

playerSeasonStatsSchema.index({ playerId: 1, season: 1 }, { unique: true });

module.exports = mongoose.model('PlayerSeasonStats', playerSeasonStatsSchema);

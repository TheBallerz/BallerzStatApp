const mongoose = require('mongoose');

const teamSeasonStatsSchema = new mongoose.Schema(
  {
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
        ref: 'TeamGameStats',
      },
    ],
    wins: { type: Number, default: 0, min: 0 },
    losses: { type: Number, default: 0, min: 0 },
    totalPoints: { type: Number, default: 0, min: 0 },
    totalRebounds: { type: Number, default: 0, min: 0 },
    totalAssists: { type: Number, default: 0, min: 0 },
    totalSteals: { type: Number, default: 0, min: 0 },
    totalBlocks: { type: Number, default: 0, min: 0 },
    totalTurnovers: { type: Number, default: 0, min: 0 },
    gamesPlayed: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

teamSeasonStatsSchema.index({ teamId: 1, season: 1 }, { unique: true });

module.exports = mongoose.model('TeamSeasonStats', teamSeasonStatsSchema);

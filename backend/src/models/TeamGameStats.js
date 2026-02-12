const mongoose = require('mongoose');

const teamGameStatsSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    opponentTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    gameDate: {
      type: Date,
      required: true,
    },
    points: { type: Number, default: 0, min: 0 },
    oppPoints: { type: Number, default: 0, min: 0 },
    rebounds: { type: Number, default: 0, min: 0 },
    assists: { type: Number, default: 0, min: 0 },
    steals: { type: Number, default: 0, min: 0 },
    blocks: { type: Number, default: 0, min: 0 },
    turnovers: { type: Number, default: 0, min: 0 },
    fieldGoalsMade: { type: Number, default: 0, min: 0 },
    fieldGoalsAttempted: { type: Number, default: 0, min: 0 },
    threePointersMade: { type: Number, default: 0, min: 0 },
    threePointersAttempted: { type: Number, default: 0, min: 0 },
    freeThrowsMade: { type: Number, default: 0, min: 0 },
    freeThrowsAttempted: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('TeamGameStats', teamGameStatsSchema);

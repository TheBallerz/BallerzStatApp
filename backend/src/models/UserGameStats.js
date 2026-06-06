const mongoose = require('mongoose');

// Records a single game entry logged by a user (pickup, rec league, etc.).
// Mirrors the PlayerGameStats shape so stat comparison UI can treat both uniformly.
const schema = new mongoose.Schema(
  {
    userId:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    gameDate:          { type: Date, required: true },
    opponent:          { type: String, default: '' },
    points:            { type: Number, default: 0, min: 0 },
    assists:           { type: Number, default: 0, min: 0 },
    rebounds:          { type: Number, default: 0, min: 0 },
    threePointersMade: { type: Number, default: 0, min: 0 },
    steals:            { type: Number, default: 0, min: 0 },
    blocks:            { type: Number, default: 0, min: 0 },
    turnovers:         { type: Number, default: 0, min: 0 },
    minutes:           { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

schema.index({ userId: 1, gameDate: -1 });

module.exports = mongoose.model('UserGameStats', schema, 'userGameStats');

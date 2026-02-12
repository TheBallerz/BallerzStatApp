const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    position: {
      type: String,
      enum: ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F'],
      required: true,
    },
    jerseyNumber: {
      type: Number,
      min: 0,
      max: 99,
    },
    height: {
      type: String,
      trim: true,
    },
    weight: {
      type: Number,
      min: 0,
    },
    birthDate: {
      type: Date,
    },
    country: {
      type: String,
      default: 'USA',
      trim: true,
    },
    draftYear: {
      type: Number,
    },
    draftPick: {
      type: Number,
      min: 1,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Player', playerSchema);

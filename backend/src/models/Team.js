const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    abbreviation: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    conference: {
      type: String,
      enum: ['Eastern', 'Western'],
      required: true,
    },
    division: {
      type: String,
      enum: [
        'Atlantic',
        'Central',
        'Southeast',
        'Northwest',
        'Pacific',
        'Southwest',
      ],
      required: true,
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    roster: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model('Team', teamSchema);

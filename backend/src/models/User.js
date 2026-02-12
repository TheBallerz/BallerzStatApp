const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    favoritePlayers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
      },
    ],
    favoriteTeams: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model('User', userSchema);

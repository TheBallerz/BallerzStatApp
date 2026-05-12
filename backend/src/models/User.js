const mongoose = require('mongoose');

// Defines the shape of a user document stored in MongoDB.
// passwordHash stores the bcrypt-hashed password — the plaintext password is never saved.
// favoritePlayers and favoriteTeams hold references to Player/Team documents and will be
// populated once the NBA API integration is complete.
const userSchema = new mongoose.Schema(
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
    email: {
      type: String,
      required: true,
      unique: true,   // enforces one account per email address
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    // Stored as NBA API numeric IDs (Player.nbaId / Team.nbaId), not MongoDB ObjectIds.
    // Using nbaId is stable across re-seeds — MongoDB ObjectIds change every time
    // the players/teams collections are cleared and re-inserted.
    favoritePlayers: [{ type: Number }],
    favoriteTeams:   [{ type: Number }],
  },
  { timestamps: true }, // automatically adds createdAt and updatedAt fields
);

module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');

// Defines the shape of a user document stored in MongoDB.
// passwordHash stores the bcrypt-hashed password — the plaintext password is never saved.
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
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    // Stored as NBA API numeric IDs (Player.nbaId / Team.nbaId), not MongoDB ObjectIds.
    favoritePlayers: [{ type: Number }],
    favoriteTeams:   [{ type: Number }],
    // Social features
    avatar: {
      type: String,
      default: null,
    },
    // Confirmed friends — bidirectional: if A is in B.friends, B must be in A.friends.
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Incoming pending friend requests stored on the recipient's document.
    friendRequests: [
      {
        from:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    // Users this account has blocked (one-directional on storage).
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Grants access to the admin panel on the Account page.
    isAdmin: {
      type:    Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('User', userSchema);

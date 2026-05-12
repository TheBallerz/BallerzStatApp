const mongoose = require("mongoose");

const playerBioSchema = new mongoose.Schema(
  {
    playerId: {
      type: String,
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    team: String,
    source: {
      type: String,
      default: "wikipedia",
    },
    sourceUrl: String,
    bio: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PlayerBio", playerBioSchema);
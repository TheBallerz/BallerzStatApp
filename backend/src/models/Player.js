const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema(
  {
    // --- NEW FIELD ---
    // The NBA Stats API's internal numeric player ID (e.g., 1629029 for Jayson Tatum).
    // Written by enrichPlayers.js after matching the player by name.
    // Every PlayerGameStats and PlayerSeasonStats document uses this player's
    // MongoDB _id to link back here, but nbaId lets us match incoming API data
    // to the correct document without fragile name comparisons.
    // sparse: true allows docs without this field to coexist (pre-enrichment).
    nbaId: {
      type: Number,
      unique: true,
      sparse: true,
    },

    // Player's legal first name as stored in our seed data.
    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    // Player's legal last name.
    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    // Primary position abbreviation. The NBA uses a broader set than traditional
    //5 positions, so 'G' and 'F' are included as generic position values.
    position: {
      type: String,
      enum: ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F'],
      required: true,
    },

    // Jersey number worn by the player. Valid range is 0–99.
    jerseyNumber: {
      type: Number,
      min: 0,
      max: 99,
    },

    // --- NEW FIELD ---
    // Player height in feet-inches format as returned by the NBA API
    // (e.g., "6-8" for 6 feet 8 inches). Stored as a string to preserve
    // the exact format used by the NBA without conversion errors.
    // Written by enrichPlayers.js from the commonplayerinfo endpoint.
    height: {
      type: String,
      trim: true,
    },

    // --- NEW FIELD ---
    // Player weight in pounds as a number. The NBA API returns this as a
    // string (e.g., "210"), so enrichPlayers.js casts it with Number().
    // Written by enrichPlayers.js from the commonplayerinfo endpoint.
    weight: {
      type: Number,
      min: 0,
    },

    // --- NEW FIELD ---
    // Player's date of birth. The NBA API returns this as an ISO string
    // (e.g., "1998-03-03T00:00:00"), which is converted to a JS Date
    // by enrichPlayers.js before storing.
    birthDate: {
      type: Date,
    },

    // Player's country of origin. Defaults to 'USA' since most players are American.
    // Overwritten by enrichPlayers.js with the value from the API if available.
    country: {
      type: String,
      default: 'USA',
      trim: true,
    },

    // --- NEW FIELD ---
    // The calendar year the player was drafted (e.g., 2019).
    // Undrafted players will have no value here.
    // Written by enrichPlayers.js from the DRAFT_YEAR field in commonplayerinfo.
    draftYear: {
      type: Number,
    },

    // --- NEW FIELD ---
    // The player's overall draft selection number (e.g., 3 for third pick).
    // Minimum value of 1. Undrafted players will have no value here.
    // Written by enrichPlayers.js from the DRAFT_NUMBER field in commonplayerinfo.
    draftPick: {
      type: Number,
      min: 1,
    },

    // --- NEW FIELD ---
    // URL to the player's official NBA headshot image.
    // Constructed by enrichPlayers.js using the NBA CDN pattern:
    // https://cdn.nba.com/headshots/nba/latest/1040x760/{nbaId}.png
    imageUrl: {
      type: String,
      trim: true,
    },

    // Reference to the Team document this player currently belongs to.
    // Required — every player in our DB must be on an NBA roster.
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
  },
  // Automatically adds createdAt and updatedAt timestamps to every document.
  { timestamps: true },
);

module.exports = mongoose.model('Player', playerSchema);

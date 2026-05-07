const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    // --- NEW FIELD ---
    // The NBA Stats API's internal numeric team ID (e.g., 1610612738 for Boston Celtics).
    // This is written once by the syncTeamNbaIds.js script and never changes.
    // It is the bridge between our MongoDB documents and every NBA API response,
    // since the API identifies teams by this number rather than our ObjectId.
    // sparse: true means the unique index only applies to docs that have this field,
    // so existing docs without it won't conflict during the transition period before
    // the sync script has been run.
    nbaId: {
      type: Number,
      unique: true,
      sparse: true,
    },

    // Full team name as it appears in the NBA API (e.g., "Boston Celtics").
    // Must match exactly, since syncTeamNbaIds.js uses this field to look up teams.
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // City the team plays in (e.g., "Boston").
    city: {
      type: String,
      required: true,
      trim: true,
    },

    // Standard 2–3 letter abbreviation used throughout the NBA API (e.g., "BOS").
    // Used by nightlySync.js to resolve opponent teams from the MATCHUP field
    // (e.g., "BOS vs. MIA" → opponent abbreviation "MIA").
    abbreviation: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    // NBA conference this team belongs to. Restricted to the two valid values.
    conference: {
      type: String,
      enum: ['Eastern', 'Western'],
      required: true,
    },

    // NBA division within the conference.
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

    // URL to the team's official logo image. Populated optionally.
    logoUrl: {
      type: String,
      trim: true,
    },
    
    primaryColor: {
      type: String,
      trim: true,
    },

    secondaryColor: {
      type: String,
      trim: true,
    },

    // Array of ObjectId references to Player documents on this team's roster.
    // Written by seed.js and kept in sync when players are added or traded.
    roster: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
      },
    ],
  },
  // Automatically adds createdAt and updatedAt timestamps to every document.
  { timestamps: true },
);

module.exports = mongoose.model('Team', teamSchema);

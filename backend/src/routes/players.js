// Import Express and create a route for players
const express = require("express");
const router = express.Router();
const { getPlayers, getPlayerCareerStats } = require('../nbaApi');
const { rowsToObjects } = require('../utils/nbaUtils');
const PlayerSeasonStats = require('../models/PlayerSeasonStats');
const Player = require('../models/Player');

// for names that have accents
function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '');
}

/**
 * GET /api/players/search?q=<query>
 *
 * Searches the Player collection in MongoDB (not the NBA API) for players
 * whose first or last name matches the query string.
 * Returns up to 10 results: [{ _id, firstName, lastName }]
 * Returns [] if the query is empty or no players match.
 */
router.get('/players/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();

    if (!q) return res.json([]);

    // Case-insensitive regex match on either first or last name
    const regex = new RegExp(q, 'i');
    const players = await Player.find({
      $or: [{ firstName: regex }, { lastName: regex }],
    })
      .select('_id firstName lastName')
      .limit(10)
      .lean();

    res.json(players);
  } catch (error) {
    console.error('Error searching players:', error.message);
    res.status(500).json({ error: 'Failed to search players', details: error.message });
  }
});

/**
 * GET /api/players/top
 *
 * Returns the top 5 players in four stat categories:
 *   points   → avgPoints  (PPG)
 *   threes   → avgFg3m    (3PM)
 *   assists  → avgAssists (APG)
 *   rebounds → avgRebounds(RPG)
 *
 * Only players with gamesPlayed >= 10 qualify.
 * If a player appears in multiple season documents, their best season is used.
 * All stat values are per-game averages stored directly in PlayerSeasonStats.
 */
router.get('/players/top', async (req, res) => {
  try {
    const MIN_GAMES = 10;

    /**
     * Builds a MongoDB aggregation pipeline that:
     *  1. Filters to documents where gamesPlayed >= MIN_GAMES and nbaPlayerId exists
     *  2. Sorts by the target stat descending (so $first picks the best season)
     *  3. Groups by nbaPlayerId — deduplicates players across multiple seasons
     *  4. Re-sorts the deduplicated results by stat descending
     *  5. Limits to top 5
     *  6. Joins Player + Team documents for name and abbreviation
     */
    function topPipeline(statField) {
      return PlayerSeasonStats.aggregate([
        // Step 1: only qualified documents
        { $match: { gamesPlayed: { $gte: MIN_GAMES }, nbaPlayerId: { $ne: null } } },
        // Step 2: best season first for each player
        { $sort: { [statField]: -1 } },
        // Step 3: one doc per player (keeps the best-season row via $first)
        {
          $group: {
            _id:         '$nbaPlayerId',
            nbaPlayerId: { $first: '$nbaPlayerId' },
            statValue:   { $first: `$${statField}` },
            teamId:      { $first: '$teamId' },
            playerId:    { $first: '$playerId' },
          },
        },
        // Step 4: re-rank the deduplicated set
        { $sort: { statValue: -1 } },
        // Step 5: top 5 only
        { $limit: 5 },
        // Step 6a: join Player document for name
        {
          $lookup: {
            from:         'players',
            localField:   'playerId',
            foreignField: '_id',
            as:           'player',
          },
        },
        { $unwind: '$player' },
        // Step 6b: join Team document for abbreviation and color key
        {
          $lookup: {
            from:         'teams',
            localField:   'teamId',
            foreignField: '_id',
            as:           'team',
          },
        },
        { $unwind: '$team' },
        // Step 7: shape the output
        {
          $project: {
            _id:        0,
            nbaPlayerId: 1,
            statValue:   1,
            playerName: { $concat: ['$player.firstName', ' ', '$player.lastName'] },
            teamAbbr:   '$team.abbreviation',
          },
        },
      ]);
    }

    // Run all four queries in parallel
    const [points, threes, assists, rebounds] = await Promise.all([
      topPipeline('avgPoints'),
      topPipeline('avgFg3m'),
      topPipeline('avgAssists'),
      topPipeline('avgRebounds'),
    ]);

    res.json({ points, threes, assists, rebounds });
  } catch (error) {
    console.error('Error fetching top players:', error.message);
    res.status(500).json({ error: 'Failed to fetch top players', details: error.message });
  }
});

// Player route
router.get('/players', async (req, res) => {
  try {
    const currentOnly = req.query.currentOnly || '0';
    const search = normalizeText(req.query.search || '');

    const data = await getPlayers(currentOnly);

    const resultSet =
      data.resultSets?.find((set) => set.name === 'CommonAllPlayers') ||
      data.resultSet;

    if (!resultSet) {
      return res.status(500).json({ error: 'Player data missing' });
    }

    let players = rowsToObjects(resultSet).map((player) => ({
      playerId: player.PERSON_ID,
      fullName: player.DISPLAY_FIRST_LAST,
      teamId: player.TEAM_ID,
      team: player.TEAM_ABBREVIATION,
      teamName: player.TEAM_NAME,
      fromYear: player.FROM_YEAR,
      toYear: player.TO_YEAR,
      rosterStatus: player.ROSTERSTATUS,
    }));

    console.log(
      'JOKIC PLAYER:',
      players.find((player) => player.fullName === 'Nikola Jokic')
    );

    if (search) {
      players = players.filter((player) =>
        normalizeText(player.fullName).includes(search)
      );
    }

    console.log('FILTERED COUNT:', players.length);
    console.log('FIRST 5 FILTERED:', players.slice(0, 5));

    res.json(players);
  } catch (error) {
    console.error('Error fetching players:', error.message);

    res.status(500).json({
      error: 'Failed to fetch players',
      details: error.message,
    });
  }
});

// Career stats route
router.get('/players/:playerId/career', async (req, res) => {
  try {
    const { playerId } = req.params;

    const data = await getPlayerCareerStats(playerId);

    const resultSet = data.resultSets?.find(
      (set) => set.name === 'SeasonTotalsRegularSeason'
    );

    if (!resultSet) {
      return res.status(500).json({ error: 'Career stats missing' });
    }

    const seasons = rowsToObjects(resultSet).map((season) => ({
      season: season.SEASON_ID,
      teamId: season.TEAM_ID,
      team: season.TEAM_ABBREVIATION,
      gamesPlayed: season.GP,
      gamesStarted: season.GS,
      minutes: season.MIN,
      points: season.PTS,
      rebounds: season.REB,
      assists: season.AST,
      steals: season.STL,
      blocks: season.BLK,
      turnovers: season.TOV,
      fgPct: season.FG_PCT,
      fg3Pct: season.FG3_PCT,
      ftPct: season.FT_PCT,
    }));

    res.json({
      playerId,
      seasons,
    });
  } catch (error) {
    console.error('Error fetching player career stats:', error.message);

    res.status(500).json({
      error: 'Failed to fetch player career stats',
      details: error.message,
    });
  }
});

// Export this router so it can be used under /api in server.js
module.exports = router;

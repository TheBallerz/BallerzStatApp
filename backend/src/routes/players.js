'use strict';

const express           = require('express');
const router            = express.Router();
const Player            = require('../models/Player');
const PlayerSeasonStats = require('../models/PlayerSeasonStats');
const PlayerCareerStats = require('../models/PlayerCareerStats');
const PlayerGameStats   = require('../models/PlayerGameStats');

// Strips accents and lowercases a string for consistent search matching.
// Handles names like "Nikola Jokić" → "nikola jokic" so searches work
// regardless of whether the user types the accented form.
function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '');
}

/**
 * GET /api/players/search?q=<query>
 *
 * Searches the Player collection for players whose name matches the query.
 * Unchanged — already reads from MongoDB.
 */
router.get('/players/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);

    const regex   = new RegExp(q, 'i');
    const players = await Player.find({
      $or: [{ firstName: regex }, { lastName: regex }],
    })
      .select('_id firstName lastName nbaId')
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
 * Returns the top 5 players in four stat categories from PlayerSeasonStats.
 * Unchanged — already reads from MongoDB.
 */
router.get('/players/top', async (req, res) => {
  try {
    const MIN_GAMES = 10;

    function topPipeline(statField) {
      return PlayerSeasonStats.aggregate([
        { $match: { gamesPlayed: { $gte: MIN_GAMES }, nbaPlayerId: { $ne: null } } },
        { $sort: { [statField]: -1 } },
        {
          $group: {
            _id:         '$nbaPlayerId',
            nbaPlayerId: { $first: '$nbaPlayerId' },
            statValue:   { $first: `$${statField}` },
            teamId:      { $first: '$teamId' },
            playerId:    { $first: '$playerId' },
          },
        },
        { $sort: { statValue: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from:         'players',
            localField:   'playerId',
            foreignField: '_id',
            as:           'player',
          },
        },
        { $unwind: '$player' },
        {
          $lookup: {
            from:         'teams',
            localField:   'teamId',
            foreignField: '_id',
            as:           'team',
          },
        },
        { $unwind: '$team' },
        {
          $project: {
            _id:         0,
            nbaPlayerId: 1,
            statValue:   1,
            playerName: { $concat: ['$player.firstName', ' ', '$player.lastName'] },
            teamAbbr:   '$team.abbreviation',
          },
        },
      ]);
    }

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

/**
 * GET /api/players?search=<name>&currentOnly=0|1
 *
 * Returns all players in the Player collection with their current team.
 * Optional search filter matches against first or last name (accent-insensitive).
 * currentOnly is accepted for API compatibility but ignored — all players in
 * our collection are active-roster players.
 * Previously called getPlayers() live against the NBA API on every request.
 *
 * Response fields:
 *   playerId      — NBA player ID (nbaId), used by the career stats route
 *   fullName      — "First Last"
 *   teamId        — NBA numeric team ID
 *   team          — 3-letter abbreviation (e.g. "LAL"), used for colors
 *   teamName      — Full team name (e.g. "Lakers")
 *   fromYear      — Not stored in Player model; returns '' (displayed as "–")
 *   toYear        — Not stored in Player model; returns '' (displayed as "–")
 *   rosterStatus  — Always 1 (active) since all stored players are on rosters
 */
router.get('/players', async (req, res) => {
  try {
    const search = normalizeText(req.query.search || '');

    // Build a filter: if a search term is provided, match it case-insensitively
    // against either part of the player's name. No search = return everyone.
    const filter = {};
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ firstName: regex }, { lastName: regex }];
    }

    const players = await Player.find(filter)
      .populate('teamId', 'nbaId abbreviation name city')
      .lean();

    const result = players.map((p) => ({
      playerId:     p.nbaId,
      fullName:     `${p.firstName} ${p.lastName}`,
      teamId:       p.teamId?.nbaId        ?? 0,
      team:         p.teamId?.abbreviation ?? '',
      teamName:     p.teamId?.name         ?? '',
      // fromYear / toYear / rosterStatus are not stored in the Player model.
      // The frontend renders fromYear–toYear as "–" when both are empty, and
      // always shows the Active badge since rosterStatus is always 1 here.
      fromYear:     '',
      toYear:       '',
      rosterStatus: 1,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching players:', error.message);
    res.status(500).json({ error: 'Failed to fetch players', details: error.message });
  }
});

/**
 * GET /api/players/:playerId/career
 *
 * Returns career season-by-season stats for a single player.
 * :playerId is the NBA numeric player ID (nbaId).
 * Reads from PlayerCareerStats, populated once by runSync().
 * Previously called getPlayerCareerStats(playerId) live on every request.
 *
 * Note: gamesStarted is not stored in PlayerCareerStats (the NBA API's
 * PerGame career endpoint provides it, but it was omitted to keep storage lean).
 * It returns 0 in this response — the table column will show "0" for all rows.
 */
router.get('/players/:playerId/career', async (req, res) => {
  try {
    const nbaPlayerId = Number(req.params.playerId);

    if (isNaN(nbaPlayerId)) {
      return res.status(400).json({ error: 'playerId must be a numeric NBA player ID' });
    }

    const careerDocs = await PlayerCareerStats.find({ nbaPlayerId })
      .sort({ season: -1 })
      .lean();

    // Return an empty seasons array (not a 404) if no career data is found.
    // This can happen for players added to the DB after the initial career stats
    // ingestion — they'll appear in the player list but have no career table yet.
    const seasons = careerDocs.map((s) => ({
      season:       s.season,
      teamId:       0,          // NBA numeric team ID not stored; frontend doesn't use it
      team:         s.teamAbbr,
      gamesPlayed:  s.gamesPlayed,
      gamesStarted: 0,          // not stored in PlayerCareerStats
      minutes:      s.avgMinutes,
      points:       s.avgPoints,
      rebounds:     s.avgRebounds,
      assists:      s.avgAssists,
      steals:       s.avgSteals,
      blocks:       s.avgBlocks,
      turnovers:    s.avgTurnovers,
      fgPct:        s.fgPct,
      fg3Pct:       s.fg3Pct,
      ftPct:        s.ftPct,
    }));

    res.json({ playerId: String(nbaPlayerId), seasons });
  } catch (error) {
    console.error('Error fetching player career stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch player career stats', details: error.message });
  }
});

/**
 * GET /api/players/:nbaPlayerId/stats
 *
 * Returns season averages and last-game stats for a single player.
 * :nbaPlayerId is the NBA numeric player ID (nbaId on the Player document).
 *
 * Response:
 *   seasonAvg  — per-game season averages (pts, reb, ast, fg3m)
 *   lastGame   — stats from the player's most recent game in PlayerGameStats,
 *                or null if no game records exist (TTL expired / off-season)
 */
router.get('/players/:nbaPlayerId/stats', async (req, res) => {
  try {
    const nbaPlayerId = Number(req.params.nbaPlayerId);
    if (isNaN(nbaPlayerId)) {
      return res.status(400).json({ error: 'nbaPlayerId must be a numeric NBA player ID' });
    }

    const seasonStats = await PlayerSeasonStats.findOne({ nbaPlayerId }).lean();
    if (!seasonStats) {
      return res.status(404).json({ error: 'No season stats found for this player' });
    }

    const player = await Player.findOne({ nbaId: nbaPlayerId }).select('_id').lean();
    let lastGame = null;
    if (player) {
      const gameDoc = await PlayerGameStats.findOne({ playerId: player._id })
        .sort({ gameDate: -1 })
        .lean();
      if (gameDoc) {
        lastGame = {
          pts:  gameDoc.points,
          reb:  gameDoc.rebounds,
          ast:  gameDoc.assists,
          fg3m: gameDoc.threePointersMade,
        };
      }
    }

    res.json({
      seasonAvg: {
        pts:  seasonStats.avgPoints,
        reb:  seasonStats.avgRebounds,
        ast:  seasonStats.avgAssists,
        fg3m: seasonStats.avgFg3m,
      },
      lastGame,
    });
  } catch (error) {
    console.error('Error fetching player stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch player stats', details: error.message });
  }
});

module.exports = router;

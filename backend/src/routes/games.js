'use strict';

const express        = require('express');
const router         = express.Router();
const TeamGameStats  = require('../models/TeamGameStats');
const { CURRENT_SEASON } = require('../nbaApi');

/**
 * Formats a "YYYY-MM-DD" date string into a human-readable label (e.g. "Apr 28th").
 * The T12:00:00 suffix pins the parsed time to noon UTC so timezone offsets
 * can't shift the date to the previous or next day.
 */
function formatDate(dateStr) {
  const date   = new Date(dateStr + 'T12:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day    = date.getDate();
  const suffix = [11, 12, 13].includes(day) ? 'th'
    : day % 10 === 1 ? 'st'
    : day % 10 === 2 ? 'nd'
    : day % 10 === 3 ? 'rd' : 'th';
  return `${months[date.getMonth()]} ${day}${suffix}`;
}

/**
 * GET /api/games/recent
 *
 * Returns the 4 most recent days that had NBA games, each with a list of
 * completed games for that day (home team, away team, final scores).
 * Days with no games are skipped so the 4 frontend columns are always filled.
 *
 * Reads from TeamGameStats instead of calling getTeamGameLog() live.
 * Each game produces two TeamGameStats documents (one per team); the isHome
 * field distinguishes them so pairing doesn't need to re-parse the MATCHUP string.
 * Previously called getTeamGameLog() live against the NBA API on every request.
 */
router.get('/games/recent', async (req, res) => {
  try {
    // Fetch the past 14 days from MongoDB — this covers 4+ game days comfortably.
    const since = new Date();
    since.setDate(since.getDate() - 14);

    const docs = await TeamGameStats.find({
      season:   CURRENT_SEASON,
      gameDate: { $gte: since },
    })
      .populate('teamId', 'abbreviation')
      .sort({ gameDate: -1 })
      .lean();

    // Group the two documents per game (one home, one away) by nbaGameId.
    const gameMap = new Map();
    for (const doc of docs) {
      const id = doc.nbaGameId;
      if (!gameMap.has(id)) gameMap.set(id, []);
      gameMap.get(id).push(doc);
    }

    const games = [];
    for (const [gameId, rows] of gameMap) {
      if (rows.length < 2) continue; // skip if we only have one side stored

      const homeRow = rows.find((r) => r.isHome);
      const awayRow = rows.find((r) => !r.isHome);
      if (!homeRow || !awayRow) continue;

      // Format the date as "YYYY-MM-DD" for grouping and sorting.
      const dateStr = homeRow.gameDate.toISOString().slice(0, 10);

      games.push({
        gameId:   String(gameId),
        date:     dateStr,
        homeTeam: { abbr: homeRow.teamId?.abbreviation ?? '', score: homeRow.points },
        awayTeam: { abbr: awayRow.teamId?.abbreviation ?? '', score: awayRow.points },
      });
    }

    // Sort all games by date descending (most recent first).
    games.sort((a, b) => b.date.localeCompare(a.date));

    // Collect the 4 most recent distinct dates that had games.
    // Off-days are automatically skipped because we only have documents for
    // days when games were actually played.
    const dateOrder = [];
    const seen = new Set();
    for (const game of games) {
      if (!seen.has(game.date)) {
        seen.add(game.date);
        dateOrder.push(game.date);
        if (dateOrder.length === 4) break;
      }
    }

    const result = dateOrder.map((date) => ({
      date:  formatDate(date),
      games: games.filter((g) => g.date === date),
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching recent games:', error.message);
    res.status(500).json({ error: 'Failed to fetch recent games', details: error.message });
  }
});

module.exports = router;

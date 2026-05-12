'use strict';

const express = require('express');
const router  = express.Router();
const { getTeamGameLog } = require('../nbaApi');
const { rowsToObjects }  = require('../utils/nbaUtils');

/**
 * Formats a "YYYY-MM-DD" date string into a human-readable label (e.g. "Apr 28th").
 * Adding T12:00:00 prevents timezone shifts from moving the date to the previous day.
 */
function formatDate(dateStr) {
  const date   = new Date(dateStr + 'T12:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day    = date.getDate();
  const suffix = [11,12,13].includes(day) ? 'th'
    : day % 10 === 1 ? 'st'
    : day % 10 === 2 ? 'nd'
    : day % 10 === 3 ? 'rd' : 'th';
  return `${months[date.getMonth()]} ${day}${suffix}`;
}

/**
 * Returns the 4 most recent days that had NBA games, each with a list of
 * completed games for that day. Days with no games are skipped so the
 * 4 columns on the frontend are always populated.
 */
router.get('/games/recent', async (req, res) => {
  try {
    const data = await getTeamGameLog();

    const resultSet =
      data.resultSets?.find((s) => s.name === 'LeagueGameLog') ||
      data.resultSets?.[0];

    if (!resultSet) {
      return res.status(500).json({ error: 'Game log data missing' });
    }

    const rows = rowsToObjects(resultSet);
    const gameMap = new Map();
    for (const row of rows) {
      const id = row.GAME_ID;
      if (!gameMap.has(id)) gameMap.set(id, []);
      gameMap.get(id).push(row);
    }

    // Pair each game's two rows into a single { homeTeam, awayTeam } object.
    // The MATCHUP field identifies home vs. away:
    //   "LAL vs. GSW" → LAL is home (contains "vs.")
    //   "LAL @ GSW"   → LAL is away (contains "@")
    const games = [];
    for (const [gameId, teamRows] of gameMap) {
      if (teamRows.length < 2) continue; // skip incomplete pairs

      const homeRow = teamRows.find((r) => r.MATCHUP.includes('vs.'));
      const awayRow = teamRows.find((r) => r.MATCHUP.includes('@'));

      if (!homeRow || !awayRow) continue;

      games.push({
        gameId,
        date: homeRow.GAME_DATE, // "YYYY-MM-DD" — used for grouping and sorting
        homeTeam: { abbr: homeRow.TEAM_ABBREVIATION, score: homeRow.PTS },
        awayTeam: { abbr: awayRow.TEAM_ABBREVIATION, score: awayRow.PTS },
      });
    }

    // Sort all games by date descending (most recent first).
    games.sort((a, b) => b.date.localeCompare(a.date));

    // Collect the 4 most recent distinct dates that actually had games.
    // This skips off-days so the 4 frontend columns are always filled.
    const dateOrder = [];
    const seen = new Set();
    for (const game of games) {
      if (!seen.has(game.date)) {
        seen.add(game.date);
        dateOrder.push(game.date);
        if (dateOrder.length === 4) break;
      }
    }

    // Build the final grouped response.
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

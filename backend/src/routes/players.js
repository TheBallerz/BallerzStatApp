// Import Express and create a route for players
const express = require("express");
const router = express.Router();
const { getPlayers, getPlayerCareerStats } = require('../nbaApi');

// for names that have accents
function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '');
}

// Takes a result set from NBA API and returns an object for each row
function rowsToObjects(resultSet) {
  
  // Take headers property from resultSet and put it into a variable called headers
  // Take the rowSet property and put it into a variable called rowSet
  const headers = resultSet.headers || [];
  const rowSet = resultSet.rowSet || [];

  // Goes through each row and returns a new array
  return rowSet.map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });

    return obj;
  });
}

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

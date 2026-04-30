// Import Express and create a route for teams
const express = require("express");
const router = express.Router();
const { getTeams } = require("../nbaApi");
const { rowsToObjects } = require("../utils/nbaUtils");
const Team = require('../models/Team');

/**
 * GET /api/teams/search?q=<query>
 *
 * Searches the Team collection in MongoDB (not the NBA API) for teams
 * whose name matches the query string.
 * Returns all matching teams (max 30): [{ _id, name }]
 * Returns [] if the query is empty or no teams match.
 */
router.get('/teams/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();

    if (!q) return res.json([]);

    const regex = new RegExp(q, 'i');
    const teams = await Team.find({ name: regex })
      .select('_id name')
      .lean();

    res.json(teams);
  } catch (error) {
    console.error('Error searching teams:', error.message);
    res.status(500).json({ error: 'Failed to search teams', details: error.message });
  }
});

// GET /api/teams
router.get("/teams", async (req, res) => {
  try {
    const data = await getTeams();

    const resultSet =
      data.resultSets?.find((set) => set.name === "LeagueDashTeamStats") ||
      data.resultSets?.[0] ||
      data.resultSet;

    if (!resultSet) {
      return res.status(500).json({ error: "Team data missing" });
    }
    console.log(resultSet.headers);
    const teams = rowsToObjects(resultSet).map((team) => ({
      teamId: team.TEAM_ID,
      teamName: team.TEAM_NAME,
      wins: team.W,
      losses: team.L,
      winPct: team.W_PCT,
      points: team.PTS,
      rebounds: team.REB,
      assists: team.AST,
    }));

    res.json(teams);
  } catch (error) {
    console.error("Error fetching teams:", error.message);

    res.status(500).json({
      error: "Failed to fetch teams",
      details: error.message,
    });
  }
});

// Export this router so it can be used under /api in server.js
module.exports = router;

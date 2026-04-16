// Import Express and create a route for teams
const express = require("express");
const router = express.Router();
const { getTeams } = require("../nbaApi");
const { rowsToObjects } = require("../utils/nbaUtils");

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

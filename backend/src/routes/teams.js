// Import Express and create a route for teams
const express = require("express");
const router = express.Router();
const { getTeams, getTeamInfo, CURRENT_SEASON } = require("../nbaApi");
const { rowsToObjects } = require("../utils/nbaUtils");
const Team = require("../models/Team");

const TEAM_ABBREVIATIONS = {
  1610612737: "ATL",
  1610612738: "BOS",
  1610612751: "BKN",
  1610612766: "CHA",
  1610612741: "CHI",
  1610612739: "CLE",
  1610612742: "DAL",
  1610612743: "DEN",
  1610612765: "DET",
  1610612744: "GSW",
  1610612745: "HOU",
  1610612754: "IND",
  1610612746: "LAC",
  1610612747: "LAL",
  1610612763: "MEM",
  1610612748: "MIA",
  1610612749: "MIL",
  1610612750: "MIN",
  1610612740: "NOP",
  1610612752: "NYK",
  1610612760: "OKC",
  1610612753: "ORL",
  1610612755: "PHI",
  1610612756: "PHX",
  1610612757: "POR",
  1610612758: "SAC",
  1610612759: "SAS",
  1610612761: "TOR",
  1610612762: "UTA",
  1610612764: "WAS",
};

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

    const dbTeams = await Team.find();

    const dbTeamByAbbr = {};
    dbTeams.forEach((team) => {
      dbTeamByAbbr[team.abbreviation] = team;
    });

    const teams = rowsToObjects(resultSet).map((team) => {
      const abbreviation = TEAM_ABBREVIATIONS[team.TEAM_ID];
      const dbTeam = dbTeamByAbbr[abbreviation];

      return {
        teamId: team.TEAM_ID,
        teamName: dbTeam?.name || team.TEAM_NAME,
        teamAbbreviation: abbreviation,
        wins: team.W,
        losses: team.L,
        record: `${team.W}-${team.L}`,
        ppg: team.PTS,
        rpg: team.REB,
        apg: team.AST,
        fgPct: team.FG_PCT,

        // added from MongoDB
        mongoId: dbTeam?._id,
        primaryColor: dbTeam?.primaryColor,
        secondaryColor: dbTeam?.secondaryColor,
        logoUrl: dbTeam?.logoUrl,
        city: dbTeam?.city,
        conference: dbTeam?.conference,
        division: dbTeam?.division,
      };
    });

    res.json(teams);
  } catch (error) {
    console.error("Error fetching teams:", error.message);

    res.status(500).json({
      error: "Failed to fetch teams",
      details: error.message,
    });
  }
});

// GET /api/teams/:teamId
router.get('/teams/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const season = req.query.season || CURRENT_SEASON;

    const [teamsData, infoData] = await Promise.all([
      getTeams(season),
      getTeamInfo(teamId, season),
    ]);

    const teamsSet =
      teamsData.resultSets?.find((set) => set.name === 'LeagueDashTeamStats') ||
      teamsData.resultSet ||
      teamsData.resultSets?.[0];

    const infoSet =
      infoData.resultSets?.find((set) => set.name === 'TeamInfoCommon') ||
      infoData.resultSet ||
      infoData.resultSets?.[0];

    if (!teamsSet || !infoSet) {
      return res.status(500).json({ error: 'Team detail data missing' });
    }

    const allTeams = rowsToObjects(teamsSet);
    const teamStats = allTeams.find(
      (team) => String(team.TEAM_ID) === String(teamId)
    );

    const teamInfo = rowsToObjects(infoSet)[0];

    if (!teamStats || !teamInfo) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json({
      teamId: teamStats.TEAM_ID,
      city: teamInfo.TEAM_CITY,
      name: teamInfo.TEAM_NAME,
      abbreviation: teamInfo.TEAM_ABBREVIATION,
      conference: teamInfo.TEAM_CONFERENCE,
      division: teamInfo.TEAM_DIVISION,
      wins: teamStats.W,
      losses: teamStats.L,
      record: `${teamStats.W}-${teamStats.L}`,
      ppg: teamStats.PTS,
      rpg: teamStats.REB,
      apg: teamStats.AST,
      fgPct: teamStats.FG_PCT,
    });
  } catch (error) {
    console.error('Error fetching team detail:', error.message);
    res.status(500).json({
      error: 'Failed to fetch team detail',
      details: error.message,
    });
  }
});

// Export this router so it can be used under /api in server.js
module.exports = router;

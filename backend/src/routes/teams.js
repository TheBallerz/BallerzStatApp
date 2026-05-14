'use strict';

const express         = require('express');
const router          = express.Router();
const Team            = require('../models/Team');
const TeamSeasonStats = require('../models/TeamSeasonStats');
const { CURRENT_SEASON } = require('../nbaApi');

/**
 * GET /api/teams/search?q=<query>
 *
 * Searches the Team collection for teams whose name matches the query.
 * Unchanged — already reads from MongoDB.
 */
router.get('/teams/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);

    const regex = new RegExp(q, 'i');
    const teams = await Team.find({ name: regex })
      .select('_id name nbaId')
      .lean();

    res.json(teams);
  } catch (error) {
    console.error('Error searching teams:', error.message);
    res.status(500).json({ error: 'Failed to search teams', details: error.message });
  }
});

/**
 * GET /api/teams
 *
 * Returns all 30 teams with their current season stats.
 * Reads from Team (identity/colors) joined with TeamSeasonStats (W/L, averages).
 * Previously called getTeams() live against the NBA API on every request.
 */
router.get('/teams', async (req, res) => {
  try {
    const season   = req.query.season || CURRENT_SEASON;
    const allTeams = await Team.find({}).lean();
    const allStats = await TeamSeasonStats.find({ season }).lean();

    // Index season stats by teamId string for O(1) lookup below.
    const statsByTeamId = new Map(allStats.map((s) => [String(s.teamId), s]));

    const teams = allTeams.map((team) => {
      const stats = statsByTeamId.get(String(team._id));
      return {
        teamId:           team.nbaId,
        teamName:         team.name,
        teamAbbreviation: team.abbreviation,
        wins:             stats?.wins    ?? 0,
        losses:           stats?.losses  ?? 0,
        record:           `${stats?.wins ?? 0}-${stats?.losses ?? 0}`,
        ppg:              stats?.avgPoints   ?? 0,
        rpg:              stats?.avgRebounds ?? 0,
        apg:              stats?.avgAssists  ?? 0,
        fgPct:            stats?.fgPct       ?? 0,
        // MongoDB identity fields — used by the frontend for colors and logos
        mongoId:          team._id,
        primaryColor:     team.primaryColor,
        secondaryColor:   team.secondaryColor,
        logoUrl:          team.logoUrl,
        city:             team.city,
        conference:       team.conference,
        division:         team.division,
      };
    });

    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error.message);
    res.status(500).json({ error: 'Failed to fetch teams', details: error.message });
  }
});

/**
 * GET /api/teams/:teamId
 *
 * Returns detail for a single team by NBA numeric team ID (e.g. 1610612738).
 * Reads from Team + TeamSeasonStats.
 * Previously called getTeams() + getTeamInfo() live on every request.
 */
router.get('/teams/:teamId', async (req, res) => {
  try {
    const nbaTeamId = Number(req.params.teamId);
    const season    = req.query.season || CURRENT_SEASON;

    if (isNaN(nbaTeamId)) {
      return res.status(400).json({ error: 'teamId must be a numeric NBA team ID' });
    }

    const team = await Team.findOne({ nbaId: nbaTeamId }).lean();
    if (!team) {
      return res.status(404).json({ error: `Team not found for nbaId: ${nbaTeamId}` });
    }

    const stats = await TeamSeasonStats.findOne({ teamId: team._id, season }).lean();

    res.json({
      teamId:       team.nbaId,
      city:         team.city,
      name:         team.name,
      abbreviation: team.abbreviation,
      conference:   team.conference,
      division:     team.division,
      wins:         stats?.wins    ?? 0,
      losses:       stats?.losses  ?? 0,
      record:       `${stats?.wins ?? 0}-${stats?.losses ?? 0}`,
      ppg:          stats?.avgPoints   ?? 0,
      rpg:          stats?.avgRebounds ?? 0,
      apg:          stats?.avgAssists  ?? 0,
      fgPct:        stats?.fgPct       ?? 0,
    });
  } catch (error) {
    console.error('Error fetching team detail:', error.message);
    res.status(500).json({ error: 'Failed to fetch team detail', details: error.message });
  }
});

module.exports = router;

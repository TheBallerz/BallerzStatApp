'use strict';

const express         = require('express');
const router          = express.Router();
const Team            = require('../models/Team');
const TeamSeasonStats = require('../models/TeamSeasonStats');
const TeamGameStats   = require('../models/TeamGameStats');
const GameSchedule    = require('../models/GameSchedule');
const { CURRENT_SEASON } = require('../nbaApi');

// Returns the ordinal suffix for a positive integer (1→'st', 2→'nd', etc.).
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Reformats "7:30 pm ET" → "7:30 PM", leaving other strings unchanged.
function formatStartTime(raw) {
  if (!raw) return '';
  return raw.replace(/(\d+:\d+)\s*(am|pm)\s*(ET)?/i, (_, time, ampm) =>
    `${time} ${ampm.toUpperCase()}`
  ).trim();
}

// Returns 'Today', 'Tomorrow', or a short date string (e.g. 'Mon May 18').
// Comparison is done in local time so midnight boundaries are intuitive.
function formatGameDate(gameDate) {
  const game   = new Date(gameDate);
  const now    = new Date();
  const today  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tmrw   = new Date(today.getTime() + 86_400_000);
  const gamDay = new Date(game.getFullYear(), game.getMonth(), game.getDate());

  if (gamDay.getTime() === today.getTime()) return 'Today';
  if (gamDay.getTime() === tmrw.getTime())  return 'Tomorrow';
  return game.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

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
      fg3m:         stats?.avgFg3m     ?? 0,
      fgPct:        stats?.fgPct       ?? 0,
    });
  } catch (error) {
    console.error('Error fetching team detail:', error.message);
    res.status(500).json({ error: 'Failed to fetch team detail', details: error.message });
  }
});

/**
 * GET /api/teams/:nbaTeamId/summary
 *
 * Returns a compact summary card payload for a single team:
 *   record   — { wins, losses } from TeamSeasonStats
 *   rank     — e.g. "4th in West", derived by sorting all teams in the same
 *              conference by win% and finding this team's position
 *   lastGame — most recent TeamGameStats doc: result, scores, opponent abbr
 *   nextGame — next GameSchedule doc: opponent abbr, formatted date + time
 *              (null if no upcoming game is found)
 *
 * All data is read exclusively from MongoDB — no live NBA API calls.
 */
router.get('/teams/:nbaTeamId/summary', async (req, res) => {
  try {
    const nbaTeamId = Number(req.params.nbaTeamId);
    if (isNaN(nbaTeamId)) {
      return res.status(400).json({ error: 'nbaTeamId must be a numeric NBA team ID' });
    }

    // ── 1. Resolve the team document ──────────────────────────────────────────
    const team = await Team.findOne({ nbaId: nbaTeamId }).lean();
    if (!team) {
      return res.status(404).json({ error: `No team found for nbaId ${nbaTeamId}` });
    }

    // ── 2. Season record ──────────────────────────────────────────────────────
    const seasonStats = await TeamSeasonStats.findOne({
      teamId: team._id,
      season: CURRENT_SEASON,
    }).lean();

    const wins   = seasonStats?.wins   ?? 0;
    const losses = seasonStats?.losses ?? 0;

    // ── 3. Conference rank ────────────────────────────────────────────────────
    // Pull all season stats, populate team conference, filter to this conference,
    // sort by win%, and find the 1-based position of this team.
    const allSeasonStats = await TeamSeasonStats.find({ season: CURRENT_SEASON })
      .populate({ path: 'teamId', select: 'conference _id' })
      .lean();

    const confStats = allSeasonStats.filter(
      (s) => s.teamId?.conference === team.conference
    );
    confStats.sort((a, b) => {
      const aWinPct = (a.wins + a.losses) > 0 ? a.wins / (a.wins + a.losses) : 0;
      const bWinPct = (b.wins + b.losses) > 0 ? b.wins / (b.wins + b.losses) : 0;
      return bWinPct - aWinPct;
    });

    const rankPos  = confStats.findIndex((s) => String(s.teamId?._id) === String(team._id)) + 1;
    const confShort = team.conference === 'Eastern' ? 'East' : 'West';
    const rank     = rankPos > 0 ? `${ordinal(rankPos)} in ${confShort}` : '--';

    // ── 4. Last game ──────────────────────────────────────────────────────────
    const lastGameDoc = await TeamGameStats.findOne({ teamId: team._id })
      .sort({ gameDate: -1 })
      .populate({ path: 'opponentTeamId', select: 'abbreviation' })
      .lean();

    const lastGame = lastGameDoc
      ? {
          result:    lastGameDoc.result,       // 'W' or 'L'
          teamScore: lastGameDoc.points,
          oppScore:  lastGameDoc.oppPoints,
          oppAbbr:   lastGameDoc.opponentTeamId?.abbreviation ?? '???',
        }
      : null;

    // ── 5. Next game ──────────────────────────────────────────────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const nextGameDoc = await GameSchedule.findOne({
      $or:    [{ homeTeamId: team._id }, { awayTeamId: team._id }],
      gameDate: { $gte: todayStart },
      status: { $ne: 'Final' },
    })
      .sort({ gameDate: 1 })
      .populate('homeTeamId', 'abbreviation _id')
      .populate('awayTeamId', 'abbreviation _id')
      .lean();

    let nextGame = null;
    if (nextGameDoc) {
      const isHome = String(nextGameDoc.homeTeamId?._id) === String(team._id);
      const oppAbbr = isHome
        ? nextGameDoc.awayTeamId?.abbreviation
        : nextGameDoc.homeTeamId?.abbreviation;
      nextGame = {
        oppAbbr:   oppAbbr ?? '???',
        gameDate:  formatGameDate(nextGameDoc.gameDate),
        startTime: formatStartTime(nextGameDoc.startTime),
      };
    }

    res.json({ record: { wins, losses }, rank, lastGame, nextGame });
  } catch (error) {
    console.error('Error fetching team summary:', error.message);
    res.status(500).json({ error: 'Failed to fetch team summary', details: error.message });
  }
});

router.get('/teams/:nbaTeamId/games', async (req, res) => {
  try {
    const nbaTeamId = Number(req.params.nbaTeamId);
    if (isNaN(nbaTeamId)) return res.status(400).json({ error: 'Invalid team ID' });

    const team = await Team.findOne({ nbaId: nbaTeamId }).select('_id').lean();
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const games = await TeamGameStats.find({ teamId: team._id })
      .sort({ gameDate: 1 })
      .select('gameDate points rebounds assists steals blocks turnovers threePointersMade')
      .lean();

    res.json(games.map((g) => ({
      date: g.gameDate,
      pts:  g.points,
      reb:  g.rebounds,
      ast:  g.assists,
      stl:  g.steals,
      blk:  g.blocks,
      tov:  g.turnovers,
      fg3m: g.threePointersMade,
    })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch team game log' });
  }
});

module.exports = router;

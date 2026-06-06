'use strict';

const express        = require('express');
const router         = express.Router();
const GameSchedule   = require('../models/GameSchedule');
const Team           = require('../models/Team');
const TeamGameStats  = require('../models/TeamGameStats');
const { CURRENT_SEASON } = require('../nbaApi');

/**
 * GET /api/schedule/today
 *
 * Returns every NBA game scheduled for today, read from the GameSchedule
 * collection populated by runSync(). Scores and status reflect the most
 * recent sync run.
 *
 * Response shape matches the TodayGame interface in SchedulePage.tsx:
 *   _id, gameDate, startTime, homeTeam, awayTeam, homeScore, awayScore, status
 *
 * homeTeam / awayTeam are populated Team documents shaped as:
 *   { _id: string, name, city, abbreviation, logoUrl }
 *
 * Previously called scoreboardv2 live against the NBA API on every request.
 *
 * Date matching: gameDate is stored as UTC midnight of the game day. We query
 * using today's UTC day boundaries so the match is timezone-safe on cloud servers.
 */
router.get('/schedule/today', async (req, res) => {
  try {
    // Build a [midnight, next-midnight) range for today in UTC.
    const now        = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfDay   = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const games = await GameSchedule.find({
      gameDate: { $gte: startOfDay, $lt: endOfDay },
    })
      .populate('homeTeamId', 'name city abbreviation logoUrl')
      .populate('awayTeamId', 'name city abbreviation logoUrl')
      .lean();

    const result = games.map((g) => {
      // Shape a populated Team doc into the { _id, name, city, abbreviation, logoUrl }
      // object the frontend expects. Fall back to a minimal placeholder if the
      // team reference wasn't resolved (e.g. a team not in our Team collection).
      const shapeTeam = (teamDoc, fallbackId) => teamDoc
        ? {
            _id:          String(teamDoc._id),
            name:         teamDoc.name,
            city:         teamDoc.city,
            abbreviation: teamDoc.abbreviation,
            logoUrl:      teamDoc.logoUrl ?? null,
          }
        : { _id: fallbackId, name: '', city: '', abbreviation: '???', logoUrl: null };

      return {
        _id:       g.nbaGameId,
        gameDate:  g.gameDate,
        startTime: g.startTime,
        homeTeam:  shapeTeam(g.homeTeamId, `${g.nbaGameId}_home`),
        awayTeam:  shapeTeam(g.awayTeamId, `${g.nbaGameId}_away`),
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        status:    g.status,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Error fetching today's schedule:", err.message);
    res.status(500).json({ error: "Failed to fetch today's schedule", details: err.message });
  }
});

/**
 * GET /api/schedule?team=LAL&season=2024-25
 *
 * Returns the full season game log for a single team.
 * Reads from TeamGameStats where teamId matches the given abbreviation and
 * season matches. Documents are sorted chronologically (oldest first) so the
 * frontend can render a season timeline without additional sorting.
 *
 * Response shape matches the TeamGame interface in SchedulePage.tsx:
 *   _id, gameDate, opponentTeamId (Team object), isHome, wl, points,
 *   oppPoints, rebounds, assists, steals, blocks, turnovers, plusMinus
 *
 * opponentTeamId is a populated Team object despite the field name — this
 * matches the existing frontend expectation (game.opponentTeamId.abbreviation).
 * plusMinus is computed as points − oppPoints since it is not stored directly.
 *
 * Previously called teamgamelog live against the NBA API on every request.
 */
router.get('/schedule', async (req, res) => {
  try {
    const abbr   = (req.query.team ?? '').toUpperCase();
    const season = req.query.season ?? CURRENT_SEASON;

    if (!abbr) {
      return res.status(400).json({ error: "'team' query param is required (e.g. ?team=LAL)" });
    }

    const team = await Team.findOne({ abbreviation: abbr }).lean();
    if (!team) {
      return res.status(404).json({ error: `Unknown team abbreviation: ${abbr}` });
    }

    const gameDocs = await TeamGameStats.find({ teamId: team._id, season })
      .populate('opponentTeamId', 'name city abbreviation logoUrl')
      .sort({ gameDate: 1 }) // chronological — oldest game first
      .lean();

    const games = gameDocs.map((doc) => {
      const opp = doc.opponentTeamId;
      return {
        _id:            String(doc._id),
        gameDate:       doc.gameDate,
        // opponentTeamId holds a shaped Team object — the field name is kept
        // to match the SchedulePage.tsx interface (game.opponentTeamId.abbreviation).
        opponentTeamId: opp
          ? {
              _id:          String(opp._id),
              name:         opp.name,
              city:         opp.city,
              abbreviation: opp.abbreviation,
              logoUrl:      opp.logoUrl ?? null,
            }
          : { _id: '', name: '', city: '', abbreviation: '???', logoUrl: null },
        isHome:    doc.isHome,
        wl:        doc.result,           // stored as 'W' or 'L' in TeamGameStats
        points:    doc.points,
        oppPoints: doc.oppPoints,
        rebounds:  doc.rebounds,
        assists:   doc.assists,
        steals:    doc.steals,
        blocks:    doc.blocks,
        turnovers: doc.turnovers,
        // plusMinus is not stored directly — derive it from points and oppPoints.
        plusMinus: (doc.points ?? 0) - (doc.oppPoints ?? 0),
      };
    });

    res.json(games);
  } catch (err) {
    console.error('Error fetching team schedule:', err.message);
    res.status(500).json({ error: 'Failed to fetch team schedule', details: err.message });
  }
});

module.exports = router;

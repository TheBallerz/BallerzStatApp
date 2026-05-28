const express = require('express');
const UserGameStats = require('../models/UserGameStats');
const UserSeasonStats = require('../models/UserSeasonStats');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ── Helper: recompute and upsert season averages for a user ────────────────────
async function recalcSeasonStats(userId) {
  const games = await UserGameStats.find({ userId }).lean();
  const count = games.length;

  if (count === 0) {
    await UserSeasonStats.findOneAndUpdate(
      { userId },
      {
        $set: {
          gamesPlayed: 0, avgPoints: 0, avgAssists: 0, avgRebounds: 0,
          avgFg3m: 0, avgSteals: 0, avgBlocks: 0, avgTurnovers: 0, avgMinutes: 0,
        },
      },
      { upsert: true },
    );
    return;
  }

  const sum = games.reduce(
    (acc, g) => ({
      points:            acc.points            + (g.points            || 0),
      assists:           acc.assists           + (g.assists           || 0),
      rebounds:          acc.rebounds          + (g.rebounds          || 0),
      threePointersMade: acc.threePointersMade + (g.threePointersMade || 0),
      steals:            acc.steals            + (g.steals            || 0),
      blocks:            acc.blocks            + (g.blocks            || 0),
      turnovers:         acc.turnovers         + (g.turnovers         || 0),
      minutes:           acc.minutes           + (g.minutes           || 0),
    }),
    { points: 0, assists: 0, rebounds: 0, threePointersMade: 0, steals: 0, blocks: 0, turnovers: 0, minutes: 0 },
  );

  const round2 = (v) => Math.round(v * 100) / 100;

  await UserSeasonStats.findOneAndUpdate(
    { userId },
    {
      $set: {
        gamesPlayed:  count,
        avgPoints:    round2(sum.points            / count),
        avgAssists:   round2(sum.assists           / count),
        avgRebounds:  round2(sum.rebounds          / count),
        avgFg3m:      round2(sum.threePointersMade / count),
        avgSteals:    round2(sum.steals            / count),
        avgBlocks:    round2(sum.blocks            / count),
        avgTurnovers: round2(sum.turnovers         / count),
        avgMinutes:   round2(sum.minutes           / count),
      },
    },
    { upsert: true },
  );
}

const ZEROS = {
  gamesPlayed: 0, avgPoints: 0, avgAssists: 0, avgRebounds: 0,
  avgFg3m: 0, avgSteals: 0, avgBlocks: 0, avgTurnovers: 0, avgMinutes: 0,
};

// GET /api/user/stats/season — own season averages
router.get('/stats/season', requireAuth, async (req, res) => {
  try {
    const stats = await UserSeasonStats.findOne({ userId: req.userId }).lean();
    res.json(stats || ZEROS);
  } catch {
    res.status(500).json({ message: 'Failed to load season stats.' });
  }
});

// GET /api/user/stats/season/:userId — any user's season averages (for friends)
router.get('/stats/season/:userId', requireAuth, async (req, res) => {
  try {
    const stats = await UserSeasonStats.findOne({ userId: req.params.userId }).lean();
    res.json(stats || ZEROS);
  } catch {
    res.status(500).json({ message: 'Failed to load season stats.' });
  }
});

// GET /api/user/stats/games — own game log
router.get('/stats/games', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const games = await UserGameStats.find({ userId: req.userId })
      .sort({ gameDate: -1 })
      .limit(limit)
      .lean();
    res.json(games);
  } catch {
    res.status(500).json({ message: 'Failed to load games.' });
  }
});

// POST /api/user/stats/games — log a new game
router.post('/stats/games', requireAuth, async (req, res) => {
  try {
    const {
      gameDate, opponent, points, assists, rebounds,
      threePointersMade, steals, blocks, turnovers, minutes,
    } = req.body;

    if (!gameDate || points === undefined || assists === undefined ||
        rebounds === undefined || threePointersMade === undefined) {
      return res.status(400).json({ message: 'gameDate, points, assists, rebounds, and threePointersMade are required.' });
    }

    const game = await UserGameStats.create({
      userId: req.userId,
      gameDate: new Date(gameDate),
      opponent:          opponent          || '',
      points:            Number(points)            || 0,
      assists:           Number(assists)           || 0,
      rebounds:          Number(rebounds)          || 0,
      threePointersMade: Number(threePointersMade) || 0,
      steals:            Number(steals)            || 0,
      blocks:            Number(blocks)            || 0,
      turnovers:         Number(turnovers)         || 0,
      minutes:           Number(minutes)           || 0,
    });

    await recalcSeasonStats(req.userId);
    res.status(201).json(game);
  } catch {
    res.status(500).json({ message: 'Failed to log game.' });
  }
});

// PATCH /api/user/stats/games/:gameId — edit a game
router.patch('/stats/games/:gameId', requireAuth, async (req, res) => {
  try {
    const game = await UserGameStats.findById(req.params.gameId);
    if (!game) return res.status(404).json({ message: 'Game not found.' });
    if (game.userId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    const allowed = ['gameDate','opponent','points','assists','rebounds','threePointersMade','steals','blocks','turnovers','minutes'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        update[key] = key === 'gameDate' ? new Date(req.body[key])
                    : key === 'opponent' ? req.body[key]
                    : Number(req.body[key]) || 0;
      }
    }

    const updated = await UserGameStats.findByIdAndUpdate(
      req.params.gameId,
      { $set: update },
      { new: true },
    );

    await recalcSeasonStats(req.userId);
    res.json(updated);
  } catch {
    res.status(500).json({ message: 'Failed to update game.' });
  }
});

// DELETE /api/user/stats/games/:gameId — delete a game
router.delete('/stats/games/:gameId', requireAuth, async (req, res) => {
  try {
    const game = await UserGameStats.findById(req.params.gameId);
    if (!game) return res.status(404).json({ message: 'Game not found.' });
    if (game.userId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    await game.deleteOne();
    await recalcSeasonStats(req.userId);
    res.json({ message: 'Game deleted.' });
  } catch {
    res.status(500).json({ message: 'Failed to delete game.' });
  }
});

module.exports = router;

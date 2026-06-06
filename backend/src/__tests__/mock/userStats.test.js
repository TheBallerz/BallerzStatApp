'use strict';

jest.mock('../../models/UserGameStats', () => ({
  find:              jest.fn(),
  findById:          jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create:            jest.fn(),
}));

jest.mock('../../models/UserSeasonStats', () => ({
  findOne:          jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

jest.mock('../../middleware/auth', () => ({
  requireAuth: (req, _res, next) => { req.userId = req._testUserId || 'user-id'; next(); },
}));

const router          = require('../../routes/userStats');
const UserGameStats   = require('../../models/UserGameStats');
const UserSeasonStats = require('../../models/UserSeasonStats');

// ── Helpers ───────────────────────────────────────────────────────────────────

function getHandler(path, method = 'get') {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method],
  );
  if (!layer) throw new Error(`${method.toUpperCase()} ${path} not found`);
  // stack[0] = requireAuth, stack[1] = handler
  return layer.route.stack[1].handle;
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

const ZEROS = {
  gamesPlayed: 0, avgPoints: 0, avgAssists: 0, avgRebounds: 0,
  avgFg3m: 0, avgSteals: 0, avgBlocks: 0, avgTurnovers: 0, avgMinutes: 0,
};

const SEASON_STATS = {
  userId: 'user-id',
  gamesPlayed: 5,
  avgPoints: 22.0,
  avgAssists: 5.0,
  avgRebounds: 8.0,
  avgFg3m: 2.0,
};

const GAME_DOC = {
  _id:               'game-1',
  userId:            'user-id',
  gameDate:          new Date('2025-03-01'),
  points:            25,
  assists:           6,
  rebounds:          9,
  threePointersMade: 2,
  steals:            1,
  blocks:            0,
  turnovers:         2,
  minutes:           35,
  toString() { return this.userId; },
};

// ── GET /stats/season ─────────────────────────────────────────────────────────

describe('GET /stats/season', () => {
  const handler = getHandler('/stats/season');

  beforeEach(() => jest.clearAllMocks());

  test('returns season stats for authenticated user', async () => {
    UserSeasonStats.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(SEASON_STATS) });

    const res = mockRes();
    await handler({ userId: 'user-id' }, res);

    expect(UserSeasonStats.findOne).toHaveBeenCalledWith({ userId: 'user-id' });
    expect(res.json).toHaveBeenCalledWith(SEASON_STATS);
  });

  test('returns ZEROS when no stats doc exists', async () => {
    UserSeasonStats.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const res = mockRes();
    await handler({ userId: 'user-id' }, res);

    expect(res.json).toHaveBeenCalledWith(ZEROS);
  });

  test('returns 500 on DB error', async () => {
    UserSeasonStats.findOne.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('db error')),
    });

    const res = mockRes();
    await handler({ userId: 'user-id' }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── GET /stats/season/:userId ─────────────────────────────────────────────────

describe('GET /stats/season/:userId', () => {
  const handler = getHandler('/stats/season/:userId');

  beforeEach(() => jest.clearAllMocks());

  test("returns another user's season stats", async () => {
    UserSeasonStats.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(SEASON_STATS) });

    const res = mockRes();
    await handler({ userId: 'admin-id', params: { userId: 'user-id' } }, res);

    expect(UserSeasonStats.findOne).toHaveBeenCalledWith({ userId: 'user-id' });
    expect(res.json).toHaveBeenCalledWith(SEASON_STATS);
  });

  test('returns ZEROS when target user has no stats', async () => {
    UserSeasonStats.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const res = mockRes();
    await handler({ userId: 'admin-id', params: { userId: 'user-id' } }, res);

    expect(res.json).toHaveBeenCalledWith(ZEROS);
  });
});

// ── GET /stats/games ──────────────────────────────────────────────────────────

describe('GET /stats/games', () => {
  const handler = getHandler('/stats/games');

  beforeEach(() => jest.clearAllMocks());

  test('returns game log for authenticated user', async () => {
    const mockLean  = jest.fn().mockResolvedValue([GAME_DOC]);
    const mockLimit = jest.fn().mockReturnValue({ lean: mockLean });
    const mockSort  = jest.fn().mockReturnValue({ limit: mockLimit });
    UserGameStats.find.mockReturnValue({ sort: mockSort });

    const res = mockRes();
    await handler({ userId: 'user-id', query: {} }, res);

    expect(mockLimit).toHaveBeenCalledWith(50);
    expect(res.json).toHaveBeenCalledWith([GAME_DOC]);
  });

  test('clamps limit to maximum of 100', async () => {
    const mockLean  = jest.fn().mockResolvedValue([]);
    const mockLimit = jest.fn().mockReturnValue({ lean: mockLean });
    const mockSort  = jest.fn().mockReturnValue({ limit: mockLimit });
    UserGameStats.find.mockReturnValue({ sort: mockSort });

    const res = mockRes();
    await handler({ userId: 'user-id', query: { limit: '200' } }, res);

    expect(mockLimit).toHaveBeenCalledWith(100);
  });

  test('returns 500 on DB error', async () => {
    const mockLimit = jest.fn().mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('db error')),
    });
    UserGameStats.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ limit: mockLimit }) });

    const res = mockRes();
    await handler({ userId: 'user-id', query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── POST /stats/games ─────────────────────────────────────────────────────────

describe('POST /stats/games', () => {
  const handler = getHandler('/stats/games', 'post');

  beforeEach(() => {
    jest.clearAllMocks();
    // recalcSeasonStats calls UserGameStats.find internally
    UserGameStats.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    UserSeasonStats.findOneAndUpdate.mockResolvedValue({});
  });

  test('creates game and returns 201', async () => {
    UserGameStats.create.mockResolvedValue({ ...GAME_DOC, _id: 'new-game' });

    const req = {
      userId: 'user-id',
      body: {
        gameDate: '2025-03-01',
        points: 25,
        assists: 6,
        rebounds: 9,
        threePointersMade: 2,
      },
    };
    const res = mockRes();
    await handler(req, res);

    expect(UserGameStats.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('returns 400 when required fields are missing', async () => {
    const req = {
      userId: 'user-id',
      body: { points: 25 }, // missing gameDate, assists, rebounds, threePointersMade
    };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'gameDate, points, assists, rebounds, and threePointersMade are required.',
    });
    expect(UserGameStats.create).not.toHaveBeenCalled();
  });

  test('returns 500 on DB create error', async () => {
    UserGameStats.create.mockRejectedValue(new Error('create failed'));

    const req = {
      userId: 'user-id',
      body: { gameDate: '2025-03-01', points: 0, assists: 0, rebounds: 0, threePointersMade: 0 },
    };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── PATCH /stats/games/:gameId ────────────────────────────────────────────────

describe('PATCH /stats/games/:gameId', () => {
  const handler = getHandler('/stats/games/:gameId', 'patch');

  beforeEach(() => {
    jest.clearAllMocks();
    UserGameStats.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    UserSeasonStats.findOneAndUpdate.mockResolvedValue({});
  });

  test('updates game and returns updated doc', async () => {
    const mockGame = { ...GAME_DOC, userId: { toString: () => 'user-id' } };
    UserGameStats.findById.mockResolvedValue(mockGame);
    UserGameStats.findByIdAndUpdate.mockResolvedValue({ ...mockGame, points: 30 });

    const req = {
      userId: 'user-id',
      params: { gameId: 'game-1' },
      body: { points: 30 },
    };
    const res = mockRes();
    await handler(req, res);

    expect(UserGameStats.findByIdAndUpdate).toHaveBeenCalledWith(
      'game-1',
      { $set: expect.objectContaining({ points: 30 }) },
      { new: true },
    );
    expect(res.json).toHaveBeenCalled();
  });

  test('returns 404 when game is not found', async () => {
    UserGameStats.findById.mockResolvedValue(null);

    const req = { userId: 'user-id', params: { gameId: 'nonexistent' }, body: {} };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Game not found.' });
  });

  test('returns 403 when game belongs to another user', async () => {
    const otherGame = { ...GAME_DOC, userId: { toString: () => 'other-user' } };
    UserGameStats.findById.mockResolvedValue(otherGame);

    const req = { userId: 'user-id', params: { gameId: 'game-1' }, body: {} };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized.' });
  });

  test('returns 500 on DB error', async () => {
    UserGameStats.findById.mockRejectedValue(new Error('db error'));

    const req = { userId: 'user-id', params: { gameId: 'game-1' }, body: {} };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── DELETE /stats/games/:gameId ───────────────────────────────────────────────

describe('DELETE /stats/games/:gameId', () => {
  const handler = getHandler('/stats/games/:gameId', 'delete');

  beforeEach(() => {
    jest.clearAllMocks();
    UserGameStats.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    UserSeasonStats.findOneAndUpdate.mockResolvedValue({});
  });

  test('deletes game and returns success message', async () => {
    const mockGame = {
      ...GAME_DOC,
      userId:     { toString: () => 'user-id' },
      deleteOne:  jest.fn().mockResolvedValue({}),
    };
    UserGameStats.findById.mockResolvedValue(mockGame);

    const req = { userId: 'user-id', params: { gameId: 'game-1' } };
    const res = mockRes();
    await handler(req, res);

    expect(mockGame.deleteOne).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: 'Game deleted.' });
  });

  test('returns 404 when game is not found', async () => {
    UserGameStats.findById.mockResolvedValue(null);

    const req = { userId: 'user-id', params: { gameId: 'nonexistent' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Game not found.' });
  });

  test('returns 403 when game belongs to another user', async () => {
    const otherGame = { ...GAME_DOC, userId: { toString: () => 'other-user' } };
    UserGameStats.findById.mockResolvedValue(otherGame);

    const req = { userId: 'user-id', params: { gameId: 'game-1' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized.' });
  });

  test('returns 500 on DB error', async () => {
    UserGameStats.findById.mockRejectedValue(new Error('db error'));

    const req = { userId: 'user-id', params: { gameId: 'game-1' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

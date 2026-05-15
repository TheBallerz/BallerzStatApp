// Mock the TeamGameStats model (Mock Object) and the nbaApi season constant (Stub)
jest.mock('../../models/TeamGameStats', () => ({ find: jest.fn() }));
jest.mock('../../nbaApi', () => ({ CURRENT_SEASON: '2024-25' }));

const TeamGameStats = require('../../models/TeamGameStats');
const router = require('../../routes/games');

// Extracts the route handler function from the Express router stack
function getHandler(path, method) {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method]
  );
  if (!layer) throw new Error(`${method.toUpperCase()} ${path} route not found`);
  return layer.route.stack[0].handle;
}

// Creates a mock response object with chainable status/json methods (Stub)
function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('GET /games/recent', () => {
  let handler;
  let mockLean;
  let mockSort;
  let mockPopulate;

  beforeAll(() => {
    handler = getHandler('/games/recent', 'get');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Set up the chained mock: find() → populate() → sort() → lean()
    mockLean = jest.fn();
    mockSort = jest.fn().mockReturnValue({ lean: mockLean });
    mockPopulate = jest.fn().mockReturnValue({ sort: mockSort });
    TeamGameStats.find.mockReturnValue({ populate: mockPopulate });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // req is a Dummy object — the /games/recent handler reads no query params
  const req = {};

  test('groups home and away docs into a single game entry', async () => {
    const gameDate = new Date('2025-04-28T12:00:00Z');

    // Stub: return two paired documents for the same nbaGameId
    mockLean.mockResolvedValue([
      {
        nbaGameId: 'g1',
        isHome: true,
        gameDate,
        points: 110,
        teamId: { abbreviation: 'LAL' },
      },
      {
        nbaGameId: 'g1',
        isHome: false,
        gameDate,
        points: 105,
        teamId: { abbreviation: 'GSW' },
      },
    ]);

    const res = mockRes();
    await handler(req, res);

    // Mock verification: confirm the DB was queried with the right season and date range
    expect(TeamGameStats.find).toHaveBeenCalledWith({
      season: '2024-25',
      gameDate: { $gte: expect.any(Date) },
    });
    expect(mockPopulate).toHaveBeenCalledWith('teamId', 'abbreviation');
    expect(mockSort).toHaveBeenCalledWith({ gameDate: -1 });

    const result = res.json.mock.calls[0][0];
    expect(result).toHaveLength(1);
    expect(result[0].games).toHaveLength(1);
    expect(result[0].games[0]).toMatchObject({
      gameId: 'g1',
      homeTeam: { abbr: 'LAL', score: 110 },
      awayTeam: { abbr: 'GSW', score: 105 },
    });
  });

  test('groups games across multiple dates and limits to 4 days', async () => {
    // Stub: 5 game days — handler should return only 4 most recent
    const makePair = (id, dateStr, homeAbbr, awayAbbr) => {
      const gameDate = new Date(`${dateStr}T12:00:00Z`);
      return [
        { nbaGameId: id, isHome: true, gameDate, points: 100, teamId: { abbreviation: homeAbbr } },
        { nbaGameId: id, isHome: false, gameDate, points: 95, teamId: { abbreviation: awayAbbr } },
      ];
    };

    mockLean.mockResolvedValue([
      ...makePair('g1', '2025-04-28', 'LAL', 'GSW'),
      ...makePair('g2', '2025-04-27', 'BOS', 'MIA'),
      ...makePair('g3', '2025-04-26', 'PHX', 'DEN'),
      ...makePair('g4', '2025-04-25', 'MIL', 'CHI'),
      ...makePair('g5', '2025-04-24', 'NYK', 'BKN'),
    ]);

    const res = mockRes();
    await handler(req, res);

    const result = res.json.mock.calls[0][0];
    // Only 4 of the 5 days should appear (most recent 4)
    expect(result).toHaveLength(4);
    expect(result[0].games[0].gameId).toBe('g1');
    expect(result[3].games[0].gameId).toBe('g4');
  });

  test('skips a game entry when only one team doc is stored', async () => {
    const gameDate = new Date('2025-04-28T12:00:00Z');

    // Stub: only one document for 'g2' — the away side is missing
    mockLean.mockResolvedValue([
      { nbaGameId: 'g2', isHome: true, gameDate, points: 100, teamId: { abbreviation: 'BOS' } },
    ]);

    const res = mockRes();
    await handler(req, res);

    const result = res.json.mock.calls[0][0];
    expect(result).toHaveLength(0);
  });

  test('skips a game when home/away pairing cannot be determined', async () => {
    const gameDate = new Date('2025-04-28T12:00:00Z');

    // Stub: two docs for 'g3' but both have isHome:true — no away row exists
    mockLean.mockResolvedValue([
      { nbaGameId: 'g3', isHome: true, gameDate, points: 100, teamId: { abbreviation: 'MIA' } },
      { nbaGameId: 'g3', isHome: true, gameDate, points: 98, teamId: { abbreviation: 'CHI' } },
    ]);

    const res = mockRes();
    await handler(req, res);

    const result = res.json.mock.calls[0][0];
    expect(result).toHaveLength(0);
  });

  test('returns empty array when no games exist in the past 14 days', async () => {
    // Stub: DB returns nothing
    mockLean.mockResolvedValue([]);

    const res = mockRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('returns 500 and error details when the DB query throws', async () => {
    // Mock: find() itself throws — verifies the catch block and error response
    TeamGameStats.find.mockImplementation(() => {
      throw new Error('DB connection failed');
    });

    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to fetch recent games',
      details: 'DB connection failed',
    });
  });
});

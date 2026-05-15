// Mock all Mongoose models (Mock Objects) and the nbaApi season constant (Stub)
jest.mock('../../models/GameSchedule',  () => ({ find: jest.fn() }));
jest.mock('../../models/Team',          () => ({ findOne: jest.fn() }));
jest.mock('../../models/TeamGameStats', () => ({ find: jest.fn() }));
jest.mock('../../nbaApi', () => ({ CURRENT_SEASON: '2024-25' }));

const GameSchedule  = require('../../models/GameSchedule');
const Team          = require('../../models/Team');
const TeamGameStats = require('../../models/TeamGameStats');
const router        = require('../../routes/schedule');

// Extracts the route handler from the Express router stack by path and method
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

// ---------------------------------------------------------------------------
// GET /schedule/today
// ---------------------------------------------------------------------------
describe('GET /schedule/today', () => {
  let handler;
  let mockLean;
  let mockPopulateAway;
  let mockPopulateHome;

  beforeAll(() => {
    handler = getHandler('/schedule/today', 'get');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Set up: find() → populate(homeTeamId) → populate(awayTeamId) → lean()
    mockLean = jest.fn();
    mockPopulateAway = jest.fn().mockReturnValue({ lean: mockLean });
    mockPopulateHome = jest.fn().mockReturnValue({ populate: mockPopulateAway });
    GameSchedule.find.mockReturnValue({ populate: mockPopulateHome });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // req is a Dummy — the /schedule/today handler reads no query params
  const req = {};

  test('returns shaped game objects with populated team documents', async () => {
    const gameDate = new Date('2025-05-15T00:00:00Z');

    // Stub: a single game with both teams populated
    mockLean.mockResolvedValue([
      {
        nbaGameId: 'game123',
        gameDate,
        startTime: '7:30 PM ET',
        homeTeamId: { _id: 'tid1', name: 'Lakers', city: 'Los Angeles', abbreviation: 'LAL', logoUrl: 'lal.png' },
        awayTeamId: { _id: 'tid2', name: 'Warriors', city: 'Golden State', abbreviation: 'GSW', logoUrl: 'gsw.png' },
        homeScore: 105,
        awayScore: 98,
        status: 'Final',
      },
    ]);

    const res = mockRes();
    await handler(req, res);

    // Mock verification: confirm the right fields were populated
    expect(mockPopulateHome).toHaveBeenCalledWith('homeTeamId', 'name city abbreviation logoUrl');
    expect(mockPopulateAway).toHaveBeenCalledWith('awayTeamId', 'name city abbreviation logoUrl');

    const result = res.json.mock.calls[0][0];
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      _id:       'game123',
      startTime: '7:30 PM ET',
      homeTeam:  { abbreviation: 'LAL', logoUrl: 'lal.png' },
      awayTeam:  { abbreviation: 'GSW', logoUrl: 'gsw.png' },
      homeScore: 105,
      awayScore: 98,
      status:    'Final',
    });
  });

  test('uses fallback team shape when team document is not populated', async () => {
    const gameDate = new Date('2025-05-15T00:00:00Z');

    // Stub: homeTeamId is null (team not in DB) — handler should use fallback
    mockLean.mockResolvedValue([
      {
        nbaGameId: 'game456',
        gameDate,
        startTime: '8:00 PM ET',
        homeTeamId: null,
        awayTeamId: { _id: 'tid3', name: 'Celtics', city: 'Boston', abbreviation: 'BOS', logoUrl: null },
        homeScore: 0,
        awayScore: 0,
        status: 'Scheduled',
      },
    ]);

    const res = mockRes();
    await handler(req, res);

    const result = res.json.mock.calls[0][0];
    expect(result[0].homeTeam).toMatchObject({ abbreviation: '???', logoUrl: null });
    expect(result[0].awayTeam).toMatchObject({ abbreviation: 'BOS' });
  });

  test('returns empty array when no games are scheduled today', async () => {
    // Stub: no games today
    mockLean.mockResolvedValue([]);

    const res = mockRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('returns 500 and error details when the DB query throws', async () => {
    // Mock: verify the error branch fires with the right response shape
    GameSchedule.find.mockImplementation(() => {
      throw new Error('Network timeout');
    });

    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to fetch today's schedule",
      details: 'Network timeout',
    });
  });
});

// ---------------------------------------------------------------------------
// GET /schedule
// ---------------------------------------------------------------------------
describe('GET /schedule', () => {
  let handler;
  let mockGameLean;
  let mockGameSort;
  let mockGamePopulate;

  // Reusable stub team document
  const TEAM_DOC = { _id: 'team1', name: 'Lakers', city: 'Los Angeles', abbreviation: 'LAL' };

  beforeAll(() => {
    handler = getHandler('/schedule', 'get');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Set up: find() → populate() → sort() → lean()
    mockGameLean = jest.fn();
    mockGameSort = jest.fn().mockReturnValue({ lean: mockGameLean });
    mockGamePopulate = jest.fn().mockReturnValue({ sort: mockGameSort });
    TeamGameStats.find.mockReturnValue({ populate: mockGamePopulate });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns 400 when the team query param is missing', async () => {
    // Dummy req: query object is present but has no team key
    const req = { query: {} };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "'team' query param is required (e.g. ?team=LAL)",
    });
    // Neither Team nor TeamGameStats should have been touched
    expect(Team.findOne).not.toHaveBeenCalled();
  });

  test('returns 404 when the team abbreviation is not in the database', async () => {
    // Stub: Team.findOne returns null (unknown abbreviation)
    Team.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const req = { query: { team: 'XYZ' } };
    const res = mockRes();

    await handler(req, res);

    // Mock verification: the right abbreviation was looked up
    expect(Team.findOne).toHaveBeenCalledWith({ abbreviation: 'XYZ' });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unknown team abbreviation: XYZ' });
  });

  test('returns game log with computed plusMinus for each game', async () => {
    // Stub: Team found, two game docs returned
    Team.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(TEAM_DOC) });

    const opp = { _id: 'opp1', name: 'Warriors', city: 'Golden State', abbreviation: 'GSW', logoUrl: null };
    mockGameLean.mockResolvedValue([
      {
        _id: 'doc1',
        gameDate: new Date('2025-01-10T00:00:00Z'),
        opponentTeamId: opp,
        isHome: true,
        result: 'W',
        points: 120,
        oppPoints: 110,
        rebounds: 45,
        assists: 25,
        steals: 8,
        blocks: 5,
        turnovers: 12,
      },
      {
        _id: 'doc2',
        gameDate: new Date('2025-01-12T00:00:00Z'),
        opponentTeamId: opp,
        isHome: false,
        result: 'L',
        points: 95,
        oppPoints: 102,
        rebounds: 38,
        assists: 20,
        steals: 6,
        blocks: 3,
        turnovers: 15,
      },
    ]);

    const req = { query: { team: 'LAL' } };
    const res = mockRes();

    await handler(req, res);

    // Mock verification: correct team and season passed to TeamGameStats
    expect(Team.findOne).toHaveBeenCalledWith({ abbreviation: 'LAL' });
    expect(TeamGameStats.find).toHaveBeenCalledWith({ teamId: 'team1', season: '2024-25' });
    expect(mockGamePopulate).toHaveBeenCalledWith('opponentTeamId', 'name city abbreviation logoUrl');
    expect(mockGameSort).toHaveBeenCalledWith({ gameDate: 1 });

    const games = res.json.mock.calls[0][0];
    expect(games).toHaveLength(2);
    expect(games[0]).toMatchObject({ wl: 'W', points: 120, oppPoints: 110, plusMinus: 10 });
    expect(games[1]).toMatchObject({ wl: 'L', points: 95,  oppPoints: 102, plusMinus: -7 });
  });

  test('uses the season query param when provided', async () => {
    Team.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(TEAM_DOC) });
    mockGameLean.mockResolvedValue([]);

    const req = { query: { team: 'LAL', season: '2023-24' } };
    const res = mockRes();
    await handler(req, res);

    expect(TeamGameStats.find).toHaveBeenCalledWith({ teamId: 'team1', season: '2023-24' });
  });

  test('uses fallback opponent shape when opponentTeamId is not populated', async () => {
    Team.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(TEAM_DOC) });

    mockGameLean.mockResolvedValue([
      {
        _id: 'doc3',
        gameDate: new Date('2025-01-10T00:00:00Z'),
        opponentTeamId: null,
        isHome: true,
        result: 'W',
        points: 115,
        oppPoints: 100,
        rebounds: 40,
        assists: 22,
        steals: 7,
        blocks: 4,
        turnovers: 10,
      },
    ]);

    const req = { query: { team: 'LAL' } };
    const res = mockRes();
    await handler(req, res);

    const games = res.json.mock.calls[0][0];
    expect(games[0].opponentTeamId).toMatchObject({ abbreviation: '???', logoUrl: null });
  });

  test('returns empty array when the team has no game documents', async () => {
    // Stub: team found, but no game records
    Team.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(TEAM_DOC) });
    mockGameLean.mockResolvedValue([]);

    const req = { query: { team: 'LAL' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('returns 500 when the DB query throws', async () => {
    // Mock: verify that errors are caught and return the right 500 shape
    Team.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(TEAM_DOC) });
    TeamGameStats.find.mockImplementation(() => {
      throw new Error('Query failed');
    });

    const req = { query: { team: 'LAL' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to fetch team schedule',
      details: 'Query failed',
    });
  });
});

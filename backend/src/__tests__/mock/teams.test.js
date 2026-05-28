'use strict';

jest.mock('../../models/Team', () => ({
  find:    jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../../models/TeamSeasonStats', () => ({
  find:    jest.fn(),
  findOne: jest.fn(),
}));

// CURRENT_SEASON is imported by the route for the default season value.
jest.mock('../../nbaApi', () => ({
  CURRENT_SEASON: '2024-25',
}));

const router        = require('../../routes/teams');
const Team          = require('../../models/Team');
const TeamSeasonStats = require('../../models/TeamSeasonStats');

// ── Helpers ───────────────────────────────────────────────────────────────────

function getHandler(path) {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods.get,
  );
  if (!layer) throw new Error(`GET ${path} not found in router`);
  return layer.route.stack[0].handle;
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

// ── Shared fixtures ───────────────────────────────────────────────────────────

const TEAM_DOC = {
  _id:           'mongo-id-bos',
  nbaId:         1610612738,
  name:          'Celtics',
  city:          'Boston',
  abbreviation:  'BOS',
  conference:    'Eastern',
  division:      'Atlantic',
  primaryColor:  '#007A33',
  secondaryColor: '#BA9653',
  logoUrl:       'https://example.com/bos.png',
};

const STATS_DOC = {
  teamId:       'mongo-id-bos',
  season:       '2024-25',
  wins:         64,
  losses:       18,
  avgPoints:    120.6,
  avgRebounds:  46.2,
  avgAssists:   29.1,
  fgPct:        0.487,
};

// ── GET /teams ────────────────────────────────────────────────────────────────

describe('GET /teams', () => {
  const handler = getHandler('/teams');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('returns all teams merged with season stats', async () => {
    Team.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([TEAM_DOC]) });
    TeamSeasonStats.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([STATS_DOC]) });

    const res = mockRes();
    await handler({ query: {} }, res);

    expect(Team.find).toHaveBeenCalledWith({});
    expect(TeamSeasonStats.find).toHaveBeenCalledWith({ season: '2024-25' });
    expect(res.json).toHaveBeenCalledWith([
      {
        teamId:           1610612738,
        teamName:         'Celtics',
        teamAbbreviation: 'BOS',
        wins:             64,
        losses:           18,
        record:           '64-18',
        ppg:              120.6,
        rpg:              46.2,
        apg:              29.1,
        fgPct:            0.487,
        mongoId:          'mongo-id-bos',
        primaryColor:     '#007A33',
        secondaryColor:   '#BA9653',
        logoUrl:          'https://example.com/bos.png',
        city:             'Boston',
        conference:       'Eastern',
        division:         'Atlantic',
      },
    ]);
  });

  test('defaults all stats to 0 when no season stats found for a team', async () => {
    Team.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([TEAM_DOC]) });
    TeamSeasonStats.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const res = mockRes();
    await handler({ query: {} }, res);

    const result = res.json.mock.calls[0][0][0];
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(0);
    expect(result.record).toBe('0-0');
    expect(result.ppg).toBe(0);
    expect(result.rpg).toBe(0);
    expect(result.apg).toBe(0);
    expect(result.fgPct).toBe(0);
  });

  test('uses provided season query param', async () => {
    Team.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    TeamSeasonStats.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const res = mockRes();
    await handler({ query: { season: '2023-24' } }, res);

    expect(TeamSeasonStats.find).toHaveBeenCalledWith({ season: '2023-24' });
  });

  test('returns empty array when no teams in DB', async () => {
    Team.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    TeamSeasonStats.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const res = mockRes();
    await handler({ query: {} }, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('returns 500 when DB throws', async () => {
    Team.find.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('db error')),
    });

    const res = mockRes();
    await handler({ query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error:   'Failed to fetch teams',
      details: 'db error',
    });
    expect(console.error).toHaveBeenCalledWith('Error fetching teams:', 'db error');
  });
});

// ── GET /teams/:teamId ────────────────────────────────────────────────────────

describe('GET /teams/:teamId', () => {
  const handler = getHandler('/teams/:teamId');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('returns team detail successfully', async () => {
    Team.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(TEAM_DOC) });
    TeamSeasonStats.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(STATS_DOC) });

    const req = { params: { teamId: '1610612738' }, query: {} };
    const res = mockRes();
    await handler(req, res);

    expect(Team.findOne).toHaveBeenCalledWith({ nbaId: 1610612738 });
    expect(res.json).toHaveBeenCalledWith({
      teamId:       1610612738,
      city:         'Boston',
      name:         'Celtics',
      abbreviation: 'BOS',
      conference:   'Eastern',
      division:     'Atlantic',
      wins:         64,
      losses:       18,
      record:       '64-18',
      ppg:          120.6,
      rpg:          46.2,
      apg:          29.1,
      fg3m:         0,
      fgPct:        0.487,
    });
  });

  test('returns 400 for non-numeric teamId', async () => {
    const req = { params: { teamId: 'abc' }, query: {} };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'teamId must be a numeric NBA team ID',
    });
    expect(Team.findOne).not.toHaveBeenCalled();
  });

  test('returns 404 when team not found in DB', async () => {
    Team.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const req = { params: { teamId: '9999999' }, query: {} };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Team not found for nbaId: 9999999',
    });
  });

  test('defaults stats to 0 when no season stats document found', async () => {
    Team.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(TEAM_DOC) });
    TeamSeasonStats.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const req = { params: { teamId: '1610612738' }, query: {} };
    const res = mockRes();
    await handler(req, res);

    const result = res.json.mock.calls[0][0];
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(0);
    expect(result.record).toBe('0-0');
    expect(result.ppg).toBe(0);
    expect(result.fgPct).toBe(0);
  });

  test('uses default season when query.season is not provided', async () => {
    Team.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(TEAM_DOC) });
    TeamSeasonStats.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const req = { params: { teamId: '1610612738' }, query: {} };
    const res = mockRes();
    await handler(req, res);

    expect(TeamSeasonStats.findOne).toHaveBeenCalledWith({
      teamId: TEAM_DOC._id,
      season: '2024-25',
    });
  });

  test('uses provided season query param', async () => {
    Team.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(TEAM_DOC) });
    TeamSeasonStats.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const req = { params: { teamId: '1610612738' }, query: { season: '2023-24' } };
    const res = mockRes();
    await handler(req, res);

    expect(TeamSeasonStats.findOne).toHaveBeenCalledWith({
      teamId: TEAM_DOC._id,
      season: '2023-24',
    });
  });

  test('returns 500 when DB throws', async () => {
    Team.findOne.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('boom')),
    });

    const req = { params: { teamId: '1610612738' }, query: {} };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error:   'Failed to fetch team detail',
      details: 'boom',
    });
  });
});

'use strict';

jest.mock('../../models/Team', () => ({
  find:    jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../../models/TeamSeasonStats', () => ({
  find:    jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../../models/TeamGameStats', () => ({
  find:    jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../../models/GameSchedule', () => ({
  findOne: jest.fn(),
}));

// CURRENT_SEASON is imported by the route for the default season value.
jest.mock('../../nbaApi', () => ({
  CURRENT_SEASON: '2024-25',
}));

const router          = require('../../routes/teams');
const Team            = require('../../models/Team');
const TeamSeasonStats = require('../../models/TeamSeasonStats');
const TeamGameStats   = require('../../models/TeamGameStats');
const GameSchedule    = require('../../models/GameSchedule');

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

// ── GET /teams/search ─────────────────────────────────────────────────────────

describe('GET /teams/search', () => {
  function getSearchHandler(path) {
    const layer = router.stack.find(
      (l) => l.route && l.route.path === path && l.route.methods.get,
    );
    if (!layer) throw new Error(`GET ${path} not found in router`);
    return layer.route.stack[0].handle;
  }

  const handler = getSearchHandler('/teams/search');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('returns matching teams when q is provided', async () => {
    const searchResult = [{ _id: 'mongo-id-bos', name: 'Celtics', nbaId: 1610612738 }];
    const leanChain = { lean: jest.fn().mockResolvedValue(searchResult) };
    const selectChain = { select: jest.fn().mockReturnValue(leanChain) };
    Team.find.mockReturnValue(selectChain);

    const res = mockRes();
    await handler({ query: { q: 'Celtics' } }, res);

    expect(Team.find).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(searchResult);
  });

  test('returns empty array when q is empty', async () => {
    const res = mockRes();
    await handler({ query: { q: '' } }, res);

    expect(Team.find).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('returns empty array when q is not provided', async () => {
    const res = mockRes();
    await handler({ query: {} }, res);

    expect(Team.find).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('returns 500 when DB throws', async () => {
    const leanChain = { lean: jest.fn().mockRejectedValue(new Error('search boom')) };
    const selectChain = { select: jest.fn().mockReturnValue(leanChain) };
    Team.find.mockReturnValue(selectChain);

    const res = mockRes();
    await handler({ query: { q: 'Lakers' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error:   'Failed to search teams',
      details: 'search boom',
    });
  });
});

// ── GET /teams/:nbaTeamId/summary ─────────────────────────────────────────────

describe('GET /teams/:nbaTeamId/summary', () => {
  function getSummaryHandler(path) {
    const layer = router.stack.find(
      (l) => l.route && l.route.path === path && l.route.methods.get,
    );
    if (!layer) throw new Error(`GET ${path} not found in router`);
    return layer.route.stack[0].handle;
  }

  const handler = getSummaryHandler('/teams/:nbaTeamId/summary');

  const TEAM_DOC_SUMMARY = {
    _id:        'mongo-id-bos',
    nbaId:      1610612738,
    name:       'Celtics',
    city:       'Boston',
    abbreviation: 'BOS',
    conference: 'Eastern',
    division:   'Atlantic',
  };

  const STATS_DOC_SUMMARY = {
    teamId:  { _id: 'mongo-id-bos', conference: 'Eastern' },
    season:  '2024-25',
    wins:    64,
    losses:  18,
  };

  const LAST_GAME_DOC = {
    result:         'W',
    points:         120,
    oppPoints:      110,
    opponentTeamId: { abbreviation: 'MIA' },
  };

  const NEXT_GAME_DOC = {
    gameDate:   new Date(Date.now() + 86400000),
    startTime:  '7:30 pm ET',
    homeTeamId: { _id: 'mongo-id-bos', abbreviation: 'BOS' },
    awayTeamId: { _id: 'mongo-id-mia', abbreviation: 'MIA' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('returns full summary with lastGame and nextGame', async () => {
    Team.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(TEAM_DOC_SUMMARY) });
    TeamSeasonStats.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(STATS_DOC_SUMMARY) });

    const allStatsLeanChain   = { lean: jest.fn().mockResolvedValue([STATS_DOC_SUMMARY]) };
    const allStatsPopChain    = { populate: jest.fn().mockReturnValue(allStatsLeanChain) };
    TeamSeasonStats.find.mockReturnValue(allStatsPopChain);

    const lastGameLeanChain   = { lean: jest.fn().mockResolvedValue(LAST_GAME_DOC) };
    const lastGamePopChain    = { populate: jest.fn().mockReturnValue(lastGameLeanChain) };
    const lastGameSortChain   = { sort: jest.fn().mockReturnValue(lastGamePopChain) };
    TeamGameStats.findOne.mockReturnValue(lastGameSortChain);

    const nextGameLeanChain   = { lean: jest.fn().mockResolvedValue(NEXT_GAME_DOC) };
    const nextGamePop2Chain   = { lean: nextGameLeanChain.lean, populate: jest.fn().mockReturnValue(nextGameLeanChain) };
    const nextGamePop1Chain   = { populate: jest.fn().mockReturnValue(nextGamePop2Chain) };
    const nextGameSortChain   = { sort: jest.fn().mockReturnValue(nextGamePop1Chain) };
    GameSchedule.findOne.mockReturnValue(nextGameSortChain);

    const req = { params: { nbaTeamId: '1610612738' } };
    const res = mockRes();
    await handler(req, res);

    expect(Team.findOne).toHaveBeenCalledWith({ nbaId: 1610612738 });
    const result = res.json.mock.calls[0][0];
    expect(result).toHaveProperty('record', { wins: 64, losses: 18 });
    expect(result).toHaveProperty('rank');
    expect(result).toHaveProperty('lastGame');
    expect(result.lastGame).toMatchObject({ result: 'W', teamScore: 120, oppScore: 110, oppAbbr: 'MIA' });
    expect(result).toHaveProperty('nextGame');
    expect(result.nextGame).toMatchObject({ oppAbbr: 'MIA' });
  });

  test('returns nextGame null when no upcoming GameSchedule doc', async () => {
    Team.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(TEAM_DOC_SUMMARY) });
    TeamSeasonStats.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(STATS_DOC_SUMMARY) });

    const allStatsLeanChain = { lean: jest.fn().mockResolvedValue([STATS_DOC_SUMMARY]) };
    const allStatsPopChain  = { populate: jest.fn().mockReturnValue(allStatsLeanChain) };
    TeamSeasonStats.find.mockReturnValue(allStatsPopChain);

    const lastGameLeanChain = { lean: jest.fn().mockResolvedValue(LAST_GAME_DOC) };
    const lastGamePopChain  = { populate: jest.fn().mockReturnValue(lastGameLeanChain) };
    const lastGameSortChain = { sort: jest.fn().mockReturnValue(lastGamePopChain) };
    TeamGameStats.findOne.mockReturnValue(lastGameSortChain);

    const nextGameLeanChain = { lean: jest.fn().mockResolvedValue(null) };
    const nextGamePop2Chain = { lean: nextGameLeanChain.lean, populate: jest.fn().mockReturnValue(nextGameLeanChain) };
    const nextGamePop1Chain = { populate: jest.fn().mockReturnValue(nextGamePop2Chain) };
    const nextGameSortChain = { sort: jest.fn().mockReturnValue(nextGamePop1Chain) };
    GameSchedule.findOne.mockReturnValue(nextGameSortChain);

    const req = { params: { nbaTeamId: '1610612738' } };
    const res = mockRes();
    await handler(req, res);

    const result = res.json.mock.calls[0][0];
    expect(result.nextGame).toBeNull();
  });

  test('returns 400 for non-numeric nbaTeamId', async () => {
    const req = { params: { nbaTeamId: 'abc' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'nbaTeamId must be a numeric NBA team ID',
    });
    expect(Team.findOne).not.toHaveBeenCalled();
  });

  test('returns 404 when team not found', async () => {
    Team.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const req = { params: { nbaTeamId: '9999999' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No team found for nbaId 9999999',
    });
  });

  test('returns 500 when DB throws', async () => {
    Team.findOne.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('summary boom')),
    });

    const req = { params: { nbaTeamId: '1610612738' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error:   'Failed to fetch team summary',
      details: 'summary boom',
    });
  });
});

// ── GET /teams/:nbaTeamId/games ───────────────────────────────────────────────

describe('GET /teams/:nbaTeamId/games', () => {
  function getGamesHandler(path) {
    const layer = router.stack.find(
      (l) => l.route && l.route.path === path && l.route.methods.get,
    );
    if (!layer) throw new Error(`GET ${path} not found in router`);
    return layer.route.stack[0].handle;
  }

  const handler = getGamesHandler('/teams/:nbaTeamId/games');

  const GAME_DOC = {
    gameDate:          new Date('2025-01-15'),
    points:            120,
    rebounds:          45,
    assists:           28,
    steals:            7,
    blocks:            5,
    turnovers:         12,
    threePointersMade: 14,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('returns mapped game log for valid team', async () => {
    const teamChain   = { lean: jest.fn().mockResolvedValue({ _id: 'mongo-id-bos' }) };
    const teamSelect  = { select: jest.fn().mockReturnValue(teamChain) };
    Team.findOne.mockReturnValue(teamSelect);

    const gameLeanChain   = { lean: jest.fn().mockResolvedValue([GAME_DOC]) };
    const gameSelectChain = { select: jest.fn().mockReturnValue(gameLeanChain) };
    const gameSortChain   = { sort: jest.fn().mockReturnValue(gameSelectChain) };
    TeamGameStats.find.mockReturnValue(gameSortChain);

    const req = { params: { nbaTeamId: '1610612738' } };
    const res = mockRes();
    await handler(req, res);

    expect(Team.findOne).toHaveBeenCalledWith({ nbaId: 1610612738 });
    expect(res.json).toHaveBeenCalledWith([
      {
        date: GAME_DOC.gameDate,
        pts:  120,
        reb:  45,
        ast:  28,
        stl:  7,
        blk:  5,
        tov:  12,
        fg3m: 14,
      },
    ]);
  });

  test('returns 400 for non-numeric nbaTeamId', async () => {
    const req = { params: { nbaTeamId: 'abc' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid team ID' });
    expect(Team.findOne).not.toHaveBeenCalled();
  });

  test('returns 404 when team not found', async () => {
    const teamChain  = { lean: jest.fn().mockResolvedValue(null) };
    const teamSelect = { select: jest.fn().mockReturnValue(teamChain) };
    Team.findOne.mockReturnValue(teamSelect);

    const req = { params: { nbaTeamId: '9999999' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Team not found' });
    expect(TeamGameStats.find).not.toHaveBeenCalled();
  });

  test('returns 500 when DB throws', async () => {
    const teamChain  = { lean: jest.fn().mockRejectedValue(new Error('games boom')) };
    const teamSelect = { select: jest.fn().mockReturnValue(teamChain) };
    Team.findOne.mockReturnValue(teamSelect);

    const req = { params: { nbaTeamId: '1610612738' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch team game log' });
  });
});

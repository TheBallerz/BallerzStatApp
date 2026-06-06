'use strict';

jest.mock('../../models/Player', () => ({
  find:    jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../../models/PlayerSeasonStats', () => ({
  aggregate: jest.fn(),
  findOne:   jest.fn(),
}));

jest.mock('../../models/PlayerCareerStats', () => ({
  find: jest.fn(),
}));

jest.mock('../../models/PlayerGameStats', () => ({
  find:    jest.fn(),
  findOne: jest.fn(),
}));

const router              = require('../../routes/players');
const Player              = require('../../models/Player');
const PlayerSeasonStats   = require('../../models/PlayerSeasonStats');
const PlayerCareerStats   = require('../../models/PlayerCareerStats');
const PlayerGameStats     = require('../../models/PlayerGameStats');

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
  _id:          'mongo-id-den',
  nbaId:        1610612743,
  abbreviation: 'DEN',
  name:         'Nuggets',
  city:         'Denver',
};

const PLAYER_DOC = {
  _id:       'mongo-id-jokic',
  nbaId:     203999,
  firstName: 'Nikola',
  lastName:  'Jokic',
  teamId:    TEAM_DOC,          // populated Team subdoc
};

const CAREER_DOC = {
  _id:           'career-doc-1',
  nbaPlayerId:   203999,
  season:        '2024-25',
  teamAbbr:      'DEN',
  gamesPlayed:   70,
  avgMinutes:    34.0,
  avgPoints:     26.4,
  avgRebounds:   12.1,
  avgAssists:    9.0,
  avgSteals:     1.4,
  avgBlocks:     0.8,
  avgTurnovers:  3.1,
  fgPct:         0.58,
  fg3Pct:        0.36,
  ftPct:         0.82,
};

// ── GET /players ──────────────────────────────────────────────────────────────

describe('GET /players', () => {
  const handler = getHandler('/players');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('returns all players mapped to response shape', async () => {
    const mockLean     = jest.fn().mockResolvedValue([PLAYER_DOC]);
    const mockPopulate = jest.fn().mockReturnValue({ lean: mockLean });
    Player.find.mockReturnValue({ populate: mockPopulate });

    const res = mockRes();
    await handler({ query: {} }, res);

    expect(Player.find).toHaveBeenCalledWith({});
    expect(mockPopulate).toHaveBeenCalledWith('teamId', 'nbaId abbreviation name city');
    expect(res.json).toHaveBeenCalledWith([
      {
        mongoId:       'mongo-id-jokic',
        nbaId:         203999,
        playerId:      203999,
        firstName:     'Nikola',
        lastName:      'Jokic',
        fullName:      'Nikola Jokic',
        imageUrl:      undefined,
        jerseyNumber:  undefined,
        position:      undefined,
        rosterStatus:  1,
        teamMongoId:   'mongo-id-den',
        teamId:        1610612743,
        team:          'DEN',
        teamName:      'Nuggets',
        fromYear:      '',
        toYear:        '',
      },
    ]);
  });

  test('returns empty array when no players in DB', async () => {
    const mockLean     = jest.fn().mockResolvedValue([]);
    const mockPopulate = jest.fn().mockReturnValue({ lean: mockLean });
    Player.find.mockReturnValue({ populate: mockPopulate });

    const res = mockRes();
    await handler({ query: {} }, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('passes search filter when query.search is provided', async () => {
    const mockLean     = jest.fn().mockResolvedValue([PLAYER_DOC]);
    const mockPopulate = jest.fn().mockReturnValue({ lean: mockLean });
    Player.find.mockReturnValue({ populate: mockPopulate });

    const res = mockRes();
    await handler({ query: { search: 'jokic' } }, res);

    // The filter passed to Player.find should be an $or regex filter
    const filterArg = Player.find.mock.calls[0][0];
    expect(filterArg).toHaveProperty('$or');
    expect(filterArg.$or).toHaveLength(2);
  });

  test('fromYear, toYear, and rosterStatus are always constant values', async () => {
    const mockLean     = jest.fn().mockResolvedValue([PLAYER_DOC]);
    const mockPopulate = jest.fn().mockReturnValue({ lean: mockLean });
    Player.find.mockReturnValue({ populate: mockPopulate });

    const res = mockRes();
    await handler({ query: {} }, res);

    const result = res.json.mock.calls[0][0][0];
    expect(result.fromYear).toBe('');
    expect(result.toYear).toBe('');
    expect(result.rosterStatus).toBe(1);
  });

  test('defaults teamId to 0 and team/teamName to empty string when teamId is null', async () => {
    const playerNoTeam = { ...PLAYER_DOC, teamId: null };
    const mockLean     = jest.fn().mockResolvedValue([playerNoTeam]);
    const mockPopulate = jest.fn().mockReturnValue({ lean: mockLean });
    Player.find.mockReturnValue({ populate: mockPopulate });

    const res = mockRes();
    await handler({ query: {} }, res);

    const result = res.json.mock.calls[0][0][0];
    expect(result.teamId).toBe(0);
    expect(result.team).toBe('');
    expect(result.teamName).toBe('');
  });

  test('returns 500 when DB throws', async () => {
    const mockPopulate = jest.fn().mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('db fail')),
    });
    Player.find.mockReturnValue({ populate: mockPopulate });

    const res = mockRes();
    await handler({ query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error:   'Failed to fetch players',
      details: 'db fail',
    });
    expect(console.error).toHaveBeenCalledWith('Error fetching players:', 'db fail');
  });
});

// ── GET /players/:playerId/career ─────────────────────────────────────────────

describe('GET /players/:playerId/career', () => {
  const handler = getHandler('/players/:playerId/career');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('returns career seasons mapped to response shape', async () => {
    const mockLean = jest.fn().mockResolvedValue([CAREER_DOC]);
    const mockSort = jest.fn().mockReturnValue({ lean: mockLean });
    PlayerCareerStats.find.mockReturnValue({ sort: mockSort });

    const req = { params: { playerId: '203999' } };
    const res = mockRes();
    await handler(req, res);

    expect(PlayerCareerStats.find).toHaveBeenCalledWith({ nbaPlayerId: 203999 });
    expect(mockSort).toHaveBeenCalledWith({ season: -1 });
    expect(res.json).toHaveBeenCalledWith({
      playerId: '203999',
      seasons: [
        {
          season:       '2024-25',
          teamId:       0,
          team:         'DEN',
          gamesPlayed:  70,
          gamesStarted: 0,
          minutes:      34.0,
          points:       26.4,
          rebounds:     12.1,
          assists:      9.0,
          steals:       1.4,
          blocks:       0.8,
          turnovers:    3.1,
          fgPct:        0.58,
          fg3Pct:       0.36,
          ftPct:        0.82,
        },
      ],
    });
  });

  test('gamesStarted is always 0', async () => {
    const mockLean = jest.fn().mockResolvedValue([CAREER_DOC]);
    const mockSort = jest.fn().mockReturnValue({ lean: mockLean });
    PlayerCareerStats.find.mockReturnValue({ sort: mockSort });

    const req = { params: { playerId: '203999' } };
    const res = mockRes();
    await handler(req, res);

    const season = res.json.mock.calls[0][0].seasons[0];
    expect(season.gamesStarted).toBe(0);
  });

  test('returns empty seasons array when no career data found', async () => {
    const mockLean = jest.fn().mockResolvedValue([]);
    const mockSort = jest.fn().mockReturnValue({ lean: mockLean });
    PlayerCareerStats.find.mockReturnValue({ sort: mockSort });

    const req = { params: { playerId: '203999' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ playerId: '203999', seasons: [] });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 400 for non-numeric playerId', async () => {
    const req = { params: { playerId: 'abc' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'playerId must be a numeric NBA player ID',
    });
    expect(PlayerCareerStats.find).not.toHaveBeenCalled();
  });

  test('returns 500 when DB throws', async () => {
    const mockSort = jest.fn().mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('career boom')),
    });
    PlayerCareerStats.find.mockReturnValue({ sort: mockSort });

    const req = { params: { playerId: '203999' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error:   'Failed to fetch player career stats',
      details: 'career boom',
    });
  });
});

// ── GET /players/search ───────────────────────────────────────────────────────

describe('GET /players/search', () => {
  const handler = getHandler('/players/search');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('returns matching players when q is provided', async () => {
    const searchResult = [{ _id: 'mongo-id-jokic', firstName: 'Nikola', lastName: 'Jokic', nbaId: 203999 }];
    const leanChain = { lean: jest.fn().mockResolvedValue(searchResult) };
    const limitChain = { limit: jest.fn().mockReturnValue(leanChain) };
    const selectChain = { select: jest.fn().mockReturnValue(limitChain) };
    Player.find.mockReturnValue(selectChain);

    const res = mockRes();
    await handler({ query: { q: 'jokic' } }, res);

    expect(Player.find).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(searchResult);
  });

  test('returns empty array when q is empty', async () => {
    const res = mockRes();
    await handler({ query: { q: '' } }, res);

    expect(Player.find).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('returns empty array when q is not provided', async () => {
    const res = mockRes();
    await handler({ query: {} }, res);

    expect(Player.find).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('returns 500 when DB throws', async () => {
    const leanChain = { lean: jest.fn().mockRejectedValue(new Error('search boom')) };
    const limitChain = { limit: jest.fn().mockReturnValue(leanChain) };
    const selectChain = { select: jest.fn().mockReturnValue(limitChain) };
    Player.find.mockReturnValue(selectChain);

    const res = mockRes();
    await handler({ query: { q: 'jokic' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error:   'Failed to search players',
      details: 'search boom',
    });
  });
});

// ── GET /players/top ──────────────────────────────────────────────────────────

describe('GET /players/top', () => {
  const handler = getHandler('/players/top');

  const TOP_DOC = {
    nbaPlayerId: 203999,
    statValue:   26.4,
    playerName:  'Nikola Jokic',
    teamAbbr:    'DEN',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('returns top players in all four categories', async () => {
    PlayerSeasonStats.aggregate.mockResolvedValue([TOP_DOC]);

    const res = mockRes();
    await handler({ query: {} }, res);

    expect(PlayerSeasonStats.aggregate).toHaveBeenCalledTimes(4);
    expect(res.json).toHaveBeenCalledWith({
      points:   [TOP_DOC],
      threes:   [TOP_DOC],
      assists:  [TOP_DOC],
      rebounds: [TOP_DOC],
    });
  });

  test('returns 500 when aggregate throws', async () => {
    PlayerSeasonStats.aggregate.mockRejectedValue(new Error('agg boom'));

    const res = mockRes();
    await handler({ query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error:   'Failed to fetch top players',
      details: 'agg boom',
    });
  });
});

// ── GET /players/:nbaPlayerId/stats ───────────────────────────────────────────

describe('GET /players/:nbaPlayerId/stats', () => {
  const handler = getHandler('/players/:nbaPlayerId/stats');

  const SEASON_DOC = {
    nbaPlayerId:  203999,
    avgPoints:    26.4,
    avgRebounds:  12.1,
    avgAssists:   9.0,
    avgFg3m:      1.5,
  };

  const GAME_DOC = {
    points:            30,
    rebounds:          14,
    assists:           10,
    threePointersMade: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('returns season averages and last game stats', async () => {
    PlayerSeasonStats.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(SEASON_DOC) });

    const playerChain = { lean: jest.fn().mockResolvedValue({ _id: 'mongo-id-jokic' }) };
    const playerSelectChain = { select: jest.fn().mockReturnValue(playerChain) };
    Player.findOne.mockReturnValue(playerSelectChain);

    const gameChain = { lean: jest.fn().mockResolvedValue(GAME_DOC) };
    const gameSortChain = { sort: jest.fn().mockReturnValue(gameChain) };
    PlayerGameStats.findOne.mockReturnValue(gameSortChain);

    const req = { params: { nbaPlayerId: '203999' } };
    const res = mockRes();
    await handler(req, res);

    expect(PlayerSeasonStats.findOne).toHaveBeenCalledWith({ nbaPlayerId: 203999 });
    expect(res.json).toHaveBeenCalledWith({
      seasonAvg: {
        pts:  26.4,
        reb:  12.1,
        ast:  9.0,
        fg3m: 1.5,
      },
      lastGame: {
        pts:  30,
        reb:  14,
        ast:  10,
        fg3m: 2,
      },
    });
  });

  test('returns lastGame null when no game doc found', async () => {
    PlayerSeasonStats.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(SEASON_DOC) });

    const playerChain = { lean: jest.fn().mockResolvedValue({ _id: 'mongo-id-jokic' }) };
    const playerSelectChain = { select: jest.fn().mockReturnValue(playerChain) };
    Player.findOne.mockReturnValue(playerSelectChain);

    const gameChain = { lean: jest.fn().mockResolvedValue(null) };
    const gameSortChain = { sort: jest.fn().mockReturnValue(gameChain) };
    PlayerGameStats.findOne.mockReturnValue(gameSortChain);

    const req = { params: { nbaPlayerId: '203999' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ lastGame: null })
    );
  });

  test('returns 400 for non-numeric nbaPlayerId', async () => {
    const req = { params: { nbaPlayerId: 'abc' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'nbaPlayerId must be a numeric NBA player ID',
    });
    expect(PlayerSeasonStats.findOne).not.toHaveBeenCalled();
  });

  test('returns 404 when no season stats found', async () => {
    PlayerSeasonStats.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const req = { params: { nbaPlayerId: '9999999' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No season stats found for this player',
    });
  });

  test('returns 500 when DB throws', async () => {
    PlayerSeasonStats.findOne.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('stats boom')),
    });

    const req = { params: { nbaPlayerId: '203999' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error:   'Failed to fetch player stats',
      details: 'stats boom',
    });
  });
});

// ── GET /players/:nbaPlayerId/games ───────────────────────────────────────────

describe('GET /players/:nbaPlayerId/games', () => {
  const handler = getHandler('/players/:nbaPlayerId/games');

  const GAME_LOG_DOC = {
    gameDate:          new Date('2025-01-15'),
    points:            28,
    rebounds:          11,
    assists:           8,
    steals:            1,
    blocks:            2,
    turnovers:         3,
    threePointersMade: 2,
    minutes:           34.5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('returns mapped game log for valid player', async () => {
    const playerChain = { lean: jest.fn().mockResolvedValue({ _id: 'mongo-id-jokic' }) };
    const playerSelectChain = { select: jest.fn().mockReturnValue(playerChain) };
    Player.findOne.mockReturnValue(playerSelectChain);

    const gameLeanChain = { lean: jest.fn().mockResolvedValue([GAME_LOG_DOC]) };
    const gameSelectChain = { select: jest.fn().mockReturnValue(gameLeanChain) };
    const gameSortChain = { sort: jest.fn().mockReturnValue(gameSelectChain) };
    PlayerGameStats.find.mockReturnValue(gameSortChain);

    const req = { params: { nbaPlayerId: '203999' } };
    const res = mockRes();
    await handler(req, res);

    expect(Player.findOne).toHaveBeenCalledWith({ nbaId: 203999 });
    expect(res.json).toHaveBeenCalledWith([
      {
        date: GAME_LOG_DOC.gameDate,
        pts:  28,
        reb:  11,
        ast:  8,
        stl:  1,
        blk:  2,
        tov:  3,
        fg3m: 2,
        min:  35,
      },
    ]);
  });

  test('returns 400 for non-numeric nbaPlayerId', async () => {
    const req = { params: { nbaPlayerId: 'abc' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'nbaPlayerId must be a numeric NBA player ID',
    });
    expect(Player.findOne).not.toHaveBeenCalled();
  });

  test('returns 404 when player not found', async () => {
    const playerChain = { lean: jest.fn().mockResolvedValue(null) };
    const playerSelectChain = { select: jest.fn().mockReturnValue(playerChain) };
    Player.findOne.mockReturnValue(playerSelectChain);

    const req = { params: { nbaPlayerId: '9999999' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Player not found' });
    expect(PlayerGameStats.find).not.toHaveBeenCalled();
  });

  test('returns 500 when DB throws', async () => {
    const playerChain = { lean: jest.fn().mockRejectedValue(new Error('game log boom')) };
    const playerSelectChain = { select: jest.fn().mockReturnValue(playerChain) };
    Player.findOne.mockReturnValue(playerSelectChain);

    const req = { params: { nbaPlayerId: '203999' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch game log' });
  });
});

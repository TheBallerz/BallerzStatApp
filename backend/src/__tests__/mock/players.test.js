'use strict';

jest.mock('../../models/Player', () => ({
  find: jest.fn(),
}));

jest.mock('../../models/PlayerSeasonStats', () => ({
  aggregate: jest.fn(),
}));

jest.mock('../../models/PlayerCareerStats', () => ({
  find: jest.fn(),
}));

const router            = require('../../routes/players');
const Player            = require('../../models/Player');
const PlayerCareerStats = require('../../models/PlayerCareerStats');

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
        playerId:     203999,
        fullName:     'Nikola Jokic',
        teamId:       1610612743,
        team:         'DEN',
        teamName:     'Nuggets',
        fromYear:     '',
        toYear:       '',
        rosterStatus: 1,
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

jest.mock('../../models/TeamSeasonStats', () => ({
  find: jest.fn(),
  distinct: jest.fn(),
}));

jest.mock('../../models/Team', () => ({
  find: jest.fn(),
}));

jest.mock('../../models/TeamGameStats', () => ({
  find: jest.fn(),
}));

const router = require('../../routes/standings');
const TeamSeasonStats = require('../../models/TeamSeasonStats');
const Team = require('../../models/Team');
const TeamGameStats = require('../../models/TeamGameStats');

function getHandler(path) {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods.get
  );

  if (!layer) {
    throw new Error(`GET ${path} route not found`);
  }

  return layer.route.stack[0].handle;
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('GET /standings', () => {
  const handler = getHandler('/standings');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    TeamSeasonStats.distinct.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns formatted east and west standings for a provided season', async () => {
    TeamGameStats.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { teamId: 'bos1', result: 'W' },
        { teamId: 'bos1', result: 'W' },
        { teamId: 'ny1', result: 'W' },
        { teamId: 'ny1', result: 'L' },
        { teamId: 'den1', result: 'W' },
        { teamId: 'den1', result: 'W' },
        { teamId: 'lal1', result: 'L' },
        { teamId: 'lal1', result: 'W' },
      ]),
    });

    TeamSeasonStats.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          teamId: 'bos1',
          avgPoints: 120.6,
          avgRebounds: 46.2,
          avgAssists: 29.1,
          avgSteals: 7.4,
          avgBlocks: 5.6,
          avgTurnovers: 11.8,
          fgPct: 0.487,
          fg3Pct: 0.388,
          ftPct: 0.812,
        },
        {
          teamId: 'ny1',
          avgPoints: 112.3,
          avgRebounds: 44.0,
          avgAssists: 25.4,
          avgSteals: 7.1,
          avgBlocks: 4.2,
          avgTurnovers: 12.0,
          fgPct: 0.465,
          fg3Pct: 0.361,
          ftPct: 0.796,
        },
        {
          teamId: 'den1',
          avgPoints: 116.9,
          avgRebounds: 45.1,
          avgAssists: 30.2,
          avgSteals: 6.9,
          avgBlocks: 5.0,
          avgTurnovers: 11.3,
          fgPct: 0.496,
          fg3Pct: 0.376,
          ftPct: 0.805,
        },
        {
          teamId: 'lal1',
          avgPoints: 114.1,
          avgRebounds: 43.7,
          avgAssists: 27.8,
          avgSteals: 7.0,
          avgBlocks: 5.4,
          avgTurnovers: 13.1,
          fgPct: 0.482,
          fg3Pct: 0.367,
          ftPct: 0.781,
        },
      ]),
    });

    Team.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          _id: 'bos1',
          nbaId: 1610612738,
          name: 'Boston Celtics',
          abbreviation: 'BOS',
          conference: 'East',
          division: 'Atlantic',
        },
        {
          _id: 'ny1',
          nbaId: 1610612752,
          name: 'New York Knicks',
          abbreviation: 'NYK',
          conference: 'Eastern',
          division: 'Atlantic',
        },
        {
          _id: 'den1',
          nbaId: 1610612743,
          name: 'Denver Nuggets',
          abbreviation: 'DEN',
          conference: 'West',
          division: 'Northwest',
        },
        {
          _id: 'lal1',
          nbaId: 1610612747,
          name: 'Los Angeles Lakers',
          abbreviation: 'LAL',
          conference: 'Western',
          division: 'Pacific',
        },
      ]),
    });

    const req = { query: { season: '2024-25' } };
    const res = mockRes();

    await handler(req, res);

    expect(TeamGameStats.find).toHaveBeenCalledWith({
      season: '2024-25',
      seasonType: 'Regular Season',
    });

    expect(TeamSeasonStats.find).toHaveBeenCalledWith({ season: '2024-25' });

    expect(res.json).toHaveBeenCalledWith({
      season: '2024-25',
      type: 'season',
      seasonType: 'Regular Season',
      east: [
        {
          teamId: 'bos1',
          nbaTeamId: 1610612738,
          teamName: 'Boston Celtics',
          abbreviation: 'BOS',
          conference: 'East',
          division: 'Atlantic',
          wins: 2,
          losses: 0,
          gamesPlayed: 2,
          winPct: 1,
          avgPoints: 120.6,
          avgRebounds: 46.2,
          avgAssists: 29.1,
          avgSteals: 7.4,
          avgBlocks: 5.6,
          avgTurnovers: 11.8,
          fgPct: 0.487,
          fg3Pct: 0.388,
          ftPct: 0.812,
        },
        {
          teamId: 'ny1',
          nbaTeamId: 1610612752,
          teamName: 'New York Knicks',
          abbreviation: 'NYK',
          conference: 'Eastern',
          division: 'Atlantic',
          wins: 1,
          losses: 1,
          gamesPlayed: 2,
          winPct: 0.5,
          avgPoints: 112.3,
          avgRebounds: 44.0,
          avgAssists: 25.4,
          avgSteals: 7.1,
          avgBlocks: 4.2,
          avgTurnovers: 12.0,
          fgPct: 0.465,
          fg3Pct: 0.361,
          ftPct: 0.796,
        },
      ],
      west: [
        {
          teamId: 'den1',
          nbaTeamId: 1610612743,
          teamName: 'Denver Nuggets',
          abbreviation: 'DEN',
          conference: 'West',
          division: 'Northwest',
          wins: 2,
          losses: 0,
          gamesPlayed: 2,
          winPct: 1,
          avgPoints: 116.9,
          avgRebounds: 45.1,
          avgAssists: 30.2,
          avgSteals: 6.9,
          avgBlocks: 5.0,
          avgTurnovers: 11.3,
          fgPct: 0.496,
          fg3Pct: 0.376,
          ftPct: 0.805,
        },
        {
          teamId: 'lal1',
          nbaTeamId: 1610612747,
          teamName: 'Los Angeles Lakers',
          abbreviation: 'LAL',
          conference: 'Western',
          division: 'Pacific',
          wins: 1,
          losses: 1,
          gamesPlayed: 2,
          winPct: 0.5,
          avgPoints: 114.1,
          avgRebounds: 43.7,
          avgAssists: 27.8,
          avgSteals: 7.0,
          avgBlocks: 5.4,
          avgTurnovers: 13.1,
          fgPct: 0.482,
          fg3Pct: 0.367,
          ftPct: 0.781,
        },
      ],
    });
  });

  test('uses default season and returns empty conferences', async () => {
    TeamGameStats.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    TeamSeasonStats.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    Team.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    const req = { query: {} };
    const res = mockRes();

    await handler(req, res);

    expect(TeamGameStats.find).toHaveBeenCalledWith({
      season: '2025-26',
      seasonType: 'Regular Season',
    });

    expect(res.json).toHaveBeenCalledWith({
      season: '2025-26',
      type: 'season',
      seasonType: 'Regular Season',
      east: [],
      west: [],
    });
  });

  test('uses playoff season type when type is finals', async () => {
    TeamGameStats.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ teamId: 'bos1', result: 'W' }]),
    });

    TeamSeasonStats.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    Team.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          _id: 'bos1',
          nbaId: 1610612738,
          name: 'Boston Celtics',
          abbreviation: 'BOS',
          conference: 'East',
          division: 'Atlantic',
        },
      ]),
    });

    const req = { query: { season: '2025-26', type: 'finals' } };
    const res = mockRes();

    await handler(req, res);

    expect(TeamGameStats.find).toHaveBeenCalledWith({
      season: '2025-26',
      seasonType: 'Playoffs',
    });

    expect(res.json).toHaveBeenCalledWith({
      season: '2025-26',
      type: 'finals',
      seasonType: 'Playoffs',
      east: [
        {
          teamId: 'bos1',
          nbaTeamId: 1610612738,
          teamName: 'Boston Celtics',
          abbreviation: 'BOS',
          conference: 'East',
          division: 'Atlantic',
          wins: 1,
          losses: 0,
          gamesPlayed: 1,
          winPct: 1,
          avgPoints: 0,
          avgRebounds: 0,
          avgAssists: 0,
          avgSteals: 0,
          avgBlocks: 0,
          avgTurnovers: 0,
          fgPct: 0,
          fg3Pct: 0,
          ftPct: 0,
        },
      ],
      west: [],
    });
  });

  test('sets winPct to 0 when gamesPlayed is 0', async () => {
    TeamGameStats.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    TeamSeasonStats.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    Team.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          _id: 'bos1',
          nbaId: 1610612738,
          name: 'Boston Celtics',
          abbreviation: 'BOS',
          conference: 'East',
          division: 'Atlantic',
        },
      ]),
    });

    const req = { query: {} };
    const res = mockRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      season: '2025-26',
      type: 'season',
      seasonType: 'Regular Season',
      east: [],
      west: [],
    });
  });

  test('returns 500 when standings query fails', async () => {
    TeamGameStats.find.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('db fail')),
    });

    const req = { query: { season: '2024-25' } };
    const res = mockRes();

    await handler(req, res);

    expect(console.error).toHaveBeenCalledWith(
      'Error fetching standings:',
      'db fail'
    );

    expect(res.status).toHaveBeenCalledWith(500);

    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to fetch standings',
      details: 'db fail',
    });
  });

  test('sorts tied winPct teams by wins for both east and west', async () => {
    TeamGameStats.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { teamId: 'east1', result: 'W' },
        { teamId: 'east1', result: 'W' },
        { teamId: 'east1', result: 'L' },

        { teamId: 'east2', result: 'W' },
        { teamId: 'east2', result: 'W' },
        { teamId: 'east2', result: 'L' },

        { teamId: 'west1', result: 'W' },
        { teamId: 'west1', result: 'W' },
        { teamId: 'west1', result: 'W' },
        { teamId: 'west1', result: 'L' },

        { teamId: 'west2', result: 'W' },
        { teamId: 'west2', result: 'W' },
        { teamId: 'west2', result: 'W' },
        { teamId: 'west2', result: 'L' },
      ]),
    });

    TeamSeasonStats.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { teamId: 'east1' },
        { teamId: 'east2' },
        { teamId: 'west1' },
        { teamId: 'west2' },
      ]),
    });

    Team.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          _id: 'east1',
          nbaId: 1,
          name: 'East One',
          abbreviation: 'E1',
          conference: 'East',
          division: 'A',
        },
        {
          _id: 'east2',
          nbaId: 2,
          name: 'East Two',
          abbreviation: 'E2',
          conference: 'Eastern',
          division: 'A',
        },
        {
          _id: 'west1',
          nbaId: 3,
          name: 'West One',
          abbreviation: 'W1',
          conference: 'West',
          division: 'B',
        },
        {
          _id: 'west2',
          nbaId: 4,
          name: 'West Two',
          abbreviation: 'W2',
          conference: 'Western',
          division: 'B',
        },
      ]),
    });

    const req = { query: { season: '2025-26' } };
    const res = mockRes();

    await handler(req, res);

    const payload = res.json.mock.calls[0][0];

    expect(payload.east.map((t) => t.teamId)).toEqual(['east1', 'east2']);
    expect(payload.west.map((t) => t.teamId)).toEqual(['west1', 'west2']);

    expect(payload.east[0].winPct).toBe(payload.east[1].winPct);
    expect(payload.west[0].winPct).toBe(payload.west[1].winPct);
  });
});
jest.mock('../../models/TeamSeasonStats', () => ({
    find: jest.fn(),
    distinct: jest.fn(),
  }));

  jest.mock('../../models/Team', () => ({
    find: jest.fn(),
  }));

  const router = require('../../routes/standings');
  const TeamSeasonStats = require('../../models/TeamSeasonStats');
  const Team = require('../../models/Team');

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
      TeamSeasonStats.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            nbaTeamId: 1610612738,
            wins: 64, losses: 18, gamesPlayed: 82,
            avgPoints: 120.6, avgRebounds: 46.2, avgAssists: 29.1,
            avgSteals: 7.4, avgBlocks: 5.6, avgTurnovers: 11.8,
            fgPct: 0.487, fg3Pct: 0.388, ftPct: 0.812,
          },
          {
            nbaTeamId: 1610612752,
            wins: 50, losses: 32, gamesPlayed: 82,
            avgPoints: 112.3, avgRebounds: 44.0, avgAssists: 25.4,
            avgSteals: 7.1, avgBlocks: 4.2, avgTurnovers: 12.0,
            fgPct: 0.465, fg3Pct: 0.361, ftPct: 0.796,
          },
          {
            nbaTeamId: 1610612743,
            wins: 57, losses: 25, gamesPlayed: 82,
            avgPoints: 116.9, avgRebounds: 45.1, avgAssists: 30.2,
            avgSteals: 6.9, avgBlocks: 5.0, avgTurnovers: 11.3,
            fgPct: 0.496, fg3Pct: 0.376, ftPct: 0.805,
          },
          {
            nbaTeamId: 1610612747,
            wins: 47, losses: 35, gamesPlayed: 82,
            avgPoints: 114.1, avgRebounds: 43.7, avgAssists: 27.8,
            avgSteals: 7.0, avgBlocks: 5.4, avgTurnovers: 13.1,
            fgPct: 0.482, fg3Pct: 0.367, ftPct: 0.781,
          },
          {
            nbaTeamId: 999, // no matching team → filtered out
            wins: 10, losses: 72, gamesPlayed: 82,
            avgPoints: 0, avgRebounds: 0, avgAssists: 0,
            avgSteals: 0, avgBlocks: 0, avgTurnovers: 0,
            fgPct: 0, fg3Pct: 0, ftPct: 0,
          },
        ]),
      });

      Team.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: 'bos1', nbaId: 1610612738, name: 'Boston Celtics', abbreviation: 'BOS', conference: 'East', division: 'Atlantic' },
          { _id: 'ny1',  nbaId: 1610612752, name: 'New York Knicks', abbreviation: 'NYK', conference: 'Eastern', division: 'Atlantic' },
          { _id: 'den1', nbaId: 1610612743, name: 'Denver Nuggets', abbreviation: 'DEN', conference: 'West', division: 'Northwest' },
          { _id: 'lal1', nbaId: 1610612747, name: 'Los Angeles Lakers', abbreviation: 'LAL', conference: 'Western', division: 'Pacific' },
        ]),
      });

      const req = { query: { season: '2024-25' } };
      const res = mockRes();

      await handler(req, res);

      expect(TeamSeasonStats.find).toHaveBeenCalledWith({ season: '2024-25' });

      expect(res.json).toHaveBeenCalledWith({
        season: '2024-25',
        east: [
          {
            teamId: 'bos1',
            nbaTeamId: 1610612738,
            teamName: 'Boston Celtics',
            abbreviation: 'BOS',
            conference: 'East',
            division: 'Atlantic',
            wins: 64, losses: 18, gamesPlayed: 82,
            winPct: 0.78,
            avgPoints: 120.6, avgRebounds: 46.2, avgAssists: 29.1,
            avgSteals: 7.4, avgBlocks: 5.6, avgTurnovers: 11.8,
            fgPct: 0.487, fg3Pct: 0.388, ftPct: 0.812,
          },
          {
            teamId: 'ny1',
            nbaTeamId: 1610612752,
            teamName: 'New York Knicks',
            abbreviation: 'NYK',
            conference: 'Eastern',
            division: 'Atlantic',
            wins: 50, losses: 32, gamesPlayed: 82,
            winPct: 0.61,
            avgPoints: 112.3, avgRebounds: 44.0, avgAssists: 25.4,
            avgSteals: 7.1, avgBlocks: 4.2, avgTurnovers: 12.0,
            fgPct: 0.465, fg3Pct: 0.361, ftPct: 0.796,
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
            wins: 57, losses: 25, gamesPlayed: 82,
            winPct: 0.695,
            avgPoints: 116.9, avgRebounds: 45.1, avgAssists: 30.2,
            avgSteals: 6.9, avgBlocks: 5.0, avgTurnovers: 11.3,
            fgPct: 0.496, fg3Pct: 0.376, ftPct: 0.805,
          },
          {
            teamId: 'lal1',
            nbaTeamId: 1610612747,
            teamName: 'Los Angeles Lakers',
            abbreviation: 'LAL',
            conference: 'Western',
            division: 'Pacific',
            wins: 47, losses: 35, gamesPlayed: 82,
            winPct: 0.573,
            avgPoints: 114.1, avgRebounds: 43.7, avgAssists: 27.8,
            avgSteals: 7.0, avgBlocks: 5.4, avgTurnovers: 13.1,
            fgPct: 0.482, fg3Pct: 0.367, ftPct: 0.781,
          },
        ],
      });
    });

    test('uses default season and returns empty conferences', async () => {
      TeamSeasonStats.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
      Team.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

      const req = { query: {} };
      const res = mockRes();

      await handler(req, res);

      expect(TeamSeasonStats.find).toHaveBeenCalledWith({ season: '2025-26' });
      expect(res.json).toHaveBeenCalledWith({
        season: '2025-26',
        east: [],
        west: [],
      });
    });

    test('sets winPct to 0 when gamesPlayed is 0', async () => {
      TeamSeasonStats.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            nbaTeamId: 1610612738,
            wins: 0, losses: 0, gamesPlayed: 0,
            avgPoints: 0, avgRebounds: 0, avgAssists: 0,
            avgSteals: 0, avgBlocks: 0, avgTurnovers: 0,
            fgPct: 0, fg3Pct: 0, ftPct: 0,
          },
        ]),
      });

      Team.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: 'bos1', nbaId: 1610612738, name: 'Boston Celtics', abbreviation: 'BOS', conference: 'East', division: 'Atlantic' },
        ]),
      });

      const req = { query: {} };
      const res = mockRes();

      await handler(req, res);

      expect(res.json).toHaveBeenCalledWith({
        season: '2025-26',
        east: [
          {
            teamId: 'bos1',
            nbaTeamId: 1610612738,
            teamName: 'Boston Celtics',
            abbreviation: 'BOS',
            conference: 'East',
            division: 'Atlantic',
            wins: 0, losses: 0, gamesPlayed: 0,
            winPct: 0,
            avgPoints: 0, avgRebounds: 0, avgAssists: 0,
            avgSteals: 0, avgBlocks: 0, avgTurnovers: 0,
            fgPct: 0, fg3Pct: 0, ftPct: 0,
          },
        ],
        west: [],
      });
    });

    test('returns 500 when standings query fails', async () => {
      TeamSeasonStats.find.mockReturnValue({
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
      TeamSeasonStats.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { nbaTeamId: 1, wins: 50, losses: 25, gamesPlayed: 75, avgPoints: 0, avgRebounds: 0, avgAssists: 0, avgSteals: 0, avgBlocks: 0, avgTurnovers: 0, fgPct: 0, fg3Pct: 0, ftPct: 0 },
          { nbaTeamId: 2, wins: 40, losses: 20, gamesPlayed: 60, avgPoints: 0, avgRebounds: 0, avgAssists: 0, avgSteals: 0, avgBlocks: 0, avgTurnovers: 0, fgPct: 0, fg3Pct: 0, ftPct: 0 },
          { nbaTeamId: 3, wins: 45, losses: 15, gamesPlayed: 60, avgPoints: 0, avgRebounds: 0, avgAssists: 0, avgSteals: 0, avgBlocks: 0, avgTurnovers: 0, fgPct: 0, fg3Pct: 0, ftPct: 0 },
          { nbaTeamId: 4, wins: 30, losses: 10, gamesPlayed: 40, avgPoints: 0, avgRebounds: 0, avgAssists: 0, avgSteals: 0, avgBlocks: 0, avgTurnovers: 0, fgPct: 0, fg3Pct: 0, ftPct: 0 },
        ]),
      });

      Team.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: 'east1', nbaId: 1, name: 'East One', abbreviation: 'E1', conference: 'East',    division: 'A' },
          { _id: 'east2', nbaId: 2, name: 'East Two', abbreviation: 'E2', conference: 'Eastern', division: 'A' },
          { _id: 'west1', nbaId: 3, name: 'West One', abbreviation: 'W1', conference: 'West',    division: 'B' },
          { _id: 'west2', nbaId: 4, name: 'West Two', abbreviation: 'W2', conference: 'Western', division: 'B' },
        ]),
      });

      const req = { query: { season: '2025-26' } };
      const res = mockRes();

      await handler(req, res);

      const payload = res.json.mock.calls[0][0];

      expect(payload.east.map((t) => t.teamId)).toEqual(['east1', 'east2']);
      expect(payload.west.map((t) => t.teamId)).toEqual(['west1', 'west2']);

      // Both east teams have 50/75 = 40/60 = 0.667 winPct (tied, sorted by wins)
      expect(payload.east[0].winPct).toBe(payload.east[1].winPct);
      // Both west teams have 45/60 = 30/40 = 0.75 winPct (tied, sorted by wins)
      expect(payload.west[0].winPct).toBe(payload.west[1].winPct);
    });
  });

jest.mock('../nbaApi', () => ({
    getTeams: jest.fn(),
    getTeamInfo: jest.fn(),
  }));
  
  jest.mock('../utils/nbaUtils', () => ({
    rowsToObjects: jest.fn(),
  }));
  
  const router = require('../routes/teams');
  const { getTeams, getTeamInfo } = require('../nbaApi');
  const { rowsToObjects } = require('../utils/nbaUtils');
  
  function getHandler(path) {
    const layer = router.stack.find(
      (l) => l.route && l.route.path === path && l.route.methods.get
    );
  
    if (!layer) {
      throw new Error(`GET ${path} not found`);
    }
  
    return layer.route.stack[0].handle;
  }
  
  function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }
  
  describe('GET /teams/:teamId (team detail)', () => {
    const handler = getHandler('/teams/:teamId');
  
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });
  
    afterEach(() => {
      jest.restoreAllMocks();
    });
  
    test('returns team detail successfully', async () => {
      getTeams.mockResolvedValue({
        resultSets: [{ name: 'LeagueDashTeamStats' }],
      });
  
      getTeamInfo.mockResolvedValue({
        resultSets: [{ name: 'TeamInfoCommon' }],
      });
  
      rowsToObjects
        // teamsSet
        .mockReturnValueOnce([
          {
            TEAM_ID: 1,
            W: 50,
            L: 32,
            PTS: 115,
            REB: 44,
            AST: 25,
            FG_PCT: 0.48,
          },
        ])
        // infoSet
        .mockReturnValueOnce([
          {
            TEAM_CITY: 'Boston',
            TEAM_NAME: 'Celtics',
            TEAM_ABBREVIATION: 'BOS',
            TEAM_CONFERENCE: 'East',
            TEAM_DIVISION: 'Atlantic',
          },
        ]);
  
      const req = {
        params: { teamId: '1' },
        query: {},
      };
      const res = mockRes();
  
      await handler(req, res);
  
      expect(res.json).toHaveBeenCalledWith({
        teamId: 1,
        city: 'Boston',
        name: 'Celtics',
        abbreviation: 'BOS',
        conference: 'East',
        division: 'Atlantic',
        wins: 50,
        losses: 32,
        record: '50-32',
        ppg: 115,
        rpg: 44,
        apg: 25,
        fgPct: 0.48,
      });
    });
  
    test('returns 500 when result sets missing', async () => {
      getTeams.mockResolvedValue({});
      getTeamInfo.mockResolvedValue({});
  
      const req = { params: { teamId: '1' }, query: {} };
      const res = mockRes();
  
      await handler(req, res);
  
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Team detail data missing',
      });
    });
  
    test('returns 404 when teamStats not found', async () => {
      getTeams.mockResolvedValue({
        resultSets: [{ name: 'LeagueDashTeamStats' }],
      });
  
      getTeamInfo.mockResolvedValue({
        resultSets: [{ name: 'TeamInfoCommon' }],
      });
  
      rowsToObjects
        .mockReturnValueOnce([]) // no teamStats
        .mockReturnValueOnce([
          {
            TEAM_CITY: 'Boston',
            TEAM_NAME: 'Celtics',
          },
        ]);
  
      const req = { params: { teamId: '999' }, query: {} };
      const res = mockRes();
  
      await handler(req, res);
  
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Team not found',
      });
    });
  
    test('returns 404 when teamInfo missing', async () => {
      getTeams.mockResolvedValue({
        resultSets: [{ name: 'LeagueDashTeamStats' }],
      });
  
      getTeamInfo.mockResolvedValue({
        resultSets: [{ name: 'TeamInfoCommon' }],
      });
  
      rowsToObjects
        .mockReturnValueOnce([
          { TEAM_ID: 1, W: 10, L: 5 },
        ])
        .mockReturnValueOnce([]); // no info
  
      const req = { params: { teamId: '1' }, query: {} };
      const res = mockRes();
  
      await handler(req, res);
  
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Team not found',
      });
    });
  
    test('uses default season when not provided', async () => {
      getTeams.mockResolvedValue({
        resultSets: [{ name: 'LeagueDashTeamStats' }],
      });
  
      getTeamInfo.mockResolvedValue({
        resultSets: [{ name: 'TeamInfoCommon' }],
      });
  
      rowsToObjects
        .mockReturnValueOnce([{ TEAM_ID: 1 }])
        .mockReturnValueOnce([{ TEAM_NAME: 'Celtics' }]);
  
      const req = { params: { teamId: '1' }, query: {} };
      const res = mockRes();
  
      await handler(req, res);
  
      expect(getTeams).toHaveBeenCalled(); // season default used
      expect(getTeamInfo).toHaveBeenCalled();
    });
  
    test('returns 500 when API throws error', async () => {
      getTeams.mockRejectedValue(new Error('boom'));
  
      const req = { params: { teamId: '1' }, query: {} };
      const res = mockRes();
  
      await handler(req, res);
  
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('GET /teams', () => {
    const handler = getHandler('/teams');
  
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });
  
    afterEach(() => {
      jest.restoreAllMocks();
    });
  
    test('returns mapped teams from LeagueDashTeamStats', async () => {
      getTeams.mockResolvedValue({
        resultSets: [
          { name: 'OtherSet', headers: [], rowSet: [] },
          { name: 'LeagueDashTeamStats', headers: ['TEAM_ID'], rowSet: [[1610612738]] },
        ],
      });
  
      rowsToObjects.mockReturnValue([
        {
          TEAM_ID: 1610612738,
          TEAM_NAME: 'Celtics',
          W: 64,
          L: 18,
          PTS: 120.6,
          REB: 46.2,
          AST: 29.1,
          FG_PCT: 0.487,
        },
      ]);
  
      const res = mockRes();
  
      await handler({}, res);
  
      expect(getTeams).toHaveBeenCalledTimes(1);
      expect(rowsToObjects).toHaveBeenCalledWith({
        name: 'LeagueDashTeamStats',
        headers: ['TEAM_ID'],
        rowSet: [[1610612738]],
      });
      expect(res.json).toHaveBeenCalledWith([
        {
          teamId: 1610612738,
          teamName: 'Celtics',
          teamAbbreviation: expect.any(String),
          wins: 64,
          losses: 18,
          record: '64-18',
          ppg: 120.6,
          rpg: 46.2,
          apg: 29.1,
          fgPct: 0.487,
        },
      ]);
    });
  
    test('falls back to first resultSets entry when named set is missing', async () => {
      getTeams.mockResolvedValue({
        resultSets: [
          { name: 'FallbackSet', headers: ['A'], rowSet: [[1]] },
        ],
      });
  
      rowsToObjects.mockReturnValue([]);
  
      const res = mockRes();
  
      await handler({}, res);
  
      expect(rowsToObjects).toHaveBeenCalledWith({
        name: 'FallbackSet',
        headers: ['A'],
        rowSet: [[1]],
      });
      expect(res.json).toHaveBeenCalledWith([]);
    });
  
    test('falls back to data.resultSet when resultSets is missing', async () => {
      getTeams.mockResolvedValue({
        resultSet: { name: 'LegacySet', headers: ['B'], rowSet: [[2]] },
      });
  
      rowsToObjects.mockReturnValue([]);
  
      const res = mockRes();
  
      await handler({}, res);
  
      expect(rowsToObjects).toHaveBeenCalledWith({
        name: 'LegacySet',
        headers: ['B'],
        rowSet: [[2]],
      });
      expect(res.json).toHaveBeenCalledWith([]);
    });
  
    test('returns 500 when resultSet is missing', async () => {
      getTeams.mockResolvedValue({});
  
      const res = mockRes();
  
      await handler({}, res);
  
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Team data missing',
      });
    });
  
    test('returns 500 when getTeams throws', async () => {
      getTeams.mockRejectedValue(new Error('boom'));
  
      const res = mockRes();
  
      await handler({}, res);
  
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching teams:',
        'boom'
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to fetch teams',
        details: 'boom',
      });
    });
  });
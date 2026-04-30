jest.mock('../nbaApi', () => ({
    getPlayers: jest.fn(),
    getPlayerCareerStats: jest.fn(),
  }));
  
  jest.mock('../utils/nbaUtils', () => ({
    rowsToObjects: jest.fn(),
  }));
  
  const router = require('../routes/players');
  const { getPlayers, getPlayerCareerStats } = require('../nbaApi');
  const { rowsToObjects } = require('../utils/nbaUtils');
  
  const getRouteHandler = (path) =>
    router.stack.find(
      (layer) => layer.route && layer.route.path === path
    ).route.stack[0].handle;
  
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };
  
  describe('players routes', () => {
    const playersHandler = getRouteHandler('/players');
    const careerHandler = getRouteHandler('/players/:playerId/career');
  
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    describe('GET /players', () => {
      test('returns mapped players', async () => {
        getPlayers.mockResolvedValue({
          resultSets: [{ name: 'CommonAllPlayers' }],
        });
  
        rowsToObjects.mockReturnValue([
          {
            PERSON_ID: 1,
            DISPLAY_FIRST_LAST: 'Nikola Jokic',
            TEAM_ID: 1610612743,
            TEAM_ABBREVIATION: 'DEN',
            TEAM_NAME: 'Denver Nuggets',
            FROM_YEAR: '2015',
            TO_YEAR: '2025',
            ROSTERSTATUS: 1,
          },
        ]);
  
        const req = { query: {} };
        const res = mockRes();
  
        await playersHandler(req, res);
  
        expect(getPlayers).toHaveBeenCalledWith('0');
        expect(res.json).toHaveBeenCalledWith([
          {
            playerId: 1,
            fullName: 'Nikola Jokic',
            teamId: 1610612743,
            team: 'DEN',
            teamName: 'Denver Nuggets',
            fromYear: '2015',
            toYear: '2025',
            rosterStatus: 1,
          },
        ]);
      });
  
      test('passes currentOnly query through', async () => {
        getPlayers.mockResolvedValue({
          resultSets: [{ name: 'CommonAllPlayers' }],
        });
        rowsToObjects.mockReturnValue([]);
  
        const req = { query: { currentOnly: '1' } };
        const res = mockRes();
  
        await playersHandler(req, res);
  
        expect(getPlayers).toHaveBeenCalledWith('1');
        expect(res.json).toHaveBeenCalledWith([]);
      });
  
      test('filters by normalized search text', async () => {
        getPlayers.mockResolvedValue({
          resultSets: [{ name: 'CommonAllPlayers' }],
        });
  
        rowsToObjects.mockReturnValue([
          {
            PERSON_ID: 1,
            DISPLAY_FIRST_LAST: 'Nikola Jokic',
            TEAM_ID: 1,
            TEAM_ABBREVIATION: 'DEN',
            TEAM_NAME: 'Denver Nuggets',
            FROM_YEAR: '2015',
            TO_YEAR: '2025',
            ROSTERSTATUS: 1,
          },
          {
            PERSON_ID: 2,
            DISPLAY_FIRST_LAST: 'LeBron James',
            TEAM_ID: 2,
            TEAM_ABBREVIATION: 'LAL',
            TEAM_NAME: 'Los Angeles Lakers',
            FROM_YEAR: '2003',
            TO_YEAR: '2025',
            ROSTERSTATUS: 1,
          },
        ]);
  
        const req = { query: { search: 'jokic' } };
        const res = mockRes();
  
        await playersHandler(req, res);
  
        expect(res.json).toHaveBeenCalledWith([
          {
            playerId: 1,
            fullName: 'Nikola Jokic',
            teamId: 1,
            team: 'DEN',
            teamName: 'Denver Nuggets',
            fromYear: '2015',
            toYear: '2025',
            rosterStatus: 1,
          },
        ]);
      });
  
      test('falls back to data.resultSet', async () => {
        getPlayers.mockResolvedValue({
          resultSet: { name: 'LegacyPlayers' },
        });
        rowsToObjects.mockReturnValue([]);
  
        const req = { query: {} };
        const res = mockRes();
  
        await playersHandler(req, res);
  
        expect(rowsToObjects).toHaveBeenCalledWith({ name: 'LegacyPlayers' });
        expect(res.json).toHaveBeenCalledWith([]);
      });
  
      test('returns 500 when player data missing', async () => {
        getPlayers.mockResolvedValue({});
  
        const req = { query: {} };
        const res = mockRes();
  
        await playersHandler(req, res);
  
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Player data missing' });
      });
  
      test('returns 500 when getPlayers throws', async () => {
        getPlayers.mockRejectedValue(new Error('fail'));
  
        const req = { query: {} };
        const res = mockRes();
  
        await playersHandler(req, res);
  
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Failed to fetch players',
          details: 'fail',
        });
      });
    });
  
    describe('GET /players/:playerId/career', () => {
      test('returns mapped career seasons', async () => {
        getPlayerCareerStats.mockResolvedValue({
          resultSets: [{ name: 'SeasonTotalsRegularSeason' }],
        });
  
        rowsToObjects.mockReturnValue([
          {
            SEASON_ID: '2024-25',
            TEAM_ID: 1610612743,
            TEAM_ABBREVIATION: 'DEN',
            GP: 70,
            GS: 70,
            MIN: 34.0,
            PTS: 26.4,
            REB: 12.1,
            AST: 9.0,
            STL: 1.4,
            BLK: 0.8,
            TOV: 3.1,
            FG_PCT: 0.58,
            FG3_PCT: 0.36,
            FT_PCT: 0.82,
          },
        ]);
  
        const req = { params: { playerId: '203999' } };
        const res = mockRes();
  
        await careerHandler(req, res);
  
        expect(getPlayerCareerStats).toHaveBeenCalledWith('203999');
        expect(res.json).toHaveBeenCalledWith({
          playerId: '203999',
          seasons: [
            {
              season: '2024-25',
              teamId: 1610612743,
              team: 'DEN',
              gamesPlayed: 70,
              gamesStarted: 70,
              minutes: 34.0,
              points: 26.4,
              rebounds: 12.1,
              assists: 9.0,
              steals: 1.4,
              blocks: 0.8,
              turnovers: 3.1,
              fgPct: 0.58,
              fg3Pct: 0.36,
              ftPct: 0.82,
            },
          ],
        });
      });
  
      test('returns 500 when career stats missing', async () => {
        getPlayerCareerStats.mockResolvedValue({
          resultSets: [],
        });
  
        const req = { params: { playerId: '203999' } };
        const res = mockRes();
  
        await careerHandler(req, res);
  
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Career stats missing' });
      });
  
      test('returns 500 when career stats fetch throws', async () => {
        getPlayerCareerStats.mockRejectedValue(new Error('career boom'));
  
        const req = { params: { playerId: '203999' } };
        const res = mockRes();
  
        await careerHandler(req, res);
  
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Failed to fetch player career stats',
          details: 'career boom',
        });
      });
    });
  });
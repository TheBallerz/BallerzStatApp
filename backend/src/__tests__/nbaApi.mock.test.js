'use strict';

// ── nbaApi.mock.test.js ───────────────────────────────────────────────────────
// Mock tests for nbaApi.js using Jest's built-in module mocking.
//
// Test double type: STUB + MOCK
//   Stub  — axios.get returns canned responses instead of hitting stats.nba.com
//   Mock  — behavioral assertions verify the correct endpoints and headers are used
//
// No network connection or database is required to run these tests.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('axios');

const axios = require('axios');
const { nbaGet, getPlayers, getTeamGameLog } = require('../nbaApi');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Builds a minimal NBA API response shape for a given result set name. */
function makeNbaResponse(name, headers = [], rowSet = []) {
  return { data: { resultSets: [{ name, headers, rowSet }] } };
}

// ── nbaGet ────────────────────────────────────────────────────────────────────

describe('nbaGet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Silence retry warnings so test output stays clean
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('returns response.data on a successful request', async () => {
    const mockData = { resultSets: [{ name: 'Test', headers: [], rowSet: [] }] };
    axios.get.mockResolvedValue({ data: mockData });

    const result = await nbaGet('commonallplayers');

    expect(result).toEqual(mockData);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test('sends the required NBA anti-scraping headers', async () => {
    axios.get.mockResolvedValue({ data: {} });

    await nbaGet('commonallplayers');

    const callConfig = axios.get.mock.calls[0][1];
    expect(callConfig.headers).toMatchObject({
      'x-nba-stats-origin': 'stats',
      'x-nba-stats-token':  'true',
      Referer:              'https://www.nba.com/',
      Origin:               'https://www.nba.com',
    });
  });

  test('retries on a 500 server error and succeeds on the second attempt', async () => {
    // Make setTimeout fire instantly so the retry delay does not slow the test
    jest.spyOn(global, 'setTimeout').mockImplementation((fn) => { fn(); return 0; });

    const mockData = { resultSets: [] };
    axios.get
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce({ data: mockData });

    const result = await nbaGet('commonallplayers');

    expect(result).toEqual(mockData);
    // Called twice — once for the failed attempt, once for the successful retry
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test('throws after exhausting all 3 retries', async () => {
    jest.spyOn(global, 'setTimeout').mockImplementation((fn) => { fn(); return 0; });

    const serverError = { response: { status: 500 } };
    axios.get.mockRejectedValue(serverError);

    await expect(nbaGet('commonallplayers', {}, 3)).rejects.toEqual(serverError);
    // One call per retry attempt
    expect(axios.get).toHaveBeenCalledTimes(3);
  });

  test('does NOT retry on a 400 client error', async () => {
    const clientError = { response: { status: 400 } };
    axios.get.mockRejectedValue(clientError);

    await expect(nbaGet('commonallplayers')).rejects.toEqual(clientError);
    // 400 is not retryable — only one call should be made
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});

// ── getPlayers ────────────────────────────────────────────────────────────────

describe('getPlayers', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calls the commonallplayers endpoint', async () => {
    axios.get.mockResolvedValue(
      makeNbaResponse('CommonAllPlayers', ['PERSON_ID'], [[203999]]),
    );

    await getPlayers();

    const calledUrl = axios.get.mock.calls[0][0];
    expect(calledUrl).toContain('commonallplayers');
  });

  test('includes IsOnlyCurrentSeason and LeagueID params', async () => {
    axios.get.mockResolvedValue(makeNbaResponse('CommonAllPlayers'));

    await getPlayers('1');

    const calledParams = axios.get.mock.calls[0][1].params;
    expect(calledParams).toMatchObject({
      IsOnlyCurrentSeason: '1',
      LeagueID: '00',
    });
  });

  test('returns the full resultSets data from the API', async () => {
    const mockResponse = makeNbaResponse('CommonAllPlayers', ['PERSON_ID'], [[203999]]);
    axios.get.mockResolvedValue(mockResponse);

    const result = await getPlayers();

    expect(result).toEqual(mockResponse.data);
  });
});

// ── getTeamGameLog ────────────────────────────────────────────────────────────

describe('getTeamGameLog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Make retry delays instant
    jest.spyOn(global, 'setTimeout').mockImplementation((fn) => { fn(); return 0; });
  });

  afterEach(() => jest.restoreAllMocks());

  test('fires two axios calls — one per season type (Regular Season + Playoffs)', async () => {
    const mockResponse = makeNbaResponse('LeagueGameLog', ['GAME_ID'], [['0022401000']]);
    axios.get.mockResolvedValue(mockResponse);

    await getTeamGameLog('2024-25', null);

    // fetchBothSeasonTypes makes one call for Regular Season and one for Playoffs
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test('uses PlayerOrTeam=T to request team-level rows', async () => {
    const mockResponse = makeNbaResponse('LeagueGameLog');
    axios.get.mockResolvedValue(mockResponse);

    await getTeamGameLog('2024-25', null);

    const calledParams = axios.get.mock.calls[0][1].params;
    expect(calledParams).toMatchObject({ PlayerOrTeam: 'T' });
  });

  test('returns a merged resultSet with rows from both season types', async () => {
    // Each season type returns one row — the merge should concatenate them
    const regularRow = ['0022401000', 'Regular'];
    const playoffRow = ['0042401000', 'Playoff'];

    axios.get
      .mockResolvedValueOnce({
        data: { resultSets: [{ name: 'LeagueGameLog', headers: ['GAME_ID', 'TYPE'], rowSet: [regularRow] }] },
      })
      .mockResolvedValueOnce({
        data: { resultSets: [{ name: 'LeagueGameLog', headers: ['GAME_ID', 'TYPE'], rowSet: [playoffRow] }] },
      });

    const result = await getTeamGameLog('2024-25', null);

    const rows = result.resultSets[0].rowSet;
    expect(rows).toHaveLength(2);
    expect(rows).toContainEqual(regularRow);
    expect(rows).toContainEqual(playoffRow);
  });
});

'use strict';

// ── nightlySync.mock.test.js ──────────────────────────────────────────────────
// Mock tests for the runSync() pipeline in nightlySync.js.
//
// Test double type: MOCK
//   Every external dependency (all Mongoose models, the nbaApi module, and the
//   seasonStatsService) is replaced with jest.fn() stubs so that runSync() can
//   be exercised in complete isolation — no database, no network, no cron job.
//
// Key behavioral assertions ("are our functions being called?"):
//   - TeamGameStats.create is called when a new game is found
//   - TeamGameStats.create is NOT called when a game already exists
//   - runSync() resolves even when the schedule step throws (non-fatal)
// ─────────────────────────────────────────────────────────────────────────────

// ── Mock every Mongoose model used by nightlySync ────────────────────────────

jest.mock('../models/Team', () => ({
  countDocuments: jest.fn(),
  find:           jest.fn(),
}));

jest.mock('../models/Player', () => ({
  countDocuments: jest.fn(),
  find:           jest.fn(),
}));

jest.mock('../models/TeamSeasonStats', () => ({
  countDocuments: jest.fn(),
}));

jest.mock('../models/TeamGameStats', () => ({
  exists: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../models/PlayerGameStats', () => ({
  exists: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../models/PlayerCareerStats', () => ({
  countDocuments: jest.fn(),
}));

jest.mock('../models/GameSchedule', () => ({
  findOneAndUpdate: jest.fn(),
}));

// ── Mock the nbaApi module ────────────────────────────────────────────────────

jest.mock('../nbaApi', () => ({
  CURRENT_SEASON:      '2024-25',
  getTeamGameLog:      jest.fn(),
  getPlayerGameLog:    jest.fn(),
  getPlayerCareerStats: jest.fn(),
  nbaGet:              jest.fn(),
}));

// ── Mock the season stats service ────────────────────────────────────────────

jest.mock('../services/seasonStatsService', () => ({
  ingestTeamSeasonBaseline:   jest.fn(),
  ingestPlayerSeasonBaseline: jest.fn(),
  updateTeamSeasonStats:      jest.fn(),
  updatePlayerSeasonStats:    jest.fn(),
}));

// ── Imports (after mocks are declared) ───────────────────────────────────────

const { runSync } = require('../jobs/nightlySync');

const Team             = require('../models/Team');
const Player           = require('../models/Player');
const TeamSeasonStats  = require('../models/TeamSeasonStats');
const TeamGameStats    = require('../models/TeamGameStats');
const PlayerGameStats  = require('../models/PlayerGameStats');
const PlayerCareerStats = require('../models/PlayerCareerStats');
const GameSchedule     = require('../models/GameSchedule');

const { getTeamGameLog, getPlayerGameLog, nbaGet } = require('../nbaApi');
const { updateTeamSeasonStats, updatePlayerSeasonStats } = require('../services/seasonStatsService');

// ── Shared fixture data ───────────────────────────────────────────────────────

// Two teams so MATCHUP "BOS vs. MIA" can resolve both home and opponent
const TEAM_BOS = { _id: 'bos_id', nbaId: 1610612738, abbreviation: 'BOS' };
const TEAM_MIA = { _id: 'mia_id', nbaId: 1610612748, abbreviation: 'MIA' };
const PLAYER   = { _id: 'jokic_id', nbaId: 203999 };

// Minimal game log shape — rowsToObjects maps headers → values per row
const TEAM_GAME_HEADERS = [
  'GAME_ID','TEAM_ID','MATCHUP','GAME_DATE','WL',
  'PTS','REB','AST','STL','BLK','TOV',
  'FGM','FGA','FG3M','FG3A','FTM','FTA','PLUS_MINUS',
];
const TEAM_GAME_ROW = [
  '0022401000', 1610612738, 'BOS vs. MIA', '2025-03-01', 'W',
  120, 45, 28, 7, 5, 12,
  44, 90, 15, 35, 20, 25, 10,
];

const PLAYER_GAME_HEADERS = [
  'GAME_ID','PLAYER_ID','TEAM_ID','MATCHUP','GAME_DATE','WL',
  'PTS','MIN','REB','AST','STL','BLK','TOV',
  'FGM','FGA','FG3M','FG3A','FTM','FTA',
];
const PLAYER_GAME_ROW = [
  '0022401000', 203999, 1610612738, 'BOS vs. MIA', '2025-03-01', 'W',
  30, '35:00', 12, 8, 1, 1, 3,
  11, 20, 2, 5, 7, 9,
];

function makeGameLog(headers, rows) {
  return { resultSets: [{ name: 'LeagueGameLog', headers, rowSet: rows }] };
}

// ── Shared setup for a normal nightly run (not first run) ────────────────────
// Teams and players exist, TeamSeasonStats already has docs → isFirstRun = false

function setupNormalRun() {
  Team.countDocuments.mockResolvedValue(2);
  Player.countDocuments.mockResolvedValue(1);
  Team.find.mockResolvedValue([TEAM_BOS, TEAM_MIA]);
  Player.find.mockResolvedValue([PLAYER]);

  // Not a first run — season stats already exist
  TeamSeasonStats.countDocuments.mockResolvedValue(5);

  // Game logs from the NBA API
  getTeamGameLog.mockResolvedValue(makeGameLog(TEAM_GAME_HEADERS, [TEAM_GAME_ROW]));
  getPlayerGameLog.mockResolvedValue(makeGameLog(PLAYER_GAME_HEADERS, [PLAYER_GAME_ROW]));

  // Career stats already populated — skip ingestion
  PlayerCareerStats.countDocuments.mockResolvedValue(10);

  // Schedule — empty game list (no games today)
  nbaGet.mockResolvedValue({ resultSets: [] });

  // Season stat updaters succeed silently
  updateTeamSeasonStats.mockResolvedValue();
  updatePlayerSeasonStats.mockResolvedValue();
}

// ─────────────────────────────────────────────────────────────────────────────

describe('runSync — prerequisites gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('throws when the Team collection is empty', async () => {
    Team.countDocuments.mockResolvedValue(0);
    Player.countDocuments.mockResolvedValue(500);

    await expect(runSync()).rejects.toThrow(/Prerequisites not met/);
  });

  test('throws when the Player collection is empty', async () => {
    Team.countDocuments.mockResolvedValue(30);
    Player.countDocuments.mockResolvedValue(0);

    await expect(runSync()).rejects.toThrow(/Prerequisites not met/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('runSync — game log sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('inserts a new TeamGameStats document when the game does not yet exist', async () => {
    setupNormalRun();
    // exists() returns null → game is new → create() should be called
    TeamGameStats.exists.mockResolvedValue(null);
    TeamGameStats.create.mockResolvedValue({ _id: 'new_team_stat' });
    PlayerGameStats.exists.mockResolvedValue(null);
    PlayerGameStats.create.mockResolvedValue({ _id: 'new_player_stat' });

    await runSync();

    expect(TeamGameStats.create).toHaveBeenCalledTimes(1);
    // Confirm the created document contains key game fields
    expect(TeamGameStats.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nbaGameId: 22401000,
        season:    '2024-25',
        teamId:    TEAM_BOS._id,
        points:    120,
      }),
    );
  });

  test('skips inserting when the game already exists in the DB', async () => {
    setupNormalRun();
    // exists() returns a truthy value → game already stored → create() must not be called
    TeamGameStats.exists.mockResolvedValue({ _id: 'already_there' });
    PlayerGameStats.exists.mockResolvedValue({ _id: 'already_there' });

    await runSync();

    expect(TeamGameStats.create).not.toHaveBeenCalled();
  });

  test('calls updateTeamSeasonStats after inserting a new game on a non-first run', async () => {
    setupNormalRun();
    TeamGameStats.exists.mockResolvedValue(null);
    TeamGameStats.create.mockResolvedValue({ _id: 'new_team_stat' });
    PlayerGameStats.exists.mockResolvedValue(null);
    PlayerGameStats.create.mockResolvedValue({ _id: 'new_player_stat' });

    await runSync();

    // shouldUpdateSeasonStats is true on a non-first run
    expect(updateTeamSeasonStats).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('runSync — schedule sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('resolves successfully even when the schedule API call fails', async () => {
    setupNormalRun();
    TeamGameStats.exists.mockResolvedValue({ _id: 'exists' });
    PlayerGameStats.exists.mockResolvedValue({ _id: 'exists' });

    // Schedule fetch fails — this step is marked non-fatal in nightlySync.js
    nbaGet.mockRejectedValue(new Error('scoreboardv2 blocked'));

    await expect(runSync()).resolves.not.toThrow();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Schedule sync failed'),
      expect.any(String),
    );
  });
});

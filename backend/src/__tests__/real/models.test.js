'use strict';

const mongoose = require('mongoose');

// Import all models
const Team = require('../../models/Team');
const Player = require('../../models/Player');
const User = require('../../models/User');
const TeamGameStats = require('../../models/TeamGameStats');
const PlayerGameStats = require('../../models/PlayerGameStats');
const TeamSeasonStats = require('../../models/TeamSeasonStats');
const PlayerSeasonStats = require('../../models/PlayerSeasonStats');

// Connect to the in-memory MongoDB instance before all tests run
beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_TEST_URI);
  // Sync compound unique indexes for the two season-stats models
  // Without this, duplicate-rejection tests would silently pass
  await TeamSeasonStats.syncIndexes();
  await PlayerSeasonStats.syncIndexes();
});

// Disconnect and clean up after all tests finish
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (global.__MONGOD__) await global.__MONGOD__.stop();
});

// Clear every collection between tests so unique-index tests don't bleed into each other
beforeEach(async () => {
  for (const key in mongoose.connection.collections) {
    await mongoose.connection.collections[key].deleteMany({});
  }
});

// ---------------------------------------------------------------------------
// TEAM MODEL
// ---------------------------------------------------------------------------
describe('Team Model', () => {
  // Helper that returns the minimum valid data for a Team document
  function validTeam() {
    return {
      name: 'Los Angeles Lakers',
      city: 'Los Angeles',
      abbreviation: 'LAL',
      conference: 'Western',
      division: 'Pacific',
    };
  }

  it('creates a valid team and persists all required fields', async () => {
    const team = await Team.create(validTeam());
    expect(team._id).toBeDefined();
    expect(team.name).toBe('Los Angeles Lakers');
    expect(team.conference).toBe('Western');
  });

  it('initialises roster as an empty array and sets timestamps', async () => {
    const team = await Team.create(validTeam());
    expect(team.roster).toEqual([]);
    expect(team.createdAt).toBeInstanceOf(Date);
  });

  it('fails when a required field is missing', async () => {
    // Remove 'name' — any required field being absent should throw ValidationError
    const data = validTeam();
    delete data.name;
    await expect(Team.create(data)).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects an invalid conference enum value', async () => {
    const data = { ...validTeam(), conference: 'Midwestern' };
    await expect(Team.create(data)).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects a duplicate team name (unique index)', async () => {
    await Team.create(validTeam());
    // Second document has a different abbreviation but the same name
    await expect(Team.create({ ...validTeam(), abbreviation: 'LAK' })).rejects.toMatchObject({ code: 11000 });
  });

  it('finds a team by _id', async () => {
    const created = await Team.create(validTeam());
    const found = await Team.findById(created._id);
    // Verifies that the read function works and returns the correct document
    expect(found).not.toBeNull();
    expect(found._id.toString()).toBe(created._id.toString());
  });

  it('updates a team field', async () => {
    const team = await Team.create(validTeam());
    await Team.findByIdAndUpdate(team._id, { city: 'Inglewood' });
    const updated = await Team.findById(team._id);
    expect(updated.city).toBe('Inglewood');
  });

  it('deletes a team', async () => {
    const team = await Team.create(validTeam());
    await Team.findByIdAndDelete(team._id);
    const found = await Team.findById(team._id);
    expect(found).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PLAYER MODEL
// ---------------------------------------------------------------------------
describe('Player Model', () => {
  // Players require a teamId ObjectId reference (no real Team document needed)
  function validPlayer() {
    return {
      firstName: 'LeBron',
      lastName: 'James',
      position: 'SF',
      teamId: new mongoose.Types.ObjectId(),
    };
  }

  it('creates a valid player and applies the default country', async () => {
    const player = await Player.create(validPlayer());
    expect(player._id).toBeDefined();
    // country should default to 'USA' when not provided
    expect(player.country).toBe('USA');
  });

  it('fails when a required field is missing', async () => {
    const data = validPlayer();
    delete data.firstName;
    await expect(Player.create(data)).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects an invalid position enum value', async () => {
    const data = { ...validPlayer(), position: 'QB' };
    await expect(Player.create(data)).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects a jerseyNumber outside the 0–99 range', async () => {
    // max is 99
    const data = { ...validPlayer(), jerseyNumber: 100 };
    await expect(Player.create(data)).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('finds a player by _id', async () => {
    const created = await Player.create(validPlayer());
    const found = await Player.findById(created._id);
    expect(found).not.toBeNull();
    expect(found.lastName).toBe('James');
  });

  it('updates a player field', async () => {
    const player = await Player.create(validPlayer());
    await Player.findByIdAndUpdate(player._id, { lastName: 'Updated' });
    const updated = await Player.findById(player._id);
    expect(updated.lastName).toBe('Updated');
  });

  it('deletes a player', async () => {
    const player = await Player.create(validPlayer());
    await Player.findByIdAndDelete(player._id);
    expect(await Player.findById(player._id)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// USER MODEL
// ---------------------------------------------------------------------------
describe('User Model', () => {
  function validUser() {
    return {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'Baller@Example.COM',
      passwordHash: 'hashedpassword123',
    };
  }

  it('creates a valid user and stores email in lowercase', async () => {
    const user = await User.create(validUser());
    expect(user._id).toBeDefined();
    // The schema has lowercase: true on email
    expect(user.email).toBe('baller@example.com');
  });

  it('initialises favorite arrays as empty', async () => {
    const user = await User.create(validUser());
    expect(user.favoritePlayers).toEqual([]);
    expect(user.favoriteTeams).toEqual([]);
  });

  it('fails when a required field is missing', async () => {
    const data = validUser();
    delete data.passwordHash;
    await expect(User.create(data)).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects a duplicate email (unique index)', async () => {
    await User.create(validUser());
    // Same email but different name should fail on the unique email constraint
    await expect(User.create({ ...validUser(), firstName: 'Other' })).rejects.toMatchObject({ code: 11000 });
  });

  it('finds a user by _id', async () => {
    const created = await User.create(validUser());
    const found = await User.findById(created._id);
    expect(found).not.toBeNull();
    expect(found.email).toBe('baller@example.com');
  });

  it('updates a user field', async () => {
    const user = await User.create(validUser());
    await User.findByIdAndUpdate(user._id, { firstName: 'Updated' });
    const updated = await User.findById(user._id);
    expect(updated.firstName).toBe('Updated');
  });

  it('deletes a user', async () => {
    const user = await User.create(validUser());
    await User.findByIdAndDelete(user._id);
    expect(await User.findById(user._id)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TEAM GAME STATS MODEL
// ---------------------------------------------------------------------------
describe('TeamGameStats Model', () => {
  function validTeamGameStats() {
    return {
      nbaGameId: 22401234,
      season: '2024-25',
      result: 'W',
      teamId: new mongoose.Types.ObjectId(),
      opponentTeamId: new mongoose.Types.ObjectId(),
      gameDate: new Date('2025-01-15'),
    };
  }

  it('creates a valid record and defaults all stat fields to 0', async () => {
    const record = await TeamGameStats.create(validTeamGameStats());
    expect(record._id).toBeDefined();
    // Spot-check a few stat defaults
    expect(record.points).toBe(0);
    expect(record.oppPoints).toBe(0);
    expect(record.rebounds).toBe(0);
  });

  it('fails when a required field is missing', async () => {
    const data = validTeamGameStats();
    delete data.gameDate;
    await expect(TeamGameStats.create(data)).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects a negative stat value (min:0 constraint)', async () => {
    const data = { ...validTeamGameStats(), points: -1 };
    await expect(TeamGameStats.create(data)).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('finds a record by _id', async () => {
    const created = await TeamGameStats.create(validTeamGameStats());
    const found = await TeamGameStats.findById(created._id);
    expect(found).not.toBeNull();
  });

  it('updates a stat field', async () => {
    const record = await TeamGameStats.create(validTeamGameStats());
    await TeamGameStats.findByIdAndUpdate(record._id, { points: 110 });
    const updated = await TeamGameStats.findById(record._id);
    expect(updated.points).toBe(110);
  });

  it('deletes a record', async () => {
    const record = await TeamGameStats.create(validTeamGameStats());
    await TeamGameStats.findByIdAndDelete(record._id);
    expect(await TeamGameStats.findById(record._id)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PLAYER GAME STATS MODEL
// ---------------------------------------------------------------------------
describe('PlayerGameStats Model', () => {
  function validPlayerGameStats() {
    return {
      nbaGameId: 22401234,
      season: '2024-25',
      playerId: new mongoose.Types.ObjectId(),
      teamId: new mongoose.Types.ObjectId(),
      opponentTeamId: new mongoose.Types.ObjectId(),
      gameDate: new Date('2025-01-15'),
    };
  }

  it('creates a valid record and defaults all stat fields to 0', async () => {
    const record = await PlayerGameStats.create(validPlayerGameStats());
    expect(record._id).toBeDefined();
    expect(record.points).toBe(0);
    expect(record.assists).toBe(0);
    expect(record.rebounds).toBe(0);
  });

  it('fails when a required field is missing', async () => {
    const data = validPlayerGameStats();
    delete data.playerId;
    await expect(PlayerGameStats.create(data)).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects a negative stat value (min:0 constraint)', async () => {
    const data = { ...validPlayerGameStats(), points: -5 };
    await expect(PlayerGameStats.create(data)).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('finds a record by _id', async () => {
    const created = await PlayerGameStats.create(validPlayerGameStats());
    const found = await PlayerGameStats.findById(created._id);
    expect(found).not.toBeNull();
  });

  it('updates a stat field', async () => {
    const record = await PlayerGameStats.create(validPlayerGameStats());
    await PlayerGameStats.findByIdAndUpdate(record._id, { points: 30 });
    const updated = await PlayerGameStats.findById(record._id);
    expect(updated.points).toBe(30);
  });

  it('deletes a record', async () => {
    const record = await PlayerGameStats.create(validPlayerGameStats());
    await PlayerGameStats.findByIdAndDelete(record._id);
    expect(await PlayerGameStats.findById(record._id)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TEAM SEASON STATS MODEL
// ---------------------------------------------------------------------------
describe('TeamSeasonStats Model', () => {
  function validTeamSeasonStats() {
    return {
      teamId: new mongoose.Types.ObjectId(),
      season: '2024-25',
    };
  }

  it('creates a valid record and defaults wins, losses, and averages to 0', async () => {
    const record = await TeamSeasonStats.create(validTeamSeasonStats());
    expect(record._id).toBeDefined();
    expect(record.wins).toBe(0);
    expect(record.losses).toBe(0);
    expect(record.avgPoints).toBe(0);
  });

  it('initialises gameStats as an empty array', async () => {
    const record = await TeamSeasonStats.create(validTeamSeasonStats());
    expect(record.gameStats).toEqual([]);
  });

  it('fails when a required field is missing', async () => {
    const data = validTeamSeasonStats();
    delete data.season;
    await expect(TeamSeasonStats.create(data)).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects a duplicate teamId + season combination (compound unique index)', async () => {
    const sharedTeamId = new mongoose.Types.ObjectId();
    await TeamSeasonStats.create({ teamId: sharedTeamId, season: '2024-25' });
    // Same teamId + same season should fail
    await expect(
      TeamSeasonStats.create({ teamId: sharedTeamId, season: '2024-25' }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('finds a record by _id', async () => {
    const created = await TeamSeasonStats.create(validTeamSeasonStats());
    const found = await TeamSeasonStats.findById(created._id);
    expect(found).not.toBeNull();
  });

  it('updates wins', async () => {
    const record = await TeamSeasonStats.create(validTeamSeasonStats());
    await TeamSeasonStats.findByIdAndUpdate(record._id, { wins: 50 });
    const updated = await TeamSeasonStats.findById(record._id);
    expect(updated.wins).toBe(50);
  });

  it('deletes a record', async () => {
    const record = await TeamSeasonStats.create(validTeamSeasonStats());
    await TeamSeasonStats.findByIdAndDelete(record._id);
    expect(await TeamSeasonStats.findById(record._id)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PLAYER SEASON STATS MODEL
// ---------------------------------------------------------------------------
describe('PlayerSeasonStats Model', () => {
  function validPlayerSeasonStats() {
    return {
      playerId: new mongoose.Types.ObjectId(),
      teamId: new mongoose.Types.ObjectId(),
      season: '2024-25',
    };
  }

  it('creates a valid record and defaults all averages to 0', async () => {
    const record = await PlayerSeasonStats.create(validPlayerSeasonStats());
    expect(record._id).toBeDefined();
    expect(record.avgPoints).toBe(0);
    expect(record.gamesPlayed).toBe(0);
  });

  it('initialises gameStats as an empty array', async () => {
    const record = await PlayerSeasonStats.create(validPlayerSeasonStats());
    expect(record.gameStats).toEqual([]);
  });

  it('fails when a required field is missing', async () => {
    const data = validPlayerSeasonStats();
    delete data.season;
    await expect(PlayerSeasonStats.create(data)).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects a duplicate playerId + season combination (compound unique index)', async () => {
    const sharedPlayerId = new mongoose.Types.ObjectId();
    const teamId = new mongoose.Types.ObjectId();
    await PlayerSeasonStats.create({ playerId: sharedPlayerId, teamId, season: '2024-25' });
    // Same playerId + same season should fail
    await expect(
      PlayerSeasonStats.create({ playerId: sharedPlayerId, teamId, season: '2024-25' }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('finds a record by _id', async () => {
    const created = await PlayerSeasonStats.create(validPlayerSeasonStats());
    const found = await PlayerSeasonStats.findById(created._id);
    expect(found).not.toBeNull();
  });

  it('updates avgPoints', async () => {
    const record = await PlayerSeasonStats.create(validPlayerSeasonStats());
    await PlayerSeasonStats.findByIdAndUpdate(record._id, { avgPoints: 28.5 });
    const updated = await PlayerSeasonStats.findById(record._id);
    expect(updated.avgPoints).toBe(28.5);
  });

  it('deletes a record', async () => {
    const record = await PlayerSeasonStats.create(validPlayerSeasonStats());
    await PlayerSeasonStats.findByIdAndDelete(record._id);
    expect(await PlayerSeasonStats.findById(record._id)).toBeNull();
  });
});

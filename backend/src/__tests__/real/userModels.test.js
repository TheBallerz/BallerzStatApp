'use strict';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose      = require('mongoose');
const PlayerBio     = require('../../models/PlayerBio');
const UserGameStats = require('../../models/UserGameStats');
const UserSeasonStats = require('../../models/UserSeasonStats');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await PlayerBio.syncIndexes();
  await UserGameStats.syncIndexes();
  await UserSeasonStats.syncIndexes();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  for (const key in mongoose.connection.collections) {
    await mongoose.connection.collections[key].deleteMany({});
  }
});

// ── PlayerBio Model ───────────────────────────────────────────────────────────

describe('PlayerBio Model', () => {
  function validBio() {
    return {
      playerId: '2544',
      fullName: 'LeBron James',
      team:     'LAL',
      bio:      'LeBron James is an NBA forward.',
    };
  }

  it('creates and persists a valid bio document', async () => {
    const doc = await PlayerBio.create(validBio());

    expect(doc._id).toBeDefined();
    expect(doc.playerId).toBe('2544');
    expect(doc.fullName).toBe('LeBron James');
    expect(doc.bio).toBe('LeBron James is an NBA forward.');
  });

  it('defaults source to "wikipedia"', async () => {
    const doc = await PlayerBio.create(validBio());

    expect(doc.source).toBe('wikipedia');
  });

  it('sets createdAt and updatedAt timestamps', async () => {
    const doc = await PlayerBio.create(validBio());

    expect(doc.createdAt).toBeInstanceOf(Date);
    expect(doc.updatedAt).toBeInstanceOf(Date);
  });

  it('stores optional sourceUrl when provided', async () => {
    const doc = await PlayerBio.create({
      ...validBio(),
      sourceUrl: 'https://en.wikipedia.org/wiki/LeBron_James',
    });

    expect(doc.sourceUrl).toBe('https://en.wikipedia.org/wiki/LeBron_James');
  });

  it('rejects a document missing required playerId', async () => {
    const noId = validBio();
    delete noId.playerId;

    await expect(PlayerBio.create(noId)).rejects.toThrow(
      mongoose.Error.ValidationError,
    );
  });

  it('rejects a document missing required fullName', async () => {
    const noName = validBio();
    delete noName.fullName;

    await expect(PlayerBio.create(noName)).rejects.toThrow(
      mongoose.Error.ValidationError,
    );
  });

  it('rejects a document missing required bio', async () => {
    const noBio = validBio();
    delete noBio.bio;

    await expect(PlayerBio.create(noBio)).rejects.toThrow(
      mongoose.Error.ValidationError,
    );
  });

  it('rejects duplicate playerId (unique constraint)', async () => {
    await PlayerBio.create(validBio());

    await expect(PlayerBio.create({ ...validBio(), fullName: 'Other Name' })).rejects.toMatchObject({
      code: 11000,
    });
  });

  it('supports CRUD operations', async () => {
    const doc = await PlayerBio.create(validBio());

    const found = await PlayerBio.findById(doc._id);
    expect(found).not.toBeNull();

    await PlayerBio.findByIdAndUpdate(doc._id, { bio: 'Updated bio.' });
    const updated = await PlayerBio.findById(doc._id);
    expect(updated.bio).toBe('Updated bio.');

    await PlayerBio.findByIdAndDelete(doc._id);
    expect(await PlayerBio.findById(doc._id)).toBeNull();
  });
});

// ── UserGameStats Model ───────────────────────────────────────────────────────

describe('UserGameStats Model', () => {
  let fakeUserId;

  beforeEach(() => {
    fakeUserId = new mongoose.Types.ObjectId();
  });

  function validGame(userId) {
    return {
      userId,
      gameDate: new Date('2025-03-15'),
      points:   25,
      assists:  6,
      rebounds: 9,
    };
  }

  it('creates and persists a valid game document', async () => {
    const doc = await UserGameStats.create(validGame(fakeUserId));

    expect(doc._id).toBeDefined();
    expect(doc.userId.toString()).toBe(fakeUserId.toString());
    expect(doc.points).toBe(25);
  });

  it('defaults all optional numeric fields to 0', async () => {
    const minimal = { userId: fakeUserId, gameDate: new Date() };
    const doc = await UserGameStats.create(minimal);

    expect(doc.points).toBe(0);
    expect(doc.assists).toBe(0);
    expect(doc.rebounds).toBe(0);
    expect(doc.threePointersMade).toBe(0);
    expect(doc.steals).toBe(0);
    expect(doc.blocks).toBe(0);
    expect(doc.turnovers).toBe(0);
    expect(doc.minutes).toBe(0);
    expect(doc.opponent).toBe('');
  });

  it('rejects negative stat values (min: 0 validator)', async () => {
    await expect(
      UserGameStats.create({ ...validGame(fakeUserId), points: -1 }),
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects a document missing required userId', async () => {
    await expect(
      UserGameStats.create({ gameDate: new Date() }),
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects a document missing required gameDate', async () => {
    await expect(
      UserGameStats.create({ userId: fakeUserId }),
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('sets createdAt and updatedAt timestamps', async () => {
    const doc = await UserGameStats.create(validGame(fakeUserId));

    expect(doc.createdAt).toBeInstanceOf(Date);
    expect(doc.updatedAt).toBeInstanceOf(Date);
  });

  it('supports CRUD operations', async () => {
    const doc = await UserGameStats.create(validGame(fakeUserId));

    const found = await UserGameStats.findById(doc._id);
    expect(found).not.toBeNull();

    await UserGameStats.findByIdAndUpdate(doc._id, { $set: { points: 30 } });
    const updated = await UserGameStats.findById(doc._id);
    expect(updated.points).toBe(30);

    await UserGameStats.findByIdAndDelete(doc._id);
    expect(await UserGameStats.findById(doc._id)).toBeNull();
  });
});

// ── UserSeasonStats Model ─────────────────────────────────────────────────────

describe('UserSeasonStats Model', () => {
  let fakeUserId;

  beforeEach(() => {
    fakeUserId = new mongoose.Types.ObjectId();
  });

  function validStats(userId) {
    return { userId };
  }

  it('creates and persists a valid season stats document', async () => {
    const doc = await UserSeasonStats.create(validStats(fakeUserId));

    expect(doc._id).toBeDefined();
    expect(doc.userId.toString()).toBe(fakeUserId.toString());
  });

  it('defaults all average fields to 0', async () => {
    const doc = await UserSeasonStats.create(validStats(fakeUserId));

    expect(doc.gamesPlayed).toBe(0);
    expect(doc.avgPoints).toBe(0);
    expect(doc.avgAssists).toBe(0);
    expect(doc.avgRebounds).toBe(0);
    expect(doc.avgFg3m).toBe(0);
    expect(doc.avgSteals).toBe(0);
    expect(doc.avgBlocks).toBe(0);
    expect(doc.avgTurnovers).toBe(0);
    expect(doc.avgMinutes).toBe(0);
  });

  it('rejects a document missing required userId', async () => {
    await expect(UserSeasonStats.create({})).rejects.toThrow(
      mongoose.Error.ValidationError,
    );
  });

  it('rejects duplicate userId (unique constraint)', async () => {
    await UserSeasonStats.create(validStats(fakeUserId));

    await expect(
      UserSeasonStats.create(validStats(fakeUserId)),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('sets createdAt and updatedAt timestamps', async () => {
    const doc = await UserSeasonStats.create(validStats(fakeUserId));

    expect(doc.createdAt).toBeInstanceOf(Date);
    expect(doc.updatedAt).toBeInstanceOf(Date);
  });

  it('supports CRUD operations', async () => {
    const doc = await UserSeasonStats.create(validStats(fakeUserId));

    const found = await UserSeasonStats.findById(doc._id);
    expect(found).not.toBeNull();

    await UserSeasonStats.findByIdAndUpdate(doc._id, { $set: { avgPoints: 22.5 } });
    const updated = await UserSeasonStats.findById(doc._id);
    expect(updated.avgPoints).toBe(22.5);

    await UserSeasonStats.findByIdAndDelete(doc._id);
    expect(await UserSeasonStats.findById(doc._id)).toBeNull();
  });
});

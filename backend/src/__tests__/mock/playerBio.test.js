'use strict';

jest.mock('../../models/PlayerBio', () => ({
  findOne: jest.fn(),
  create:  jest.fn(),
}));

jest.mock('../../services/wikipediaService', () => ({
  getWikipediaBio: jest.fn(),
}));

const router          = require('../../routes/playerBioRoutes');
const PlayerBio       = require('../../models/PlayerBio');
const { getWikipediaBio } = require('../../services/wikipediaService');

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

const HANDLER = getHandler('/:playerId/bio');

const EXISTING_BIO = {
  playerId:  '2544',
  fullName:  'LeBron James',
  team:      'LAL',
  bio:       'LeBron James is a forward.',
  sourceUrl: 'https://en.wikipedia.org/wiki/LeBron_James',
  source:    'wikipedia',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('GET /:playerId/bio', () => {
  test('returns 200 with cached bio when one already exists', async () => {
    PlayerBio.findOne.mockResolvedValue(EXISTING_BIO);

    const req = { params: { playerId: '2544' }, query: {} };
    const res = mockRes();
    await HANDLER(req, res);

    expect(PlayerBio.findOne).toHaveBeenCalledWith({ playerId: '2544' });
    expect(res.json).toHaveBeenCalledWith(EXISTING_BIO);
    expect(res.status).not.toHaveBeenCalled();
    expect(getWikipediaBio).not.toHaveBeenCalled();
  });

  test('returns 400 when fullName is missing and no cached bio exists', async () => {
    PlayerBio.findOne.mockResolvedValue(null);

    const req = { params: { playerId: '9999' }, query: {} };
    const res = mockRes();
    await HANDLER(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'fullName is required when creating a new bio',
    });
    expect(getWikipediaBio).not.toHaveBeenCalled();
  });

  test('fetches Wikipedia and returns 201 with created bio when none exists', async () => {
    PlayerBio.findOne.mockResolvedValue(null);
    getWikipediaBio.mockResolvedValue({
      bio:       'LeBron James is a forward.',
      sourceUrl: 'https://en.wikipedia.org/wiki/LeBron_James',
    });
    PlayerBio.create.mockResolvedValue(EXISTING_BIO);

    const req = {
      params: { playerId: '2544' },
      query:  { fullName: 'LeBron James', team: 'LAL' },
    };
    const res = mockRes();
    await HANDLER(req, res);

    expect(getWikipediaBio).toHaveBeenCalledWith('LeBron James');
    expect(PlayerBio.create).toHaveBeenCalledWith({
      playerId:  '2544',
      fullName:  'LeBron James',
      team:      'LAL',
      bio:       'LeBron James is a forward.',
      sourceUrl: 'https://en.wikipedia.org/wiki/LeBron_James',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(EXISTING_BIO);
  });

  test('returns 500 when PlayerBio.findOne throws', async () => {
    PlayerBio.findOne.mockRejectedValue(new Error('DB error'));

    const req = { params: { playerId: '2544' }, query: { fullName: 'LeBron James' } };
    const res = mockRes();
    await HANDLER(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to load player bio' });
  });

  test('returns 500 when Wikipedia service throws', async () => {
    PlayerBio.findOne.mockResolvedValue(null);
    getWikipediaBio.mockRejectedValue(new Error('Wikipedia unavailable'));

    const req = {
      params: { playerId: '2544' },
      query:  { fullName: 'LeBron James' },
    };
    const res = mockRes();
    await HANDLER(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to load player bio' });
  });
});

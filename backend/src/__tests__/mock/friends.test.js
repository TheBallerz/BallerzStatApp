'use strict';

jest.mock('../../models/User', () => ({
  findById:          jest.fn(),
  find:              jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock('../../models/UserSeasonStats', () => ({
  find: jest.fn(),
}));

jest.mock('../../middleware/auth', () => ({
  requireAuth: (req, _res, next) => { req.userId = 'user-me'; next(); },
}));

const router          = require('../../routes/friends');
const User            = require('../../models/User');
const UserSeasonStats = require('../../models/UserSeasonStats');

// ── Helpers ───────────────────────────────────────────────────────────────────

function getHandler(path, method = 'get') {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method],
  );
  if (!layer) throw new Error(`${method.toUpperCase()} ${path} not found`);
  return layer.route.stack[1].handle; // stack[0] = requireAuth, stack[1] = handler
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

// Build a chainable mock for routes that call .select().lean()
function selectLean(resolvedValue) {
  const obj = { lean: jest.fn().mockResolvedValue(resolvedValue) };
  obj.select = jest.fn().mockReturnValue(obj);
  return obj;
}

// Build a chainable mock for routes that call .select().limit().lean()
function selectLimitLean(resolvedValue) {
  const obj = { lean: jest.fn().mockResolvedValue(resolvedValue) };
  obj.limit  = jest.fn().mockReturnValue(obj);
  obj.select = jest.fn().mockReturnValue(obj);
  return obj;
}

const FRIEND = {
  _id:       { toString: () => 'friend-id' },
  firstName: 'Jane',
  lastName:  'Doe',
  email:     'jane@example.com',
  avatar:    null,
};

const REQUEST = { from: { toString: () => 'requester-id' } };

// ── GET / ─────────────────────────────────────────────────────────────────────

describe('GET /', () => {
  const handler = getHandler('/');

  beforeEach(() => jest.clearAllMocks());

  test('returns friends and friend requests for authenticated user', async () => {
    const userData = { friends: [FRIEND], friendRequests: [REQUEST] };
    const chain = { lean: jest.fn().mockResolvedValue(userData) };
    chain.populate = jest.fn().mockReturnValue(chain);
    User.findById.mockReturnValue(chain);

    const res = mockRes();
    await handler({ userId: 'user-me' }, res);

    expect(res.json).toHaveBeenCalledWith({
      friends:        [FRIEND],
      friendRequests: [REQUEST],
    });
  });

  test('returns 404 when user is not found', async () => {
    const chain = { lean: jest.fn().mockResolvedValue(null) };
    chain.populate = jest.fn().mockReturnValue(chain);
    User.findById.mockReturnValue(chain);

    const res = mockRes();
    await handler({ userId: 'user-me' }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 500 on DB error', async () => {
    const chain = { lean: jest.fn().mockRejectedValue(new Error('db error')) };
    chain.populate = jest.fn().mockReturnValue(chain);
    User.findById.mockReturnValue(chain);

    const res = mockRes();
    await handler({ userId: 'user-me' }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── GET /search ───────────────────────────────────────────────────────────────

describe('GET /search', () => {
  const handler = getHandler('/search');

  beforeEach(() => jest.clearAllMocks());

  test('returns empty array when query is less than 2 chars', async () => {
    const res = mockRes();
    await handler({ userId: 'user-me', query: { q: 'a' } }, res);

    expect(res.json).toHaveBeenCalledWith([]);
    expect(User.findById).not.toHaveBeenCalled();
  });

  test('returns annotated results with status for valid query', async () => {
    const me = { friends: [], friendRequests: [], blockedUsers: [] };
    User.findById.mockReturnValue(selectLean(me));

    const resultUser = { _id: { toString: () => 'user-z' }, firstName: 'Zoe', lastName: 'X', email: 'z@x.com' };
    // User.find: first call = blockedMeUsers (.select('_id').lean()), second = search results chain
    User.find
      .mockReturnValueOnce(selectLean([]))
      .mockReturnValueOnce(selectLimitLean([resultUser]));

    const res = mockRes();
    await handler({ userId: 'user-me', query: { q: 'zoe' } }, res);

    const result = res.json.mock.calls[0][0];
    expect(result[0]).toMatchObject({ firstName: 'Zoe', status: 'none' });
  });

  test('returns 500 on DB error', async () => {
    const errChain = { lean: jest.fn().mockRejectedValue(new Error('db error')) };
    errChain.select = jest.fn().mockReturnValue(errChain);
    User.findById.mockReturnValue(errChain);

    const res = mockRes();
    await handler({ userId: 'user-me', query: { q: 'test' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── GET /leaderboard ──────────────────────────────────────────────────────────

describe('GET /leaderboard', () => {
  const handler = getHandler('/leaderboard');

  beforeEach(() => jest.clearAllMocks());

  test('returns ranked leaderboard entries sorted by avgPoints by default', async () => {
    User.findById.mockReturnValue(selectLean({ friends: [] }));

    const statsDocs = [
      { userId: { toString: () => 'user-me' }, gamesPlayed: 5, avgPoints: 20, avgAssists: 4, avgRebounds: 6, avgFg3m: 1 },
    ];
    const users = [
      { _id: { toString: () => 'user-me' }, firstName: 'Me', lastName: 'User', avatar: null },
    ];

    UserSeasonStats.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(statsDocs) });
    User.find.mockReturnValue(selectLean(users));

    const res = mockRes();
    await handler({ userId: 'user-me', query: {} }, res);

    const ranked = res.json.mock.calls[0][0];
    expect(ranked[0]).toMatchObject({ rank: 1, firstName: 'Me' });
  });

  test('defaults sortBy to avgPoints when invalid value supplied', async () => {
    User.findById.mockReturnValue(selectLean({ friends: [] }));
    UserSeasonStats.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    User.find.mockReturnValue(selectLean([]));

    const res = mockRes();
    await handler({ userId: 'user-me', query: { sortBy: 'invalidStat' } }, res);

    expect(res.json).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 500 on DB error', async () => {
    const errChain = { lean: jest.fn().mockRejectedValue(new Error('db error')) };
    errChain.select = jest.fn().mockReturnValue(errChain);
    User.findById.mockReturnValue(errChain);

    const res = mockRes();
    await handler({ userId: 'user-me', query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── POST /request ─────────────────────────────────────────────────────────────

describe('POST /request', () => {
  const handler = getHandler('/request', 'post');

  beforeEach(() => jest.clearAllMocks());

  function meUser(overrides = {}) {
    return { friends: [], friendRequests: [], blockedUsers: [], ...overrides };
  }

  function targetUser(overrides = {}) {
    return { friends: [], friendRequests: [], blockedUsers: [], ...overrides };
  }

  test('sends friend request and returns 201', async () => {
    // Route uses Promise.all([findById(me).select().lean(), findById(target).select().lean()])
    User.findById
      .mockReturnValueOnce(selectLean(meUser()))
      .mockReturnValueOnce(selectLean(targetUser()));
    User.findByIdAndUpdate.mockResolvedValue({});

    const req = { userId: 'user-me', body: { targetUserId: 'user-b' } };
    const res = mockRes();
    await handler(req, res);

    expect(User.findByIdAndUpdate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'Friend request sent.' });
  });

  test('returns 400 when targetUserId is missing', async () => {
    const res = mockRes();
    await handler({ userId: 'user-me', body: {} }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'targetUserId is required.' });
  });

  test('returns 400 when sending request to self', async () => {
    const res = mockRes();
    await handler({ userId: 'user-me', body: { targetUserId: 'user-me' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Cannot friend yourself.' });
  });

  test('returns 404 when target user is not found', async () => {
    User.findById
      .mockReturnValueOnce(selectLean(meUser()))
      .mockReturnValueOnce(selectLean(null));

    const res = mockRes();
    await handler({ userId: 'user-me', body: { targetUserId: 'user-b' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found.' });
  });

  test('returns 403 when target has blocked the requester', async () => {
    User.findById
      .mockReturnValueOnce(selectLean(meUser()))
      .mockReturnValueOnce(selectLean(targetUser({ blockedUsers: [{ toString: () => 'user-me' }] })));

    const res = mockRes();
    await handler({ userId: 'user-me', body: { targetUserId: 'user-b' } }, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Cannot send request.' });
  });

  test('returns 409 when already friends', async () => {
    User.findById
      .mockReturnValueOnce(selectLean(meUser({ friends: [{ toString: () => 'user-b' }] })))
      .mockReturnValueOnce(selectLean(targetUser()));

    const res = mockRes();
    await handler({ userId: 'user-me', body: { targetUserId: 'user-b' } }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Already friends.' });
  });

  test('auto-accepts when target already sent a request', async () => {
    User.findById
      .mockReturnValueOnce(selectLean(meUser({ friendRequests: [{ from: { toString: () => 'user-b' } }] })))
      .mockReturnValueOnce(selectLean(targetUser()));
    User.findByIdAndUpdate.mockResolvedValue({});

    const req = { userId: 'user-me', body: { targetUserId: 'user-b' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Friend request accepted (mutual).' });
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ── POST /accept ──────────────────────────────────────────────────────────────

describe('POST /accept', () => {
  const handler = getHandler('/accept', 'post');

  beforeEach(() => jest.clearAllMocks());

  test('accepts friend request and updates both users', async () => {
    const me = { friendRequests: [{ from: { toString: () => 'user-b' } }] };
    User.findById.mockReturnValue(selectLean(me));
    User.findByIdAndUpdate.mockResolvedValue({});

    const res = mockRes();
    await handler({ userId: 'user-me', body: { fromUserId: 'user-b' } }, res);

    expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({ message: 'Friend request accepted.' });
  });

  test('returns 400 when fromUserId is missing', async () => {
    const res = mockRes();
    await handler({ userId: 'user-me', body: {} }, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when request not found', async () => {
    User.findById.mockReturnValue(selectLean({ friendRequests: [] }));

    const res = mockRes();
    await handler({ userId: 'user-me', body: { fromUserId: 'user-b' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ── POST /decline ─────────────────────────────────────────────────────────────

describe('POST /decline', () => {
  const handler = getHandler('/decline', 'post');

  beforeEach(() => jest.clearAllMocks());

  test('declines friend request and returns success', async () => {
    User.findByIdAndUpdate.mockResolvedValue({});

    const res = mockRes();
    await handler({ userId: 'user-me', body: { fromUserId: 'user-b' } }, res);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'user-me',
      { $pull: { friendRequests: { from: 'user-b' } } },
    );
    expect(res.json).toHaveBeenCalledWith({ message: 'Friend request declined.' });
  });

  test('returns 400 when fromUserId is missing', async () => {
    const res = mockRes();
    await handler({ userId: 'user-me', body: {} }, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ── POST /block ───────────────────────────────────────────────────────────────

describe('POST /block', () => {
  const handler = getHandler('/block', 'post');

  beforeEach(() => jest.clearAllMocks());

  test('blocks user and returns success message', async () => {
    User.findByIdAndUpdate.mockResolvedValue({});

    const res = mockRes();
    await handler({ userId: 'user-me', body: { targetUserId: 'user-b' } }, res);

    expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({ message: 'User blocked.' });
  });

  test('returns 400 when targetUserId is missing', async () => {
    const res = mockRes();
    await handler({ userId: 'user-me', body: {} }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'targetUserId is required.' });
  });

  test('returns 500 on DB error', async () => {
    User.findByIdAndUpdate.mockRejectedValue(new Error('db error'));

    const res = mockRes();
    await handler({ userId: 'user-me', body: { targetUserId: 'user-b' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── DELETE /block/:targetUserId ───────────────────────────────────────────────

describe('DELETE /block/:targetUserId', () => {
  const handler = getHandler('/block/:targetUserId', 'delete');

  beforeEach(() => jest.clearAllMocks());

  test('unblocks user and returns success', async () => {
    User.findByIdAndUpdate.mockResolvedValue({});

    const res = mockRes();
    await handler({ userId: 'user-me', params: { targetUserId: 'user-b' } }, res);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'user-me',
      { $pull: { blockedUsers: 'user-b' } },
    );
    expect(res.json).toHaveBeenCalledWith({ message: 'User unblocked.' });
  });

  test('returns 500 on DB error', async () => {
    User.findByIdAndUpdate.mockRejectedValue(new Error('db error'));

    const res = mockRes();
    await handler({ userId: 'user-me', params: { targetUserId: 'user-b' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── DELETE /:friendId ─────────────────────────────────────────────────────────

describe('DELETE /:friendId', () => {
  const handler = getHandler('/:friendId', 'delete');

  beforeEach(() => jest.clearAllMocks());

  test('removes friend from both users and returns success', async () => {
    User.findByIdAndUpdate.mockResolvedValue({});

    const res = mockRes();
    await handler({ userId: 'user-me', params: { friendId: 'friend-id' } }, res);

    expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({ message: 'Friend removed.' });
  });

  test('returns 500 on DB error', async () => {
    User.findByIdAndUpdate.mockRejectedValue(new Error('db error'));

    const res = mockRes();
    await handler({ userId: 'user-me', params: { friendId: 'friend-id' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

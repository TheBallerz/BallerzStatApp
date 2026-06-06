'use strict';

jest.mock('../../models/User', () => ({
  find:              jest.fn(),
  findByIdAndDelete: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

// requireAdmin uses User.findById — mock the whole auth middleware module so we
// can call route handlers directly without needing a real JWT.
jest.mock('../../middleware/auth', () => ({
  requireAuth:  (req, _res, next) => { req.userId = req._testUserId || 'admin-id'; next(); },
  requireAdmin: (_req, _res, next) => next(),
}));

const router = require('../../routes/admin');
const User   = require('../../models/User');

// ── Helpers ───────────────────────────────────────────────────────────────────

function getHandler(path, method = 'get') {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method],
  );
  if (!layer) throw new Error(`${method.toUpperCase()} ${path} not found in router`);
  // stack[0] = requireAuth, stack[1] = requireAdmin, stack[2] = handler
  return layer.route.stack[2].handle;
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

const USER_DOC = {
  _id:       'user-abc',
  firstName: 'Alice',
  lastName:  'Smith',
  email:     'alice@example.com',
  isAdmin:   false,
  createdAt: new Date('2024-01-01'),
};

// ── GET /users ─────────────────────────────────────────────────────────────────

describe('GET /users', () => {
  const handler = getHandler('/users');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('returns all users from DB', async () => {
    const mockLean = jest.fn().mockResolvedValue([USER_DOC]);
    const mockSort = jest.fn().mockReturnValue({ lean: mockLean });
    const mockSelect = jest.fn().mockReturnValue({ sort: mockSort });
    User.find.mockReturnValue({ select: mockSelect });

    const res = mockRes();
    await handler({ userId: 'admin-id' }, res);

    expect(User.find).toHaveBeenCalledWith({});
    expect(res.json).toHaveBeenCalledWith([USER_DOC]);
  });

  test('returns empty array when no users in DB', async () => {
    const mockLean = jest.fn().mockResolvedValue([]);
    const mockSort = jest.fn().mockReturnValue({ lean: mockLean });
    const mockSelect = jest.fn().mockReturnValue({ sort: mockSort });
    User.find.mockReturnValue({ select: mockSelect });

    const res = mockRes();
    await handler({ userId: 'admin-id' }, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('returns 500 on DB error', async () => {
    const mockSort = jest.fn().mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('db error')),
    });
    User.find.mockReturnValue({ select: jest.fn().mockReturnValue({ sort: mockSort }) });

    const res = mockRes();
    await handler({ userId: 'admin-id' }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Failed to fetch users.' });
  });
});

// ── DELETE /users/:id ─────────────────────────────────────────────────────────

describe('DELETE /users/:id', () => {
  const handler = getHandler('/users/:id', 'delete');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('deletes user and returns success message', async () => {
    User.findByIdAndDelete.mockResolvedValue(USER_DOC);

    const req = { userId: 'admin-id', params: { id: 'user-abc' } };
    const res = mockRes();
    await handler(req, res);

    expect(User.findByIdAndDelete).toHaveBeenCalledWith('user-abc');
    expect(res.json).toHaveBeenCalledWith({ message: 'User deleted.' });
  });

  test('returns 400 when admin tries to delete their own account', async () => {
    const req = { userId: 'admin-id', params: { id: 'admin-id' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'You cannot delete your own account.' });
    expect(User.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test('returns 404 when user is not found', async () => {
    User.findByIdAndDelete.mockResolvedValue(null);

    const req = { userId: 'admin-id', params: { id: 'nonexistent' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found.' });
  });

  test('returns 500 on DB error', async () => {
    User.findByIdAndDelete.mockRejectedValue(new Error('db boom'));

    const req = { userId: 'admin-id', params: { id: 'user-abc' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Failed to delete user.' });
  });
});

// ── PATCH /users/:id/role ─────────────────────────────────────────────────────

describe('PATCH /users/:id/role', () => {
  const handler = getHandler('/users/:id/role', 'patch');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('updates isAdmin flag and returns updated user', async () => {
    const updatedUser = { ...USER_DOC, isAdmin: true };
    User.findByIdAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue(updatedUser) });

    const req = { userId: 'admin-id', params: { id: 'user-abc' }, body: { isAdmin: true } };
    const res = mockRes();
    await handler(req, res);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'user-abc',
      { $set: { isAdmin: true } },
      expect.objectContaining({ new: true }),
    );
    expect(res.json).toHaveBeenCalledWith(updatedUser);
  });

  test('returns 400 when isAdmin is not a boolean', async () => {
    const req = { userId: 'admin-id', params: { id: 'user-abc' }, body: { isAdmin: 'yes' } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'isAdmin must be a boolean.' });
  });

  test('returns 400 when admin tries to remove their own admin status', async () => {
    const req = { userId: 'admin-id', params: { id: 'admin-id' }, body: { isAdmin: false } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'You cannot remove your own admin status.' });
  });

  test('returns 404 when user to update is not found', async () => {
    User.findByIdAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const req = { userId: 'admin-id', params: { id: 'nonexistent' }, body: { isAdmin: true } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found.' });
  });

  test('returns 500 on DB error', async () => {
    User.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('update failed')),
    });

    const req = { userId: 'admin-id', params: { id: 'user-abc' }, body: { isAdmin: true } };
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Failed to update user role.' });
  });
});

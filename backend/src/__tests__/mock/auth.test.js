jest.mock('bcryptjs', () => ({
    hash: jest.fn(),
    compare: jest.fn(),
  }));
  
  jest.mock('jsonwebtoken', () => ({
    sign: jest.fn(),
  }));
  
  jest.mock('../../models/User', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findById: jest.fn(),
  }));

  // Mock Player and Team for the GET /me route which resolves nbaId arrays
  jest.mock('../../models/Player', () => ({ find: jest.fn() }));
  jest.mock('../../models/Team',   () => ({ find: jest.fn() }));

  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  const User = require('../../models/User');
  const Player = require('../../models/Player');
  const Team = require('../../models/Team');
  const router = require('../../routes/auth');

  // stackIndex=0 for public routes, stackIndex=1 for routes with requireAuth middleware
  function getMethodHandler(path, method, stackIndex = 0) {
    const layer = router.stack.find(
      (l) => l.route && l.route.path === path && l.route.methods[method]
    );

    if (!layer) {
      throw new Error(`${method.toUpperCase()} ${path} route not found`);
    }

    return layer.route.stack[stackIndex].handle;
  }
  
  function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }
  
  describe('auth routes', () => {
    const registerHandler = getMethodHandler('/register', 'post');
    const loginHandler = getMethodHandler('/login', 'post');
  
    const OLD_ENV = process.env;
  
    beforeEach(() => {
      jest.clearAllMocks();
      process.env = {
        ...OLD_ENV,
        JWT_SECRET: 'test-secret',
        JWT_EXPIRES_IN: '7d',
      };
    });
  
    afterAll(() => {
      process.env = OLD_ENV;
    });
  
    describe('POST /register', () => {
      test('returns 400 when fields are missing', async () => {
        const req = {
          body: {
            firstName: 'Ken',
          },
        };
        const res = mockRes();
  
        await registerHandler(req, res);
  
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          message: 'All fields are required.',
        });
      });
  
      test('returns 409 when email already exists', async () => {
        User.findOne.mockResolvedValue({ _id: 'existing-user' });
  
        const req = {
          body: {
            firstName: 'Ken',
            lastName: 'Suon',
            email: 'KEN@example.com',
            password: 'secret123',
          },
        };
        const res = mockRes();
  
        await registerHandler(req, res);
  
        expect(User.findOne).toHaveBeenCalledWith({
          email: 'ken@example.com',
        });
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
          message: 'An account with this email already exists.',
        });
      });
  
      test('creates user and returns token on success', async () => {
        User.findOne.mockResolvedValue(null);
        bcrypt.hash.mockResolvedValue('hashed-password');
        User.create.mockResolvedValue({
          _id: 'u1',
          firstName: 'Ken',
          lastName: 'Suon',
          email: 'KEN@example.com',
        });
        jwt.sign.mockReturnValue('signed-token');
  
        const req = {
          body: {
            firstName: 'Ken',
            lastName: 'Suon',
            email: 'KEN@example.com',
            password: 'secret123',
          },
        };
        const res = mockRes();
  
        await registerHandler(req, res);
  
        expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 10);
        expect(User.create).toHaveBeenCalledWith({
          firstName: 'Ken',
          lastName: 'Suon',
          email: 'KEN@example.com',
          passwordHash: 'hashed-password',
        });
        expect(jwt.sign).toHaveBeenCalledWith(
          { userId: 'u1' },
          'test-secret',
          { expiresIn: '7d' }
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          token: 'signed-token',
          user: {
            id: 'u1',
            firstName: 'Ken',
            lastName: 'Suon',
            email: 'KEN@example.com',
          },
        });
      });
  
      test('uses default token expiry when JWT_EXPIRES_IN is not set', async () => {
        delete process.env.JWT_EXPIRES_IN;
  
        User.findOne.mockResolvedValue(null);
        bcrypt.hash.mockResolvedValue('hashed-password');
        User.create.mockResolvedValue({
          _id: 'u2',
          firstName: 'Ken',
          lastName: 'Suon',
          email: 'ken@example.com',
        });
        jwt.sign.mockReturnValue('default-exp-token');
  
        const req = {
          body: {
            firstName: 'Ken',
            lastName: 'Suon',
            email: 'ken@example.com',
            password: 'secret123',
          },
        };
        const res = mockRes();
  
        await registerHandler(req, res);
  
        expect(jwt.sign).toHaveBeenCalledWith(
          { userId: 'u2' },
          'test-secret',
          { expiresIn: '7d' }
        );
        expect(res.status).toHaveBeenCalledWith(201);
      });
    });
  
    describe('POST /login', () => {
      test('returns 400 when email or password missing', async () => {
        const req = {
          body: {
            email: 'ken@example.com',
          },
        };
        const res = mockRes();
  
        await loginHandler(req, res);
  
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Email and password are required.',
        });
      });
  
      test('returns 401 when user is not found', async () => {
        User.findOne.mockResolvedValue(null);
  
        const req = {
          body: {
            email: 'ken@example.com',
            password: 'secret123',
          },
        };
        const res = mockRes();
  
        await loginHandler(req, res);
  
        expect(User.findOne).toHaveBeenCalledWith({
          email: 'ken@example.com',
        });
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Invalid email or password.',
        });
      });
  
      test('returns 401 when password is invalid', async () => {
        User.findOne.mockResolvedValue({
          _id: 'u1',
          email: 'ken@example.com',
          passwordHash: 'stored-hash',
        });
        bcrypt.compare.mockResolvedValue(false);
  
        const req = {
          body: {
            email: 'ken@example.com',
            password: 'wrong-password',
          },
        };
        const res = mockRes();
  
        await loginHandler(req, res);
  
        expect(bcrypt.compare).toHaveBeenCalledWith(
          'wrong-password',
          'stored-hash'
        );
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Invalid email or password.',
        });
      });
  
      test('returns token and sanitized user on success', async () => {
        User.findOne.mockResolvedValue({
          _id: 'u1',
          firstName: 'Ken',
          lastName: 'Suon',
          email: 'ken@example.com',
          passwordHash: 'stored-hash',
        });
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue('login-token');
  
        const req = {
          body: {
            email: 'KEN@example.com',
            password: 'secret123',
          },
        };
        const res = mockRes();
  
        await loginHandler(req, res);
  
        expect(User.findOne).toHaveBeenCalledWith({
          email: 'ken@example.com',
        });
        expect(jwt.sign).toHaveBeenCalledWith(
          { userId: 'u1' },
          'test-secret',
          { expiresIn: '7d' }
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          token: 'login-token',
          user: {
            id: 'u1',
            firstName: 'Ken',
            lastName: 'Suon',
            email: 'ken@example.com',
          },
        });
      });
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /favorites — protected route (requireAuth is stack[0], handler is stack[1])
  // req.userId is set directly as a Dummy bypass of the requireAuth middleware
  // ---------------------------------------------------------------------------
  describe('PATCH /favorites', () => {
    const favoritesHandler = getMethodHandler('/favorites', 'patch', 1);

    function mockRes() {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      return res;
    }

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('returns 400 when the request body contains no favorites', async () => {
      // Dummy req: userId present (bypassing auth), but body has no recognized fields
      const req = { userId: 'u1', body: {} };
      const res = mockRes();

      await favoritesHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'No favorites provided.' });
      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    test('updates favoritePlayers and returns the updated user', async () => {
      const updatedUser = {
        _id: 'u1',
        firstName: 'Ken',
        lastName: 'Suon',
        email: 'ken@example.com',
        favoritePlayers: [5, 10],
        favoriteTeams: [],
      };

      // Stub: findByIdAndUpdate returns the updated document
      User.findByIdAndUpdate.mockResolvedValue(updatedUser);

      const req = { userId: 'u1', body: { favoritePlayers: [5, 10] } };
      const res = mockRes();

      await favoritesHandler(req, res);

      // Mock verification: confirm the correct $set payload and options were used
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'u1',
        { $set: { favoritePlayers: [5, 10] } },
        { new: true, select: '-passwordHash' }
      );
      expect(res.json).toHaveBeenCalledWith({
        user: {
          id:              'u1',
          firstName:       'Ken',
          lastName:        'Suon',
          email:           'ken@example.com',
          favoritePlayers: [5, 10],
          favoriteTeams:   [],
        },
      });
    });

    test('coerces string IDs to numbers before saving', async () => {
      const updatedUser = {
        _id: 'u1',
        firstName: 'Ken',
        lastName: 'Suon',
        email: 'ken@example.com',
        favoritePlayers: [23],
        favoriteTeams: [1],
      };
      User.findByIdAndUpdate.mockResolvedValue(updatedUser);

      // Stub: IDs arrive as strings (as sent from the frontend)
      const req = { userId: 'u1', body: { favoritePlayers: ['23'], favoriteTeams: ['1'] } };
      const res = mockRes();

      await favoritesHandler(req, res);

      // Mock verification: strings must be coerced to numbers in the $set
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'u1',
        { $set: { favoritePlayers: [23], favoriteTeams: [1] } },
        expect.any(Object)
      );
    });

    test('returns 404 when the user does not exist', async () => {
      // Stub: findByIdAndUpdate returns null (user not found)
      User.findByIdAndUpdate.mockResolvedValue(null);

      const req = { userId: 'missing-id', body: { favoriteTeams: [1] } };
      const res = mockRes();

      await favoritesHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'User not found.' });
    });
  });

  // ---------------------------------------------------------------------------
  // GET /me — protected route (requireAuth is stack[0], handler is stack[1])
  // req.userId injected directly as a Dummy bypass of the requireAuth middleware
  // ---------------------------------------------------------------------------
  describe('GET /me', () => {
    const meHandler = getMethodHandler('/me', 'get', 1);

    function mockRes() {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      return res;
    }

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('returns the user with expanded favoritePlayers and favoriteTeams', async () => {
      const userDoc = {
        _id: 'u1',
        firstName: 'Ken',
        lastName: 'Suon',
        email: 'ken@example.com',
        favoritePlayers: [23],
        favoriteTeams:   [1],
      };

      // Stub: User.findById chain → select → lean → userDoc
      const mockUserLean = jest.fn().mockResolvedValue(userDoc);
      const mockUserSelect = jest.fn().mockReturnValue({ lean: mockUserLean });
      User.findById.mockReturnValue({ select: mockUserSelect });

      const playerDocs = [{ _id: 'p1', firstName: 'LeBron', lastName: 'James', nbaId: 23 }];
      const teamDocs   = [{ _id: 't1', name: 'Lakers', abbreviation: 'LAL', nbaId: 1 }];

      // Stub: Player.find chain → select → populate → lean
      const mockPlayerLean     = jest.fn().mockResolvedValue(playerDocs);
      const mockPlayerPopulate = jest.fn().mockReturnValue({ lean: mockPlayerLean });
      const mockPlayerSelect   = jest.fn().mockReturnValue({ populate: mockPlayerPopulate });
      Player.find.mockReturnValue({ select: mockPlayerSelect });

      // Stub: Team.find chain → select → lean
      const mockTeamLean   = jest.fn().mockResolvedValue(teamDocs);
      const mockTeamSelect = jest.fn().mockReturnValue({ lean: mockTeamLean });
      Team.find.mockReturnValue({ select: mockTeamSelect });

      // Dummy req: userId injected to bypass requireAuth
      const req = { userId: 'u1' };
      const res = mockRes();

      await meHandler(req, res);

      // Mock verification: nbaId arrays are passed to Player.find and Team.find
      expect(User.findById).toHaveBeenCalledWith('u1');
      expect(Player.find).toHaveBeenCalledWith({ nbaId: { $in: [23] } });
      expect(Team.find).toHaveBeenCalledWith({ nbaId: { $in: [1] } });

      expect(res.json).toHaveBeenCalledWith({
        user: {
          ...userDoc,
          favoritePlayers: playerDocs,
          favoriteTeams:   teamDocs,
        },
      });
    });

    test('returns 404 when the authenticated user no longer exists', async () => {
      // Stub: findById chain returns null (user deleted)
      const mockUserLean   = jest.fn().mockResolvedValue(null);
      const mockUserSelect = jest.fn().mockReturnValue({ lean: mockUserLean });
      User.findById.mockReturnValue({ select: mockUserSelect });

      const req = { userId: 'deleted-id' };
      const res = mockRes();

      await meHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'User not found.' });
      // Player and Team should never be queried if the user wasn't found
      expect(Player.find).not.toHaveBeenCalled();
      expect(Team.find).not.toHaveBeenCalled();
    });
  });
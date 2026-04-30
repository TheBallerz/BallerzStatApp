jest.mock('bcryptjs', () => ({
    hash: jest.fn(),
    compare: jest.fn(),
  }));
  
  jest.mock('jsonwebtoken', () => ({
    sign: jest.fn(),
  }));
  
  jest.mock('../models/User', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
  }));
  
  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  const User = require('../models/User');
  const router = require('../routes/auth');
  
  function getMethodHandler(path, method) {
    const layer = router.stack.find(
      (l) => l.route && l.route.path === path && l.route.methods[method]
    );
  
    if (!layer) {
      throw new Error(`${method.toUpperCase()} ${path} route not found`);
    }
  
    return layer.route.stack[0].handle;
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
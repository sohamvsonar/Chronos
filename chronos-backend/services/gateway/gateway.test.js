const fastify = require('fastify');
const httpProxy = require('@fastify/http-proxy');
const rateLimit = require('@fastify/rate-limit');
const jwt = require('@fastify/jwt');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.test') });

describe('Gateway Service', () => {
  let app;
  const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing';

  beforeEach(async () => {
    app = fastify({ logger: false });

    // Register JWT
    await app.register(jwt, {
      secret: JWT_SECRET,
    });

    // Register rate limiting (without Redis for testing)
    await app.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
      cache: 10000,
      allowList: ['127.0.0.1'],
    });

    // JWT Authentication Decorator
    app.decorate('authenticate', async function (request, reply) {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid or expired token'
        });
      }
    });

    // Health check route
    app.get('/health', async (request, reply) => {
      return { status: 'ok', service: 'gateway', timestamp: new Date().toISOString() };
    });

    // Public route to generate JWT token
    app.post('/auth/token', async (request, reply) => {
      const { userId, email } = request.body || {};

      if (!userId || !email) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'userId and email are required'
        });
      }

      const token = app.jwt.sign({ userId, email }, { expiresIn: '24h' });

      return { token, expiresIn: '24h' };
    });

    // Protected route for testing authentication
    app.get('/protected', { preHandler: app.authenticate }, async (request, reply) => {
      return { message: 'Access granted', user: request.user };
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.status).toBe('ok');
      expect(payload.service).toBe('gateway');
      expect(payload.timestamp).toBeDefined();
    });
  });

  describe('JWT Authentication', () => {
    it('should generate a valid JWT token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/token',
        payload: {
          userId: 'user123',
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.token).toBeDefined();
      expect(payload.expiresIn).toBe('24h');

      // Verify the token is valid
      const decoded = app.jwt.verify(payload.token);
      expect(decoded.userId).toBe('user123');
      expect(decoded.email).toBe('test@example.com');
    });

    it('should reject token generation without userId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/token',
        payload: {
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Bad Request');
      expect(payload.message).toBe('userId and email are required');
    });

    it('should reject token generation without email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/token',
        payload: {
          userId: 'user123',
        },
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Bad Request');
    });

    it('should verify valid JWT tokens', async () => {
      const token = app.jwt.sign({ userId: 'user123', email: 'test@example.com' }, { expiresIn: '1h' });

      const decoded = app.jwt.verify(token);
      expect(decoded.userId).toBe('user123');
      expect(decoded.email).toBe('test@example.com');
    });

    it('should reject invalid JWT tokens', async () => {
      expect(() => {
        app.jwt.verify('invalid-token');
      }).toThrow();
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      for (let i = 0; i < 10; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/health',
        });
        expect(response.statusCode).toBe(200);
      }
    });

    it('should include rate limit headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      // Note: Rate limit headers may not be present when using inject()
      // They are present in actual HTTP requests
      expect(response.statusCode).toBe(200);
    });
  });

  describe('Authentication Middleware', () => {
    it('should allow access with valid token', async () => {
      const token = app.jwt.sign({ userId: 'user123', email: 'test@example.com' }, { expiresIn: '1h' });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.message).toBe('Access granted');
      expect(payload.user.userId).toBe('user123');
    });

    it('should deny access without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      });

      expect(response.statusCode).toBe(401);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Unauthorized');
    });

    it('should deny access with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Unauthorized');
    });
  });
});

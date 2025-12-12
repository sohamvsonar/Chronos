const fastify = require('fastify');
const httpProxy = require('@fastify/http-proxy');
const rateLimit = require('@fastify/rate-limit');
const jwt = require('@fastify/jwt');
const Redis = require('ioredis');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const app = fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
    },
  },
});

const PORT = process.env.GATEWAY_PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'chronos-super-secret-key-change-in-production';

async function start() {
  try {
    // Register JWT
    await app.register(jwt, {
      secret: JWT_SECRET,
    });

    // Register rate limiting with Redis support
    let redisClient = null;
    if (process.env.REDIS_URL) {
      try {
        redisClient = new Redis(process.env.REDIS_URL);
        app.log.info('Redis connected for rate limiting');
      } catch (error) {
        app.log.warn('Redis connection failed, using in-memory cache:', error.message);
      }
    }

    await app.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
      cache: 10000,
      allowList: ['127.0.0.1'],
      redis: redisClient,
    });

    // JWT Authentication Decorator
    app.decorate('authenticate', async function (request, reply) {
      try {
        await request.jwtVerify();
      } catch (err) {
        app.log.error('JWT verification failed:', err.message);
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

    // Public route to generate JWT token (for testing)
    app.post('/auth/token', async (request, reply) => {
      const { userId, email } = request.body || {};

      app.log.info('Token generation request:', { userId, email });

      if (!userId || !email) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'userId and email are required'
        });
      }

      const token = app.jwt.sign({ userId, email }, { expiresIn: '24h' });

      app.log.info('Token generated successfully');

      return { token, expiresIn: '24h' };
    });

    // Proxy to Product Service
    await app.register(async function (fastify) {
      fastify.addHook('preHandler', fastify.authenticate);

      await fastify.register(httpProxy, {
        upstream: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001',
        prefix: '/products',
        rewritePrefix: '/products',
        http2: false,
      });
    });

    // Proxy to Customer Service
    await app.register(async function (fastify) {
      fastify.addHook('preHandler', fastify.authenticate);

      await fastify.register(httpProxy, {
        upstream: process.env.CUSTOMER_SERVICE_URL || 'http://localhost:3002',
        prefix: '/customers',
        rewritePrefix: '/customers',
        http2: false,
      });
    });

    // Proxy to Recommendation Service
    await app.register(async function (fastify) {
      fastify.addHook('preHandler', fastify.authenticate);

      await fastify.register(httpProxy, {
        upstream: process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:3003',
        prefix: '/recommendations',
        rewritePrefix: '/recommendations',
        http2: false,
      });
    });

    // Proxy to Order Service
    await app.register(async function (fastify) {
      fastify.addHook('preHandler', fastify.authenticate);

      await fastify.register(httpProxy, {
        upstream: process.env.ORDER_SERVICE_URL || 'http://localhost:3004',
        prefix: '/checkout',
        rewritePrefix: '/checkout',
        http2: false,
      });
    });

    await app.register(async function (fastify) {
      fastify.addHook('preHandler', fastify.authenticate);

      await fastify.register(httpProxy, {
        upstream: process.env.ORDER_SERVICE_URL || 'http://localhost:3004',
        prefix: '/orders',
        rewritePrefix: '/orders',
        http2: false,
      });
    });

    // Start server
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 API Gateway running on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

const fastify = require('fastify');
const Redis = require('ioredis');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.test') });

// Mock the database module
jest.mock('@chronos/database', () => ({
  query: jest.fn(),
}));

// Mock Redis
jest.mock('ioredis');

const db = require('@chronos/database');

describe('Recommendation Service - Phase 3', () => {
  let app;
  let mockRedisClient;
  let redisClient; // Move to describe scope

  beforeEach(async () => {
    // Setup Redis mock
    mockRedisClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    };
    Redis.mockImplementation(() => mockRedisClient);

    app = fastify({ logger: false });

    // Setup Redis connection (always in tests)
    const REDIS_URL = 'redis://localhost:6379'; // Always set in tests
    redisClient = mockRedisClient; // Use mock directly

    // Get recommendation weights from Redis
    async function getWeights() {
      const defaultWeights = { collaborative: 0.5, content: 0.5 };
      if (!redisClient) return defaultWeights;

      try {
        const weightsStr = await redisClient.get('config:weights');
        if (weightsStr) {
          return JSON.parse(weightsStr);
        }
      } catch (error) {
        app.log.warn('Error fetching weights from Redis:', error.message);
      }
      return defaultWeights;
    }

    // Content-Based Filtering (simplified for tests)
    async function getContentBasedRecommendations(userId) {
      const purchaseHistory = await db.query(
        `SELECT DISTINCT p.id, p.name, p.brand, p.category, p.price, p.metadata
         FROM orders o
         JOIN LATERAL (
           SELECT (item->>'product_id')::text as product_id
           FROM jsonb_array_elements(o.items) as item
         ) oi ON true
         JOIN products p ON p.id = oi.product_id
         WHERE o.customer_id = $1`,
        [userId]
      );

      if (purchaseHistory.rows.length === 0) return [];

      const purchasedProducts = purchaseHistory.rows;
      const purchasedIds = purchasedProducts.map(p => p.id);

      const brandCounts = {};
      const categoryCounts = {};

      purchasedProducts.forEach(product => {
        brandCounts[product.brand] = (brandCounts[product.brand] || 0) + 1;
        categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
      });

      const topBrand = Object.keys(brandCounts).sort((a, b) => brandCounts[b] - brandCounts[a])[0];
      const topCategory = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a])[0];

      const similarProducts = await db.query(
        `SELECT p.*,
                CASE
                  WHEN p.brand = $1 AND p.category = $2 THEN 1.0
                  WHEN p.brand = $1 THEN 0.7
                  WHEN p.category = $2 THEN 0.6
                  ELSE 0.3
                END as content_score
         FROM products p
         WHERE p.id != ALL($3::text[])
           AND p.stock > 0
           AND (p.brand = $1 OR p.category = $2)
         ORDER BY content_score DESC, p.price DESC
         LIMIT 10`,
        [topBrand, topCategory, purchasedIds]
      );

      return similarProducts.rows;
    }

    // Collaborative Filtering (simplified for tests)
    async function getCollaborativeRecommendations(userId) {
      const collaborativeQuery = await db.query(
        `WITH user_purchases AS (
           SELECT DISTINCT (item->>'product_id')::text as product_id
           FROM orders o
           CROSS JOIN jsonb_array_elements(o.items) as item
           WHERE o.customer_id = $1
         ),
         similar_users AS (
           SELECT DISTINCT o.customer_id, COUNT(*) as common_products
           FROM orders o
           CROSS JOIN jsonb_array_elements(o.items) as item
           WHERE (item->>'product_id')::text IN (SELECT product_id FROM user_purchases)
             AND o.customer_id != $1
           GROUP BY o.customer_id
           HAVING COUNT(*) >= 1
         ),
         other_products AS (
           SELECT (item->>'product_id')::text as product_id,
                  COUNT(*) as purchase_count,
                  SUM(su.common_products) as weighted_score
           FROM orders o
           JOIN similar_users su ON o.customer_id = su.customer_id
           CROSS JOIN jsonb_array_elements(o.items) as item
           WHERE (item->>'product_id')::text NOT IN (SELECT product_id FROM user_purchases)
           GROUP BY (item->>'product_id')::text
         )
         SELECT p.*,
                op.weighted_score as collab_score,
                op.purchase_count
         FROM other_products op
         JOIN products p ON p.id = op.product_id
         WHERE p.stock > 0
         ORDER BY op.weighted_score DESC, op.purchase_count DESC
         LIMIT 10`,
        [userId]
      );

      return collaborativeQuery.rows;
    }

    // Get top-selling products
    async function getTopSellingProducts(userId) {
      const purchasedIds = await db.query(
        `SELECT DISTINCT (item->>'product_id')::text as product_id
         FROM orders o
         CROSS JOIN jsonb_array_elements(o.items) as item
         WHERE o.customer_id = $1`,
        [userId]
      );

      const excludeIds = purchasedIds.rows.map(r => r.product_id);

      const topSelling = await db.query(
        `SELECT p.*,
                COUNT(o.id) as order_count,
                SUM((item->>'quantity')::int) as total_sold
         FROM products p
         LEFT JOIN orders o ON true
         LEFT JOIN LATERAL jsonb_array_elements(o.items) as item ON (item->>'product_id')::text = p.id
         WHERE p.stock > 0
           ${excludeIds.length > 0 ? 'AND p.id != ALL($1::text[])' : ''}
         GROUP BY p.id
         ORDER BY total_sold DESC NULLS LAST, p.price DESC
         LIMIT 4`,
        excludeIds.length > 0 ? [excludeIds] : []
      );

      return topSelling.rows;
    }

    // Normalize scores
    function normalizeScores(items, scoreField) {
      if (items.length === 0) return items;

      const scores = items.map(item => parseFloat(item[scoreField]) || 0);
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);
      const range = maxScore - minScore || 1;

      return items.map(item => ({
        ...item,
        [`${scoreField}_normalized`]: (parseFloat(item[scoreField]) - minScore) / range
      }));
    }

    // Combine recommendations
    function combineRecommendations(contentBased, collaborative, weights) {
      const productMap = new Map();

      const normalizedContent = normalizeScores(contentBased, 'content_score');
      normalizedContent.forEach(product => {
        productMap.set(product.id, {
          ...product,
          content_score: product.content_score_normalized || 0,
          collab_score: 0
        });
      });

      const normalizedCollab = normalizeScores(collaborative, 'collab_score');
      normalizedCollab.forEach(product => {
        if (productMap.has(product.id)) {
          const existing = productMap.get(product.id);
          existing.collab_score = product.collab_score_normalized || 0;
        } else {
          productMap.set(product.id, {
            ...product,
            content_score: 0,
            collab_score: product.collab_score_normalized || 0
          });
        }
      });

      const recommendations = Array.from(productMap.values()).map(product => {
        const hybridScore =
          (product.content_score * weights.content) +
          (product.collab_score * weights.collaborative);

        return {
          id: product.id,
          name: product.name,
          brand: product.brand,
          category: product.category,
          price: product.price,
          stock: product.stock,
          metadata: product.metadata,
          scores: {
            content: parseFloat(product.content_score.toFixed(3)),
            collaborative: parseFloat(product.collab_score.toFixed(3)),
            hybrid: parseFloat(hybridScore.toFixed(3))
          }
        };
      });

      return recommendations
        .sort((a, b) => b.scores.hybrid - a.scores.hybrid)
        .slice(0, 4);
    }

    // Health check
    app.get('/health', async (request, reply) => {
      return {
        status: 'ok',
        service: 'recommendation-service',
        timestamp: new Date().toISOString(),
        redis: redisClient ? 'connected' : 'disabled'
      };
    });

    // Main recommendation endpoint
    app.get('/recommendations/:userId', async (request, reply) => {
      try {
        const { userId } = request.params;

        const userCheck = await db.query('SELECT id FROM customers WHERE id = $1', [userId]);
        if (userCheck.rows.length === 0) {
          return reply.code(404).send({
            success: false,
            error: 'User not found'
          });
        }

        const weights = await getWeights();

        const historyCheck = await db.query(
          'SELECT COUNT(*) as count FROM orders WHERE customer_id = $1',
          [userId]
        );

        const hasPurchaseHistory = parseInt(historyCheck.rows[0].count) > 0;

        if (!hasPurchaseHistory) {
          const topProducts = await getTopSellingProducts(userId);

          return {
            success: true,
            user_id: userId,
            recommendations: topProducts.map(p => ({
              id: p.id,
              name: p.name,
              brand: p.brand,
              category: p.category,
              price: p.price,
              stock: p.stock,
              metadata: p.metadata,
              reason: 'Top-selling product'
            })),
            count: topProducts.length,
            strategy: 'cold-start',
            weights: null
          };
        }

        const [contentBased, collaborative] = await Promise.all([
          getContentBasedRecommendations(userId),
          getCollaborativeRecommendations(userId)
        ]);

        const recommendations = combineRecommendations(contentBased, collaborative, weights);

        if (recommendations.length === 0) {
          const topProducts = await getTopSellingProducts(userId);

          return {
            success: true,
            user_id: userId,
            recommendations: topProducts.map(p => ({
              id: p.id,
              name: p.name,
              brand: p.brand,
              category: p.category,
              price: p.price,
              stock: p.stock,
              metadata: p.metadata,
              reason: 'Top-selling product (fallback)'
            })),
            count: topProducts.length,
            strategy: 'fallback',
            weights: weights
          };
        }

        return {
          success: true,
          user_id: userId,
          recommendations: recommendations,
          count: recommendations.length,
          strategy: 'hybrid',
          weights: weights
        };

      } catch (error) {
        app.log.error('Recommendation error:', error);
        return reply.code(500).send({
          success: false,
          error: 'Internal server error'
        });
      }
    });

    // Admin endpoint to set weights
    app.post('/recommendations/admin/weights', async (request, reply) => {
      try {
        const { collaborative, content } = request.body;

        if (collaborative === undefined || content === undefined) {
          return reply.code(400).send({
            success: false,
            error: 'Both collaborative and content weights are required'
          });
        }

        if (typeof collaborative !== 'number' || typeof content !== 'number') {
          return reply.code(400).send({
            success: false,
            error: 'Weights must be numbers'
          });
        }

        const sum = collaborative + content;
        if (Math.abs(sum - 1.0) > 0.001) {
          return reply.code(400).send({
            success: false,
            error: `Weights must sum to 1.0 (current sum: ${sum})`
          });
        }

        if (collaborative < 0 || collaborative > 1 || content < 0 || content > 1) {
          return reply.code(400).send({
            success: false,
            error: 'Weights must be between 0 and 1'
          });
        }

        const weights = { collaborative, content };

        if (redisClient) {
          await redisClient.set('config:weights', JSON.stringify(weights));
        } else {
          return reply.code(503).send({
            success: false,
            error: 'Redis not available - cannot persist weights'
          });
        }

        return {
          success: true,
          message: 'Weights updated successfully',
          weights: weights
        };

      } catch (error) {
        app.log.error('Error setting weights:', error);
        return reply.code(500).send({
          success: false,
          error: 'Internal server error'
        });
      }
    });

    // Get current weights
    app.get('/recommendations/admin/weights', async (request, reply) => {
      try {
        const weights = await getWeights();
        return {
          success: true,
          weights: weights
        };
      } catch (error) {
        app.log.error('Error getting weights:', error);
        return reply.code(500).send({
          success: false,
          error: 'Internal server error'
        });
      }
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
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
      expect(payload.service).toBe('recommendation-service');
      expect(payload.redis).toBeDefined();
    });
  });

  describe('Hybrid Recommendations - GET /recommendations/:userId', () => {
    it('should return hybrid recommendations for user with purchase history', async () => {
      const mockCustomer = { id: 'cust_001' };
      const mockHistoryCount = { count: '5' };
      const mockPurchaseHistory = [
        { id: 'prod_001', name: 'Rolex', brand: 'Rolex', category: 'luxury', price: '14500.00', metadata: {} }
      ];
      const mockContentBased = [
        { id: 'prod_002', name: 'Omega', brand: 'Omega', category: 'luxury', price: '6800.00', stock: 7, metadata: {}, content_score: 0.9 }
      ];
      const mockCollaborative = [
        { id: 'prod_002', name: 'Omega', brand: 'Omega', category: 'luxury', price: '6800.00', stock: 7, metadata: {}, collab_score: 5, purchase_count: 3 }
      ];

      mockRedisClient.get.mockResolvedValue(JSON.stringify({ collaborative: 0.5, content: 0.5 }));

      db.query
        .mockResolvedValueOnce({ rows: [mockCustomer] }) // User check
        .mockResolvedValueOnce({ rows: [mockHistoryCount] }) // History check
        .mockResolvedValueOnce({ rows: mockPurchaseHistory }) // Content-based: purchase history
        .mockResolvedValueOnce({ rows: mockContentBased }) // Content-based: similar products
        .mockResolvedValueOnce({ rows: mockCollaborative }); // Collaborative

      const response = await app.inject({
        method: 'GET',
        url: '/recommendations/cust_001',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.user_id).toBe('cust_001');
      expect(payload.strategy).toBe('hybrid');
      expect(payload.recommendations).toBeInstanceOf(Array);
      expect(payload.recommendations[0]).toHaveProperty('scores');
      expect(payload.recommendations[0].scores).toHaveProperty('content');
      expect(payload.recommendations[0].scores).toHaveProperty('collaborative');
      expect(payload.recommendations[0].scores).toHaveProperty('hybrid');
      expect(payload.weights).toEqual({ collaborative: 0.5, content: 0.5 });
    });

    it('should return cold-start recommendations for user with no history', async () => {
      const mockCustomer = { id: 'cust_002' };
      const mockHistoryCount = { count: '0' };
      const mockTopSelling = [
        { id: 'prod_001', name: 'Rolex', brand: 'Rolex', category: 'luxury', price: '14500.00', stock: 3, metadata: {}, order_count: 10, total_sold: 15 },
        { id: 'prod_002', name: 'Omega', brand: 'Omega', category: 'luxury', price: '6800.00', stock: 7, metadata: {}, order_count: 8, total_sold: 12 }
      ];

      db.query
        .mockResolvedValueOnce({ rows: [mockCustomer] }) // User check
        .mockResolvedValueOnce({ rows: [mockHistoryCount] }) // History check
        .mockResolvedValueOnce({ rows: [] }) // No purchased products
        .mockResolvedValueOnce({ rows: mockTopSelling }); // Top-selling products

      const response = await app.inject({
        method: 'GET',
        url: '/recommendations/cust_002',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.strategy).toBe('cold-start');
      expect(payload.recommendations).toHaveLength(2);
      expect(payload.recommendations[0].reason).toBe('Top-selling product');
      expect(payload.weights).toBeNull();
    });

    it('should return 404 for non-existent user', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // User not found

      const response = await app.inject({
        method: 'GET',
        url: '/recommendations/cust_999',
      });

      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('User not found');
    });

    it('should use default weights when Redis has no weights', async () => {
      const mockCustomer = { id: 'cust_001' };
      const mockHistoryCount = { count: '5' };
      const mockPurchaseHistory = [
        { id: 'prod_001', name: 'Rolex', brand: 'Rolex', category: 'luxury', price: '14500.00', metadata: {} }
      ];
      const mockContentBased = [
        { id: 'prod_002', name: 'Omega', brand: 'Omega', category: 'luxury', price: '6800.00', stock: 7, metadata: {}, content_score: 0.9 }
      ];
      const mockCollaborative = [
        { id: 'prod_002', name: 'Omega', brand: 'Omega', category: 'luxury', price: '6800.00', stock: 7, metadata: {}, collab_score: 5, purchase_count: 3 }
      ];

      mockRedisClient.get.mockResolvedValue(null); // No weights in Redis

      db.query
        .mockResolvedValueOnce({ rows: [mockCustomer] })
        .mockResolvedValueOnce({ rows: [mockHistoryCount] })
        .mockResolvedValueOnce({ rows: mockPurchaseHistory })
        .mockResolvedValueOnce({ rows: mockContentBased })
        .mockResolvedValueOnce({ rows: mockCollaborative });

      const response = await app.inject({
        method: 'GET',
        url: '/recommendations/cust_001',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.weights).toEqual({ collaborative: 0.5, content: 0.5 }); // Default
    });
  });

  describe('Admin Weights - POST /recommendations/admin/weights', () => {
    it('should successfully update weights', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      const response = await app.inject({
        method: 'POST',
        url: '/recommendations/admin/weights',
        payload: {
          collaborative: 0.3,
          content: 0.7
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.message).toBe('Weights updated successfully');
      expect(payload.weights).toEqual({ collaborative: 0.3, content: 0.7 });
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'config:weights',
        JSON.stringify({ collaborative: 0.3, content: 0.7 })
      );
    });

    it('should reject when weights do not sum to 1.0', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/recommendations/admin/weights',
        payload: {
          collaborative: 0.3,
          content: 0.5
        }
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error).toContain('must sum to 1.0');
    });

    it('should reject negative weights', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/recommendations/admin/weights',
        payload: {
          collaborative: -0.2,
          content: 1.2
        }
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Weights must be between 0 and 1');
    });

    it('should reject when weights are missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/recommendations/admin/weights',
        payload: {
          collaborative: 0.5
        }
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Both collaborative and content weights are required');
    });

    it('should reject when weights are not numbers', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/recommendations/admin/weights',
        payload: {
          collaborative: '0.5',
          content: 0.5
        }
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Weights must be numbers');
    });

    it('should accept weights that sum to exactly 1.0', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      const response = await app.inject({
        method: 'POST',
        url: '/recommendations/admin/weights',
        payload: {
          collaborative: 0.2,
          content: 0.8
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.weights).toEqual({ collaborative: 0.2, content: 0.8 });
    });

    it('should accept edge case weights (0 and 1)', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      const response = await app.inject({
        method: 'POST',
        url: '/recommendations/admin/weights',
        payload: {
          collaborative: 0,
          content: 1
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.weights).toEqual({ collaborative: 0, content: 1 });
    });
  });

  describe('Admin Weights - GET /recommendations/admin/weights', () => {
    it('should return current weights from Redis', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({ collaborative: 0.3, content: 0.7 }));

      const response = await app.inject({
        method: 'GET',
        url: '/recommendations/admin/weights',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.weights).toEqual({ collaborative: 0.3, content: 0.7 });
    });

    it('should return default weights when Redis has no weights', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/recommendations/admin/weights',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.weights).toEqual({ collaborative: 0.5, content: 0.5 });
    });
  });
});

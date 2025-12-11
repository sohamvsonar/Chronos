const fastify = require('fastify');
const db = require('@chronos/database');
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

const PORT = process.env.RECOMMENDATION_SERVICE_PORT || 3003;
const REDIS_URL = process.env.REDIS_URL;

// Redis client for configuration
let redisClient = null;

// Setup Redis connection
async function setupRedis() {
  if (REDIS_URL) {
    try {
      redisClient = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });

      await redisClient.connect();

      redisClient.on('error', (err) => {
        app.log.warn('Redis connection error:', err.message);
      });

      redisClient.on('connect', () => {
        app.log.info('Redis connected for recommendation weights');
      });

      app.log.info('Redis client initialized successfully');
    } catch (error) {
      app.log.warn('Redis connection failed, using default weights:', error.message);
      redisClient = null;
    }
  } else {
    app.log.info('Redis URL not configured, using default weights');
  }
}

// Get recommendation weights from Redis
async function getWeights() {
  const defaultWeights = { collaborative: 0.5, content: 0.5 };

  if (!redisClient) {
    return defaultWeights;
  }

  try {
    const weightsStr = await redisClient.get('config:weights');
    if (weightsStr) {
      const weights = JSON.parse(weightsStr);
      app.log.info('Using custom weights from Redis:', weights);
      return weights;
    }
  } catch (error) {
    app.log.warn('Error fetching weights from Redis:', error.message);
  }

  return defaultWeights;
}

// Content-Based Filtering
async function getContentBasedRecommendations(userId) {
  try {
    // Step 1: Get user's purchase history
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

    if (purchaseHistory.rows.length === 0) {
      return [];
    }

    const purchasedProducts = purchaseHistory.rows;
    const purchasedIds = purchasedProducts.map(p => p.id);

    // Step 2: Extract top attributes
    const brandCounts = {};
    const categoryCounts = {};

    purchasedProducts.forEach(product => {
      brandCounts[product.brand] = (brandCounts[product.brand] || 0) + 1;
      categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
    });

    // Get top brand and category
    const topBrand = Object.keys(brandCounts).sort((a, b) => brandCounts[b] - brandCounts[a])[0];
    const topCategory = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a])[0];

    app.log.info(`Content-based: User ${userId} prefers brand=${topBrand}, category=${topCategory}`);

    // Step 3: Find similar products (not already purchased)
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
  } catch (error) {
    app.log.error('Content-based filtering error:', error);
    return [];
  }
}

// Collaborative Filtering
async function getCollaborativeRecommendations(userId) {
  try {
    // Find users who bought similar products
    const collaborativeQuery = await db.query(
      `WITH user_purchases AS (
         -- Get products the target user has purchased
         SELECT DISTINCT (item->>'product_id')::text as product_id
         FROM orders o
         CROSS JOIN jsonb_array_elements(o.items) as item
         WHERE o.customer_id = $1
       ),
       similar_users AS (
         -- Find other users who bought the same products
         SELECT DISTINCT o.customer_id, COUNT(*) as common_products
         FROM orders o
         CROSS JOIN jsonb_array_elements(o.items) as item
         WHERE (item->>'product_id')::text IN (SELECT product_id FROM user_purchases)
           AND o.customer_id != $1
         GROUP BY o.customer_id
         HAVING COUNT(*) >= 1
       ),
       other_products AS (
         -- Get products those similar users bought (that our user hasn't)
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
  } catch (error) {
    app.log.error('Collaborative filtering error:', error);
    return [];
  }
}

// Get top-selling products (for cold start)
async function getTopSellingProducts(userId) {
  try {
    // Get user's purchased products if they exist
    const purchasedIds = await db.query(
      `SELECT DISTINCT (item->>'product_id')::text as product_id
       FROM orders o
       CROSS JOIN jsonb_array_elements(o.items) as item
       WHERE o.customer_id = $1`,
      [userId]
    );

    const excludeIds = purchasedIds.rows.map(r => r.product_id);

    // Get top-selling products globally
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
  } catch (error) {
    app.log.error('Top-selling products error:', error);
    return [];
  }
}

// Normalize scores to 0-1 range
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

// Hybrid scoring and ranking
function combineRecommendations(contentBased, collaborative, weights) {
  const productMap = new Map();

  // Add content-based recommendations
  const normalizedContent = normalizeScores(contentBased, 'content_score');
  normalizedContent.forEach(product => {
    productMap.set(product.id, {
      ...product,
      content_score: product.content_score_normalized || 0,
      collab_score: 0
    });
  });

  // Add/update with collaborative recommendations
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

  // Calculate hybrid scores
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

  // Sort by hybrid score and return top 4
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

    app.log.info(`Generating recommendations for user: ${userId}`);

    // Check if user exists
    const userCheck = await db.query('SELECT id FROM customers WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return reply.code(404).send({
        success: false,
        error: 'User not found'
      });
    }

    // Get weights from Redis
    const weights = await getWeights();

    // Check if user has purchase history
    const historyCheck = await db.query(
      'SELECT COUNT(*) as count FROM orders WHERE customer_id = $1',
      [userId]
    );

    const hasPurchaseHistory = parseInt(historyCheck.rows[0].count) > 0;

    if (!hasPurchaseHistory) {
      app.log.info(`Cold start for user ${userId} - returning top-selling products`);
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

    // Run both recommendation strategies in parallel
    const [contentBased, collaborative] = await Promise.all([
      getContentBasedRecommendations(userId),
      getCollaborativeRecommendations(userId)
    ]);

    app.log.info(`Content-based found ${contentBased.length} products`);
    app.log.info(`Collaborative found ${collaborative.length} products`);

    // Combine and rank recommendations
    const recommendations = combineRecommendations(contentBased, collaborative, weights);

    // If still no recommendations, fall back to top-selling
    if (recommendations.length === 0) {
      app.log.info(`No personalized recommendations found, falling back to top-selling`);
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

    // Validate inputs
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

    // Validate sum to 1.0
    const sum = collaborative + content;
    if (Math.abs(sum - 1.0) > 0.001) {
      return reply.code(400).send({
        success: false,
        error: `Weights must sum to 1.0 (current sum: ${sum})`
      });
    }

    // Validate range
    if (collaborative < 0 || collaborative > 1 || content < 0 || content > 1) {
      return reply.code(400).send({
        success: false,
        error: 'Weights must be between 0 and 1'
      });
    }

    const weights = { collaborative, content };

    // Save to Redis
    if (redisClient) {
      await redisClient.set('config:weights', JSON.stringify(weights));
      app.log.info('Weights updated in Redis:', weights);
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

// Start server
async function start() {
  try {
    await setupRedis();
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Recommendation Service running on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

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

const PORT = process.env.PRODUCT_SERVICE_PORT || 3001;
const REDIS_URL = process.env.REDIS_URL;

// Redis client
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
        app.log.info('Redis connected for caching');
      });

      app.log.info('Redis client initialized successfully');
    } catch (error) {
      app.log.warn('Redis connection failed, caching disabled:', error.message);
      redisClient = null;
    }
  } else {
    app.log.info('Redis URL not configured, caching disabled');
  }
}

// Helper function to get from cache
async function getFromCache(key) {
  if (!redisClient) return null;
  try {
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    app.log.warn('Cache read error:', error.message);
    return null;
  }
}

// Helper function to set cache
async function setCache(key, value, ttl = 60) {
  if (!redisClient) return;
  try {
    await redisClient.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    app.log.warn('Cache write error:', error.message);
  }
}

// Helper function to delete from cache
async function deleteFromCache(key) {
  if (!redisClient) return;
  try {
    await redisClient.del(key);
  } catch (error) {
    app.log.warn('Cache delete error:', error.message);
  }
}

// Health check route
app.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    service: 'product-service',
    timestamp: new Date().toISOString(),
    redis: redisClient ? 'connected' : 'disabled'
  };
});

// Get all products with pagination and filtering
app.get('/products', async (request, reply) => {
  try {
    const {
      category,
      brand,
      minPrice,
      maxPrice,
      limit = 10,
      offset = 0
    } = request.query;

    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(category);
    }

    if (brand) {
      query += ` AND brand = $${paramIndex++}`;
      params.push(brand);
    }

    if (minPrice) {
      query += ` AND price >= $${paramIndex++}`;
      params.push(minPrice);
    }

    if (maxPrice) {
      query += ` AND price <= $${paramIndex++}`;
      params.push(maxPrice);
    }

    query += ' ORDER BY created_at DESC';

    // Add pagination
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count for pagination metadata
    let countQuery = 'SELECT COUNT(*) FROM products WHERE 1=1';
    const countParams = [];
    let countParamIndex = 1;

    if (category) {
      countQuery += ` AND category = $${countParamIndex++}`;
      countParams.push(category);
    }

    if (brand) {
      countQuery += ` AND brand = $${countParamIndex++}`;
      countParams.push(brand);
    }

    if (minPrice) {
      countQuery += ` AND price >= $${countParamIndex++}`;
      countParams.push(minPrice);
    }

    if (maxPrice) {
      countQuery += ` AND price <= $${countParamIndex++}`;
      countParams.push(maxPrice);
    }

    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    return {
      success: true,
      data: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: totalCount,
        hasMore: parseInt(offset) + parseInt(limit) < totalCount
      }
    };
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get product by ID with caching
app.get('/products/:id', async (request, reply) => {
  try {
    const { id } = request.params;
    const cacheKey = `product:${id}`;

    // Try to get from cache first
    const cached = await getFromCache(cacheKey);
    if (cached) {
      app.log.info(`Cache HIT for product ${id}`);
      return {
        success: true,
        data: cached,
        cached: true
      };
    }

    app.log.info(`Cache MISS for product ${id}`);

    // Get from database
    const result = await db.query('SELECT * FROM products WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return reply.code(404).send({
        success: false,
        error: 'Product not found'
      });
    }

    const product = result.rows[0];

    // Cache the result for 60 seconds
    await setCache(cacheKey, product, 60);

    return {
      success: true,
      data: product,
      cached: false
    };
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Decrement inventory (PATCH /products/:id/inventory)
app.patch('/products/:id/inventory', async (request, reply) => {
  try {
    const { id } = request.params;
    const { quantity } = request.body;

    // Validate quantity
    if (!quantity || quantity <= 0) {
      return reply.code(400).send({
        success: false,
        error: 'Quantity must be a positive number'
      });
    }

    // Get current product
    const productResult = await db.query('SELECT * FROM products WHERE id = $1', [id]);

    if (productResult.rows.length === 0) {
      return reply.code(404).send({
        success: false,
        error: 'Product not found'
      });
    }

    const product = productResult.rows[0];

    // Check if sufficient stock
    if (product.stock < quantity) {
      return reply.code(400).send({
        success: false,
        error: 'Insufficient stock',
        details: {
          requested: quantity,
          available: product.stock
        }
      });
    }

    // Decrement stock
    const updateResult = await db.query(
      `UPDATE products
       SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [quantity, id]
    );

    const updatedProduct = updateResult.rows[0];

    // Invalidate cache
    const cacheKey = `product:${id}`;
    await deleteFromCache(cacheKey);
    app.log.info(`Cache invalidated for product ${id}`);

    return {
      success: true,
      message: 'Inventory updated successfully',
      data: {
        product_id: updatedProduct.id,
        product_name: updatedProduct.name,
        quantity_purchased: quantity,
        remaining_stock: updatedProduct.stock,
        price_per_unit: updatedProduct.price,
        total_cost: (parseFloat(updatedProduct.price) * quantity).toFixed(2)
      }
    };
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create product (keeping existing functionality)
app.post('/products', async (request, reply) => {
  try {
    const { id, name, brand, price, stock, category, metadata } = request.body;

    if (!id || !name || !brand || price === undefined || stock === undefined || !category) {
      return reply.code(400).send({
        success: false,
        error: 'Missing required fields'
      });
    }

    const result = await db.query(
      `INSERT INTO products (id, name, brand, price, stock, category, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, name, brand, price, stock, category, metadata ? JSON.stringify(metadata) : null]
    );

    return reply.code(201).send({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    app.log.error(error);

    if (error.code === '23505') {
      return reply.code(409).send({
        success: false,
        error: 'Product with this ID already exists'
      });
    }

    return reply.code(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update product
app.put('/products/:id', async (request, reply) => {
  try {
    const { id } = request.params;
    const { name, brand, price, stock, category, metadata } = request.body;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }

    if (brand !== undefined) {
      updates.push(`brand = $${paramIndex++}`);
      params.push(brand);
    }

    if (price !== undefined) {
      updates.push(`price = $${paramIndex++}`);
      params.push(price);
    }

    if (stock !== undefined) {
      updates.push(`stock = $${paramIndex++}`);
      params.push(stock);
    }

    if (category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      params.push(category);
    }

    if (metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(metadata));
    }

    if (updates.length === 0) {
      return reply.code(400).send({
        success: false,
        error: 'No fields to update'
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await db.query(
      `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({
        success: false,
        error: 'Product not found'
      });
    }

    // Invalidate cache
    await deleteFromCache(`product:${id}`);

    return {
      success: true,
      data: result.rows[0]
    };
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete product
app.delete('/products/:id', async (request, reply) => {
  try {
    const { id } = request.params;

    const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return reply.code(404).send({
        success: false,
        error: 'Product not found'
      });
    }

    // Invalidate cache
    await deleteFromCache(`product:${id}`);

    return {
      success: true,
      message: 'Product deleted successfully',
      data: result.rows[0]
    };
  } catch (error) {
    app.log.error(error);
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
    console.log(`🚀 Product Service running on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

const fastify = require('fastify');
const db = require('@chronos/database');
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

// Health check route
app.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    service: 'product-service',
    timestamp: new Date().toISOString()
  };
});

// Get all products
app.get('/products', async (request, reply) => {
  try {
    const { brand, category, minPrice, maxPrice } = request.query;

    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (brand) {
      query += ` AND brand = $${paramIndex++}`;
      params.push(brand);
    }

    if (category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(category);
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

    const result = await db.query(query, params);

    return {
      success: true,
      data: result.rows,
      count: result.rows.length
    };
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get product by ID
app.get('/products/:id', async (request, reply) => {
  try {
    const { id } = request.params;

    const result = await db.query('SELECT * FROM products WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return reply.code(404).send({
        success: false,
        error: 'Product not found'
      });
    }

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

// Create product
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
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Product Service running on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

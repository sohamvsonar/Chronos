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

const PORT = process.env.CUSTOMER_SERVICE_PORT || 3002;

// Health check route
app.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    service: 'customer-service',
    timestamp: new Date().toISOString()
  };
});

// Get all customers
app.get('/customers', async (request, reply) => {
  try {
    const { tier, email } = request.query;

    let query = 'SELECT * FROM customers WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (tier) {
      query += ` AND tier = $${paramIndex++}`;
      params.push(tier);
    }

    if (email) {
      query += ` AND email ILIKE $${paramIndex++}`;
      params.push(`%${email}%`);
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

// Get customer by ID
app.get('/customers/:id', async (request, reply) => {
  try {
    const { id } = request.params;

    const result = await db.query('SELECT * FROM customers WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return reply.code(404).send({
        success: false,
        error: 'Customer not found'
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

// Create customer
app.post('/customers', async (request, reply) => {
  try {
    const { id, email, name, tier, phone, address } = request.body;

    if (!id || !email || !name || !tier) {
      return reply.code(400).send({
        success: false,
        error: 'Missing required fields (id, email, name, tier)'
      });
    }

    const result = await db.query(
      `INSERT INTO customers (id, email, name, tier, phone, address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, email, name, tier, phone, address ? JSON.stringify(address) : null]
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
        error: 'Customer with this ID or email already exists'
      });
    }

    return reply.code(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update customer
app.put('/customers/:id', async (request, reply) => {
  try {
    const { id } = request.params;
    const { email, name, tier, phone, address } = request.body;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(email);
    }

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }

    if (tier !== undefined) {
      updates.push(`tier = $${paramIndex++}`);
      params.push(tier);
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      params.push(phone);
    }

    if (address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      params.push(JSON.stringify(address));
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
      `UPDATE customers SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({
        success: false,
        error: 'Customer not found'
      });
    }

    return {
      success: true,
      data: result.rows[0]
    };
  } catch (error) {
    app.log.error(error);

    if (error.code === '23505') {
      return reply.code(409).send({
        success: false,
        error: 'Email already in use'
      });
    }

    return reply.code(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete customer
app.delete('/customers/:id', async (request, reply) => {
  try {
    const { id } = request.params;

    const result = await db.query('DELETE FROM customers WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return reply.code(404).send({
        success: false,
        error: 'Customer not found'
      });
    }

    return {
      success: true,
      message: 'Customer deleted successfully',
      data: result.rows[0]
    };
  } catch (error) {
    app.log.error(error);

    if (error.code === '23503') {
      return reply.code(409).send({
        success: false,
        error: 'Cannot delete customer with existing orders'
      });
    }

    return reply.code(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get customer orders
app.get('/customers/:id/orders', async (request, reply) => {
  try {
    const { id } = request.params;

    const result = await db.query(
      'SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC',
      [id]
    );

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

// Start server
async function start() {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Customer Service running on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

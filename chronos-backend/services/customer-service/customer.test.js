const fastify = require('fastify');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.test') });

// Mock the database module
jest.mock('@chronos/database', () => ({
  query: jest.fn(),
}));

const db = require('@chronos/database');

describe('Customer Service', () => {
  let app;

  beforeEach(async () => {
    app = fastify({ logger: false });

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
      expect(payload.service).toBe('customer-service');
    });
  });

  describe('GET /customers', () => {
    it('should return all customers', async () => {
      const mockCustomers = [
        { id: 'cust_001', email: 'john@example.com', name: 'John Doe', tier: 'platinum', phone: '555-0001' },
        { id: 'cust_002', email: 'jane@example.com', name: 'Jane Smith', tier: 'gold', phone: '555-0002' },
      ];

      db.query.mockResolvedValue({ rows: mockCustomers });

      const response = await app.inject({
        method: 'GET',
        url: '/customers',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data).toEqual(mockCustomers);
      expect(payload.count).toBe(2);
    });

    it('should filter customers by tier', async () => {
      const mockCustomers = [
        { id: 'cust_001', email: 'john@example.com', name: 'John Doe', tier: 'platinum' },
      ];

      db.query.mockResolvedValue({ rows: mockCustomers });

      const response = await app.inject({
        method: 'GET',
        url: '/customers?tier=platinum',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.data).toEqual(mockCustomers);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND tier = $1'),
        expect.arrayContaining(['platinum'])
      );
    });

    it('should filter customers by email', async () => {
      const mockCustomers = [
        { id: 'cust_001', email: 'john@example.com', name: 'John Doe', tier: 'platinum' },
      ];

      db.query.mockResolvedValue({ rows: mockCustomers });

      const response = await app.inject({
        method: 'GET',
        url: '/customers?email=john',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.data).toEqual(mockCustomers);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND email ILIKE $1'),
        expect.arrayContaining(['%john%'])
      );
    });
  });

  describe('GET /customers/:id', () => {
    it('should return a customer by ID', async () => {
      const mockCustomer = {
        id: 'cust_001',
        email: 'john@example.com',
        name: 'John Doe',
        tier: 'platinum',
        phone: '555-0001'
      };

      db.query.mockResolvedValue({ rows: [mockCustomer] });

      const response = await app.inject({
        method: 'GET',
        url: '/customers/cust_001',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data).toEqual(mockCustomer);
    });

    it('should return 404 if customer not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await app.inject({
        method: 'GET',
        url: '/customers/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Customer not found');
    });
  });

  describe('POST /customers', () => {
    it('should create a new customer', async () => {
      const newCustomer = {
        id: 'cust_003',
        email: 'new@example.com',
        name: 'New Customer',
        tier: 'silver',
        phone: '555-0003'
      };

      db.query.mockResolvedValue({ rows: [newCustomer] });

      const response = await app.inject({
        method: 'POST',
        url: '/customers',
        payload: newCustomer,
      });

      expect(response.statusCode).toBe(201);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data).toEqual(newCustomer);
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/customers',
        payload: {
          name: 'Incomplete Customer',
        },
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Missing required fields (id, email, name, tier)');
    });

    it('should return 409 if customer ID or email already exists', async () => {
      const error = new Error('Duplicate key');
      error.code = '23505';
      db.query.mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/customers',
        payload: {
          id: 'cust_001',
          email: 'duplicate@example.com',
          name: 'Duplicate Customer',
          tier: 'bronze'
        },
      });

      expect(response.statusCode).toBe(409);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Customer with this ID or email already exists');
    });
  });

  describe('PUT /customers/:id', () => {
    it('should update a customer', async () => {
      const updatedCustomer = {
        id: 'cust_001',
        email: 'john@example.com',
        name: 'John Updated',
        tier: 'platinum',
        phone: '555-9999'
      };

      db.query.mockResolvedValue({ rows: [updatedCustomer] });

      const response = await app.inject({
        method: 'PUT',
        url: '/customers/cust_001',
        payload: {
          name: 'John Updated',
          phone: '555-9999',
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data).toEqual(updatedCustomer);
    });

    it('should return 404 if customer not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await app.inject({
        method: 'PUT',
        url: '/customers/nonexistent',
        payload: {
          name: 'Updated Name',
        },
      });

      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Customer not found');
    });

    it('should return 400 if no fields to update', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/customers/cust_001',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('No fields to update');
    });

    it('should return 409 if email is already in use', async () => {
      const error = new Error('Duplicate key');
      error.code = '23505';
      db.query.mockRejectedValue(error);

      const response = await app.inject({
        method: 'PUT',
        url: '/customers/cust_001',
        payload: {
          email: 'taken@example.com',
        },
      });

      expect(response.statusCode).toBe(409);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Email already in use');
    });
  });

  describe('DELETE /customers/:id', () => {
    it('should delete a customer', async () => {
      const deletedCustomer = {
        id: 'cust_001',
        email: 'john@example.com',
        name: 'John Doe'
      };

      db.query.mockResolvedValue({ rows: [deletedCustomer] });

      const response = await app.inject({
        method: 'DELETE',
        url: '/customers/cust_001',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.message).toBe('Customer deleted successfully');
      expect(payload.data).toEqual(deletedCustomer);
    });

    it('should return 404 if customer not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await app.inject({
        method: 'DELETE',
        url: '/customers/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Customer not found');
    });

    it('should return 409 if customer has existing orders', async () => {
      const error = new Error('Foreign key constraint');
      error.code = '23503';
      db.query.mockRejectedValue(error);

      const response = await app.inject({
        method: 'DELETE',
        url: '/customers/cust_001',
      });

      expect(response.statusCode).toBe(409);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Cannot delete customer with existing orders');
    });
  });

  describe('GET /customers/:id/orders', () => {
    it('should return customer orders', async () => {
      const mockOrders = [
        { id: 'order_001', customer_id: 'cust_001', total: 9500, status: 'completed' },
        { id: 'order_002', customer_id: 'cust_001', total: 6500, status: 'pending' },
      ];

      db.query.mockResolvedValue({ rows: mockOrders });

      const response = await app.inject({
        method: 'GET',
        url: '/customers/cust_001/orders',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data).toEqual(mockOrders);
      expect(payload.count).toBe(2);
    });

    it('should return empty array if customer has no orders', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await app.inject({
        method: 'GET',
        url: '/customers/cust_001/orders',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data).toEqual([]);
      expect(payload.count).toBe(0);
    });
  });
});

const fastify = require('fastify');
const { calculateVipTier } = require('./helpers');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.test') });

// Mock the database module
jest.mock('@chronos/database', () => ({
  query: jest.fn(),
}));

const db = require('@chronos/database');

describe('Customer Service - Phase 2 Features', () => {
  let app;

  beforeEach(async () => {
    app = fastify({ logger: false });

    // Get customer by ID with total_spent and VIP tier
    app.get('/customers/:id', async (request, reply) => {
      try {
        const { id } = request.params;

        const customerResult = await db.query('SELECT * FROM customers WHERE id = $1', [id]);

        if (customerResult.rows.length === 0) {
          return reply.code(404).send({
            success: false,
            error: 'Customer not found'
          });
        }

        const customer = customerResult.rows[0];

        const ordersResult = await db.query(
          `SELECT COALESCE(SUM(total_amount), 0) as total_spent
           FROM orders
           WHERE customer_id = $1 AND status IN ('completed', 'pending')`,
          [id]
        );

        const totalSpent = parseFloat(ordersResult.rows[0].total_spent);
        const vipTier = calculateVipTier(totalSpent);

        return {
          success: true,
          data: {
            ...customer,
            total_spent: totalSpent,
            vip_tier: vipTier
          }
        };
      } catch (error) {
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
          message: 'Customer updated successfully',
          data: result.rows[0]
        };
      } catch (error) {
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

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('VIP Tier Calculation - GET /customers/:id', () => {
    it('should return Gold tier for customers spending > $10,000', async () => {
      const mockCustomer = {
        id: 'cust_001',
        email: 'john@example.com',
        name: 'John Doe',
        tier: 'platinum'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockCustomer] })
        .mockResolvedValueOnce({ rows: [{ total_spent: '89000.00' }] });

      const response = await app.inject({
        method: 'GET',
        url: '/customers/cust_001',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data.total_spent).toBe(89000);
      expect(payload.data.vip_tier).toBe('Gold');
    });

    it('should return Silver tier for customers spending > $5,000 but <= $10,000', async () => {
      const mockCustomer = {
        id: 'cust_002',
        email: 'jane@example.com',
        name: 'Jane Smith'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockCustomer] })
        .mockResolvedValueOnce({ rows: [{ total_spent: '6800.00' }] });

      const response = await app.inject({
        method: 'GET',
        url: '/customers/cust_002',
      });

      const payload = JSON.parse(response.payload);
      expect(payload.data.total_spent).toBe(6800);
      expect(payload.data.vip_tier).toBe('Silver');
    });

    it('should return Bronze tier for customers spending <= $5,000', async () => {
      const mockCustomer = {
        id: 'cust_003',
        email: 'bob@example.com',
        name: 'Bob Brown'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockCustomer] })
        .mockResolvedValueOnce({ rows: [{ total_spent: '3200.00' }] });

      const response = await app.inject({
        method: 'GET',
        url: '/customers/cust_003',
      });

      const payload = JSON.parse(response.payload);
      expect(payload.data.total_spent).toBe(3200);
      expect(payload.data.vip_tier).toBe('Bronze');
    });

    it('should return Bronze tier for customers with no orders', async () => {
      const mockCustomer = {
        id: 'cust_004',
        email: 'new@example.com',
        name: 'New Customer'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockCustomer] })
        .mockResolvedValueOnce({ rows: [{ total_spent: '0' }] });

      const response = await app.inject({
        method: 'GET',
        url: '/customers/cust_004',
      });

      const payload = JSON.parse(response.payload);
      expect(payload.data.total_spent).toBe(0);
      expect(payload.data.vip_tier).toBe('Bronze');
    });

    it('should handle exact threshold for Gold tier', async () => {
      const mockCustomer = {
        id: 'cust_005',
        email: 'threshold@example.com',
        name: 'Threshold Customer'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockCustomer] })
        .mockResolvedValueOnce({ rows: [{ total_spent: '10001.00' }] });

      const response = await app.inject({
        method: 'GET',
        url: '/customers/cust_005',
      });

      const payload = JSON.parse(response.payload);
      expect(payload.data.vip_tier).toBe('Gold');
    });

    it('should handle exact threshold for Silver tier', async () => {
      const mockCustomer = {
        id: 'cust_006',
        email: 'silver@example.com',
        name: 'Silver Customer'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockCustomer] })
        .mockResolvedValueOnce({ rows: [{ total_spent: '5001.00' }] });

      const response = await app.inject({
        method: 'GET',
        url: '/customers/cust_006',
      });

      const payload = JSON.parse(response.payload);
      expect(payload.data.vip_tier).toBe('Silver');
    });
  });

  describe('Total Spent Calculation', () => {
    it('should only sum completed and pending orders', async () => {
      const mockCustomer = {
        id: 'cust_001',
        email: 'test@example.com',
        name: 'Test User'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockCustomer] })
        .mockResolvedValueOnce({ rows: [{ total_spent: '15000.00' }] });

      await app.inject({
        method: 'GET',
        url: '/customers/cust_001',
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("status IN ('completed', 'pending')"),
        expect.any(Array)
      );
    });

    it('should return customer profile with all original fields plus analytics', async () => {
      const mockCustomer = {
        id: 'cust_001',
        email: 'john@example.com',
        name: 'John Doe',
        tier: 'platinum',
        phone: '555-0101',
        address: { city: 'New York' }
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockCustomer] })
        .mockResolvedValueOnce({ rows: [{ total_spent: '12000.00' }] });

      const response = await app.inject({
        method: 'GET',
        url: '/customers/cust_001',
      });

      const payload = JSON.parse(response.payload);
      expect(payload.data.id).toBe('cust_001');
      expect(payload.data.email).toBe('john@example.com');
      expect(payload.data.name).toBe('John Doe');
      expect(payload.data.total_spent).toBe(12000);
      expect(payload.data.vip_tier).toBe('Gold');
    });

    it('should return 404 for non-existent customer', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await app.inject({
        method: 'GET',
        url: '/customers/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Customer not found');
    });
  });

  describe('Customer Update - PUT /customers/:id', () => {
    it('should update customer email', async () => {
      const updatedCustomer = {
        id: 'cust_001',
        email: 'newemail@example.com',
        name: 'John Doe'
      };

      db.query.mockResolvedValueOnce({ rows: [updatedCustomer] });

      const response = await app.inject({
        method: 'PUT',
        url: '/customers/cust_001',
        payload: {
          email: 'newemail@example.com'
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data.email).toBe('newemail@example.com');
    });

    it('should update customer name', async () => {
      const updatedCustomer = {
        id: 'cust_001',
        email: 'john@example.com',
        name: 'John Updated'
      };

      db.query.mockResolvedValueOnce({ rows: [updatedCustomer] });

      const response = await app.inject({
        method: 'PUT',
        url: '/customers/cust_001',
        payload: {
          name: 'John Updated'
        }
      });

      const payload = JSON.parse(response.payload);
      expect(payload.data.name).toBe('John Updated');
    });

    it('should update multiple fields at once', async () => {
      const updatedCustomer = {
        id: 'cust_001',
        email: 'updated@example.com',
        name: 'Updated Name',
        phone: '555-9999'
      };

      db.query.mockResolvedValueOnce({ rows: [updatedCustomer] });

      const response = await app.inject({
        method: 'PUT',
        url: '/customers/cust_001',
        payload: {
          email: 'updated@example.com',
          name: 'Updated Name',
          phone: '555-9999'
        }
      });

      const payload = JSON.parse(response.payload);
      expect(payload.data.email).toBe('updated@example.com');
      expect(payload.data.name).toBe('Updated Name');
      expect(payload.data.phone).toBe('555-9999');
    });

    it('should return 400 if no fields to update', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/customers/cust_001',
        payload: {}
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('No fields to update');
    });

    it('should return 404 for non-existent customer', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await app.inject({
        method: 'PUT',
        url: '/customers/nonexistent',
        payload: {
          name: 'New Name'
        }
      });

      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Customer not found');
    });

    it('should return 409 if email already in use', async () => {
      const error = new Error('Duplicate email');
      error.code = '23505';
      db.query.mockRejectedValueOnce(error);

      const response = await app.inject({
        method: 'PUT',
        url: '/customers/cust_001',
        payload: {
          email: 'existing@example.com'
        }
      });

      expect(response.statusCode).toBe(409);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Email already in use');
    });

    it('should include success message in response', async () => {
      const updatedCustomer = {
        id: 'cust_001',
        name: 'Updated'
      };

      db.query.mockResolvedValueOnce({ rows: [updatedCustomer] });

      const response = await app.inject({
        method: 'PUT',
        url: '/customers/cust_001',
        payload: {
          name: 'Updated'
        }
      });

      const payload = JSON.parse(response.payload);
      expect(payload.message).toBe('Customer updated successfully');
    });
  });
});

describe('VIP Tier Helper Function', () => {
  it('should return Gold for amount > 10000', () => {
    expect(calculateVipTier(10001)).toBe('Gold');
    expect(calculateVipTier(50000)).toBe('Gold');
    expect(calculateVipTier(100000)).toBe('Gold');
  });

  it('should return Silver for amount > 5000 and <= 10000', () => {
    expect(calculateVipTier(5001)).toBe('Silver');
    expect(calculateVipTier(7500)).toBe('Silver');
    expect(calculateVipTier(10000)).toBe('Silver');
  });

  it('should return Bronze for amount <= 5000', () => {
    expect(calculateVipTier(0)).toBe('Bronze');
    expect(calculateVipTier(2500)).toBe('Bronze');
    expect(calculateVipTier(5000)).toBe('Bronze');
  });

  it('should handle exact threshold values', () => {
    expect(calculateVipTier(10000)).toBe('Silver');
    expect(calculateVipTier(5000)).toBe('Bronze');
  });

  it('should handle string inputs', () => {
    expect(calculateVipTier('15000')).toBe('Gold');
    expect(calculateVipTier('7500')).toBe('Silver');
    expect(calculateVipTier('3000')).toBe('Bronze');
  });

  it('should handle null and undefined', () => {
    expect(calculateVipTier(null)).toBe('Bronze');
    expect(calculateVipTier(undefined)).toBe('Bronze');
  });

  it('should handle negative values', () => {
    expect(calculateVipTier(-100)).toBe('Bronze');
  });

  it('should handle decimal values', () => {
    expect(calculateVipTier(10000.01)).toBe('Gold');
    expect(calculateVipTier(5000.01)).toBe('Silver');
    expect(calculateVipTier(4999.99)).toBe('Bronze');
  });
});

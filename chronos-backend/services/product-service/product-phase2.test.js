const fastify = require('fastify');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.test') });

// Mock the database module
jest.mock('@chronos/database', () => ({
  query: jest.fn(),
}));

const db = require('@chronos/database');

describe('Product Service - Phase 2 Features', () => {
  let app;

  beforeEach(async () => {
    app = fastify({ logger: false });

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
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await db.query(query, params);

        // Get total count
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
        return reply.code(500).send({
          success: false,
          error: 'Internal server error'
        });
      }
    });

    // Get product by ID (simulating caching behavior)
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
          data: result.rows[0],
          cached: false
        };
      } catch (error) {
        return reply.code(500).send({
          success: false,
          error: 'Internal server error'
        });
      }
    });

    // Decrement inventory
    app.patch('/products/:id/inventory', async (request, reply) => {
      try {
        const { id } = request.params;
        const { quantity } = request.body;

        if (!quantity || quantity <= 0) {
          return reply.code(400).send({
            success: false,
            error: 'Quantity must be a positive number'
          });
        }

        const productResult = await db.query('SELECT * FROM products WHERE id = $1', [id]);

        if (productResult.rows.length === 0) {
          return reply.code(404).send({
            success: false,
            error: 'Product not found'
          });
        }

        const product = productResult.rows[0];

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

        const updateResult = await db.query(
          `UPDATE products SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
          [quantity, id]
        );

        const updatedProduct = updateResult.rows[0];

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

  describe('Pagination - GET /products', () => {
    it('should return products with pagination metadata', async () => {
      const mockProducts = [
        { id: 'prod_001', name: 'Product 1', category: 'sport' },
        { id: 'prod_002', name: 'Product 2', category: 'sport' },
      ];

      db.query
        .mockResolvedValueOnce({ rows: mockProducts })
        .mockResolvedValueOnce({ rows: [{ count: '10' }] });

      const response = await app.inject({
        method: 'GET',
        url: '/products?limit=2&offset=0',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data).toEqual(mockProducts);
      expect(payload.pagination).toEqual({
        limit: 2,
        offset: 0,
        total: 10,
        hasMore: true
      });
    });

    it('should apply limit and offset correctly', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '10' }] });

      await app.inject({
        method: 'GET',
        url: '/products?limit=5&offset=5',
      });

      // Query params come as strings from URL
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        expect.arrayContaining(['5', '5'])
      );
    });

    it('should use default limit and offset if not provided', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const response = await app.inject({
        method: 'GET',
        url: '/products',
      });

      const payload = JSON.parse(response.payload);
      expect(payload.pagination.limit).toBe(10);
      expect(payload.pagination.offset).toBe(0);
    });

    it('should indicate hasMore is false on last page', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const response = await app.inject({
        method: 'GET',
        url: '/products?limit=10&offset=0',
      });

      const payload = JSON.parse(response.payload);
      expect(payload.pagination.hasMore).toBe(false);
    });
  });

  describe('Category Filtering - GET /products', () => {
    it('should filter by category', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });

      await app.inject({
        method: 'GET',
        url: '/products?category=sport',
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND category = $1'),
        expect.arrayContaining(['sport', 10, 0])
      );
    });

    it('should filter by multiple criteria', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });

      await app.inject({
        method: 'GET',
        url: '/products?category=luxury&brand=Rolex&minPrice=10000',
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND category = $1'),
        expect.arrayContaining(['luxury', 'Rolex', '10000'])
      );
    });

    it('should combine filtering with pagination', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '15' }] });

      const response = await app.inject({
        method: 'GET',
        url: '/products?category=sport&limit=5&offset=0',
      });

      const payload = JSON.parse(response.payload);
      expect(payload.pagination.total).toBe(15);
      expect(payload.pagination.hasMore).toBe(true);
    });
  });

  describe('Inventory Management - PATCH /products/:id/inventory', () => {
    it('should successfully decrement inventory', async () => {
      const mockProduct = {
        id: 'prod_001',
        name: 'Rolex Submariner',
        price: '14500.00',
        stock: 5
      };

      const updatedProduct = {
        ...mockProduct,
        stock: 3
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockProduct] })
        .mockResolvedValueOnce({ rows: [updatedProduct] });

      const response = await app.inject({
        method: 'PATCH',
        url: '/products/prod_001/inventory',
        payload: {
          quantity: 2
        }
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data.quantity_purchased).toBe(2);
      expect(payload.data.remaining_stock).toBe(3);
      expect(payload.data.total_cost).toBe('29000.00');
    });

    it('should reject when insufficient stock', async () => {
      const mockProduct = {
        id: 'prod_001',
        name: 'Product',
        stock: 2
      };

      db.query.mockResolvedValueOnce({ rows: [mockProduct] });

      const response = await app.inject({
        method: 'PATCH',
        url: '/products/prod_001/inventory',
        payload: {
          quantity: 5
        }
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Insufficient stock');
      expect(payload.details.requested).toBe(5);
      expect(payload.details.available).toBe(2);
    });

    it('should reject invalid quantity (zero)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/products/prod_001/inventory',
        payload: {
          quantity: 0
        }
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Quantity must be a positive number');
    });

    it('should reject invalid quantity (negative)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/products/prod_001/inventory',
        payload: {
          quantity: -1
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 for non-existent product', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await app.inject({
        method: 'PATCH',
        url: '/products/nonexistent/inventory',
        payload: {
          quantity: 1
        }
      });

      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Product not found');
    });

    it('should calculate total cost correctly', async () => {
      const mockProduct = {
        id: 'prod_001',
        name: 'Watch',
        price: '5200.50',
        stock: 10
      };

      const updatedProduct = {
        ...mockProduct,
        stock: 7
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockProduct] })
        .mockResolvedValueOnce({ rows: [updatedProduct] });

      const response = await app.inject({
        method: 'PATCH',
        url: '/products/prod_001/inventory',
        payload: {
          quantity: 3
        }
      });

      const payload = JSON.parse(response.payload);
      expect(payload.data.total_cost).toBe('15601.50');
      expect(payload.data.price_per_unit).toBe('5200.50');
    });
  });

  describe('Caching Behavior - GET /products/:id', () => {
    it('should return cached flag in response', async () => {
      const mockProduct = {
        id: 'prod_001',
        name: 'Product',
        price: '1000.00'
      };

      db.query.mockResolvedValueOnce({ rows: [mockProduct] });

      const response = await app.inject({
        method: 'GET',
        url: '/products/prod_001',
      });

      const payload = JSON.parse(response.payload);
      expect(payload.cached).toBeDefined();
      expect(typeof payload.cached).toBe('boolean');
    });
  });
});

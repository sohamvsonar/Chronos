const fastify = require('fastify');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.test') });

// Mock the database module
jest.mock('@chronos/database', () => ({
  query: jest.fn(),
}));

const db = require('@chronos/database');

describe('Product Service', () => {
  let app;

  beforeEach(async () => {
    app = fastify({ logger: false });

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
      expect(payload.service).toBe('product-service');
    });
  });

  describe('GET /products', () => {
    it('should return all products', async () => {
      const mockProducts = [
        { id: 'prod_001', name: 'Rolex Submariner', brand: 'Rolex', price: 9500, stock: 3, category: 'Luxury' },
        { id: 'prod_002', name: 'Omega Speedmaster', brand: 'Omega', price: 6500, stock: 5, category: 'Luxury' },
      ];

      db.query.mockResolvedValue({ rows: mockProducts });

      const response = await app.inject({
        method: 'GET',
        url: '/products',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data).toEqual(mockProducts);
      expect(payload.count).toBe(2);
    });

    it('should filter products by brand', async () => {
      const mockProducts = [
        { id: 'prod_001', name: 'Rolex Submariner', brand: 'Rolex', price: 9500, stock: 3, category: 'Luxury' },
      ];

      db.query.mockResolvedValue({ rows: mockProducts });

      const response = await app.inject({
        method: 'GET',
        url: '/products?brand=Rolex',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.data).toEqual(mockProducts);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND brand = $1'),
        expect.arrayContaining(['Rolex'])
      );
    });

    it('should filter products by price range', async () => {
      const mockProducts = [
        { id: 'prod_002', name: 'Omega Speedmaster', brand: 'Omega', price: 6500, stock: 5, category: 'Luxury' },
      ];

      db.query.mockResolvedValue({ rows: mockProducts });

      const response = await app.inject({
        method: 'GET',
        url: '/products?minPrice=5000&maxPrice=7000',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.data).toEqual(mockProducts);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND price >= $1'),
        expect.arrayContaining(['5000', '7000'])
      );
    });

    it('should filter products by category', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await app.inject({
        method: 'GET',
        url: '/products?category=Sport',
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND category = $1'),
        expect.arrayContaining(['Sport'])
      );
    });
  });

  describe('GET /products/:id', () => {
    it('should return a product by ID', async () => {
      const mockProduct = {
        id: 'prod_001',
        name: 'Rolex Submariner',
        brand: 'Rolex',
        price: 9500,
        stock: 3,
        category: 'Luxury'
      };

      db.query.mockResolvedValue({ rows: [mockProduct] });

      const response = await app.inject({
        method: 'GET',
        url: '/products/prod_001',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data).toEqual(mockProduct);
    });

    it('should return 404 if product not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await app.inject({
        method: 'GET',
        url: '/products/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Product not found');
    });
  });

  describe('POST /products', () => {
    it('should create a new product', async () => {
      const newProduct = {
        id: 'prod_003',
        name: 'TAG Heuer Carrera',
        brand: 'TAG Heuer',
        price: 4500,
        stock: 8,
        category: 'Sport'
      };

      db.query.mockResolvedValue({ rows: [newProduct] });

      const response = await app.inject({
        method: 'POST',
        url: '/products',
        payload: newProduct,
      });

      expect(response.statusCode).toBe(201);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data).toEqual(newProduct);
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/products',
        payload: {
          name: 'Incomplete Product',
        },
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Missing required fields');
    });

    it('should return 409 if product ID already exists', async () => {
      const error = new Error('Duplicate key');
      error.code = '23505';
      db.query.mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/products',
        payload: {
          id: 'prod_001',
          name: 'Duplicate Product',
          brand: 'Brand',
          price: 1000,
          stock: 1,
          category: 'Test'
        },
      });

      expect(response.statusCode).toBe(409);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Product with this ID already exists');
    });
  });

  describe('PUT /products/:id', () => {
    it('should update a product', async () => {
      const updatedProduct = {
        id: 'prod_001',
        name: 'Updated Name',
        brand: 'Rolex',
        price: 10000,
        stock: 2,
        category: 'Luxury'
      };

      db.query.mockResolvedValue({ rows: [updatedProduct] });

      const response = await app.inject({
        method: 'PUT',
        url: '/products/prod_001',
        payload: {
          name: 'Updated Name',
          price: 10000,
          stock: 2,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data).toEqual(updatedProduct);
    });

    it('should return 404 if product not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await app.inject({
        method: 'PUT',
        url: '/products/nonexistent',
        payload: {
          name: 'Updated Name',
        },
      });

      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Product not found');
    });

    it('should return 400 if no fields to update', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/products/prod_001',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('No fields to update');
    });
  });

  describe('DELETE /products/:id', () => {
    it('should delete a product', async () => {
      const deletedProduct = {
        id: 'prod_001',
        name: 'Rolex Submariner',
        brand: 'Rolex'
      };

      db.query.mockResolvedValue({ rows: [deletedProduct] });

      const response = await app.inject({
        method: 'DELETE',
        url: '/products/prod_001',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.message).toBe('Product deleted successfully');
      expect(payload.data).toEqual(deletedProduct);
    });

    it('should return 404 if product not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await app.inject({
        method: 'DELETE',
        url: '/products/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Product not found');
    });
  });
});

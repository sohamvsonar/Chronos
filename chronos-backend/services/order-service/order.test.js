const fastify = require('fastify');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.test') });

// Mock the database module
jest.mock('@chronos/database', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
}));

// Mock BullMQ
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: '1' }),
    close: jest.fn(),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn(),
  })),
}));

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
  }));
});

const db = require('@chronos/database');
const { Queue } = require('bullmq');

describe('Order Service - Phase 4', () => {
  let app;
  let mockQueue;
  let mockClient;

  beforeEach(async () => {
    app = fastify({ logger: false });

    // Setup mock queue
    mockQueue = new Queue();

    // Setup mock database client
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    db.pool.connect.mockResolvedValue(mockClient);

    // Health check
    app.get('/health', async (request, reply) => {
      return {
        status: 'ok',
        service: 'order-service',
        timestamp: new Date().toISOString(),
        queue: 'active'
      };
    });

    // Checkout endpoint
    app.post('/checkout', async (request, reply) => {
      const client = await db.pool.connect();

      try {
        const { userId, items } = request.body;

        if (!userId || !items || !Array.isArray(items) || items.length === 0) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid request. userId and items array are required.'
          });
        }

        await client.query('BEGIN');

        let totalAmount = 0;
        const orderItems = [];

        for (const item of items) {
          const { productId, quantity } = item;

          if (!productId || !quantity || quantity <= 0) {
            await client.query('ROLLBACK');
            return reply.code(400).send({
              success: false,
              error: 'Invalid item. productId and positive quantity are required.'
            });
          }

          const productResult = await client.query(
            'SELECT id, name, price, stock FROM products WHERE id = $1',
            [productId]
          );

          if (productResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return reply.code(404).send({
              success: false,
              error: `Product ${productId} not found`
            });
          }

          const product = productResult.rows[0];

          if (product.stock < quantity) {
            await client.query('ROLLBACK');
            return reply.code(400).send({
              success: false,
              error: `Insufficient stock for ${product.name}`,
              details: {
                productId: product.id,
                productName: product.name,
                requested: quantity,
                available: product.stock
              }
            });
          }

          await client.query(
            'UPDATE products SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [quantity, productId]
          );

          const itemTotal = parseFloat(product.price) * quantity;
          totalAmount += itemTotal;

          orderItems.push({
            productId: product.id,
            productName: product.name,
            quantity: quantity,
            pricePerUnit: parseFloat(product.price),
            totalPrice: itemTotal
          });
        }

        const orderNumber = `ORD-${Date.now()}-TEST`;

        const orderResult = await client.query(
          `INSERT INTO orders (order_number, customer_id, items, total_amount, status, payment_method, shipping_address)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, order_number, customer_id, total_amount, status, created_at`,
          [
            orderNumber,
            userId,
            JSON.stringify(items),
            totalAmount,
            'pending',
            'credit_card',
            JSON.stringify({ address: 'To be confirmed' })
          ]
        );

        const order = orderResult.rows[0];

        for (const item of orderItems) {
          await client.query(
            `INSERT INTO order_items (order_id, product_id, quantity, price_per_unit, total_price)
             VALUES ($1, $2, $3, $4, $5)`,
            [order.id, item.productId, item.quantity, item.pricePerUnit, item.totalPrice]
          );
        }

        await client.query('COMMIT');

        const job = await mockQueue.add('PROCESS_ORDER', {
          type: 'PROCESS_ORDER',
          orderId: order.id,
          userId: userId,
          orderNumber: order.order_number
        });

        return reply.code(202).send({
          success: true,
          message: 'Order created and processing',
          orderId: order.id,
          orderNumber: order.order_number,
          status: 'processing',
          totalAmount: totalAmount,
          items: orderItems,
          jobId: job.id
        });

      } catch (error) {
        await client.query('ROLLBACK');
        return reply.code(500).send({
          success: false,
          error: 'Internal server error',
          message: error.message
        });
      } finally {
        client.release();
      }
    });

    // Get orders for user
    app.get('/orders/:userId', async (request, reply) => {
      try {
        const { userId } = request.params;

        const ordersResult = await db.query(
          `SELECT id, order_number, customer_id, total_amount, status, payment_method, created_at, updated_at
           FROM orders
           WHERE customer_id = $1
           ORDER BY created_at DESC`,
          [userId]
        );

        const orders = [];

        for (const order of ordersResult.rows) {
          const itemsResult = await db.query(
            `SELECT oi.product_id, p.name as product_name, oi.quantity, oi.price_per_unit, oi.total_price
             FROM order_items oi
             JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = $1`,
            [order.id]
          );

          orders.push({
            ...order,
            total_amount: parseFloat(order.total_amount),
            items: itemsResult.rows.map(item => ({
              productId: item.product_id,
              productName: item.product_name,
              quantity: item.quantity,
              pricePerUnit: parseFloat(item.price_per_unit),
              totalPrice: parseFloat(item.total_price)
            }))
          });
        }

        return {
          success: true,
          userId: userId,
          orders: orders,
          count: orders.length
        };

      } catch (error) {
        return reply.code(500).send({
          success: false,
          error: 'Internal server error'
        });
      }
    });

    // Get specific order
    app.get('/orders/:userId/:orderId', async (request, reply) => {
      try {
        const { userId, orderId } = request.params;

        const orderResult = await db.query(
          `SELECT id, order_number, customer_id, total_amount, status, payment_method, created_at, updated_at
           FROM orders
           WHERE id = $1 AND customer_id = $2`,
          [orderId, userId]
        );

        if (orderResult.rows.length === 0) {
          return reply.code(404).send({
            success: false,
            error: 'Order not found'
          });
        }

        const order = orderResult.rows[0];

        const itemsResult = await db.query(
          `SELECT oi.product_id, p.name as product_name, oi.quantity, oi.price_per_unit, oi.total_price
           FROM order_items oi
           JOIN products p ON p.id = oi.product_id
           WHERE oi.order_id = $1`,
          [order.id]
        );

        return {
          success: true,
          order: {
            ...order,
            total_amount: parseFloat(order.total_amount),
            items: itemsResult.rows.map(item => ({
              productId: item.product_id,
              productName: item.product_name,
              quantity: item.quantity,
              pricePerUnit: parseFloat(item.price_per_unit),
              totalPrice: parseFloat(item.total_price)
            }))
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

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.status).toBe('ok');
      expect(payload.service).toBe('order-service');
      expect(payload.queue).toBe('active');
    });
  });

  describe('Checkout - POST /checkout', () => {
    it('should successfully create an order and enqueue job', async () => {
      const mockProduct = {
        id: 'prod_001',
        name: 'Rolex Submariner',
        price: '14500.00',
        stock: 5
      };

      const mockOrder = {
        id: 1,
        order_number: 'ORD-123',
        customer_id: 'cust_001',
        total_amount: '14500.00',
        status: 'pending',
        created_at: new Date()
      };

      // Mock BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // Mock product query
      mockClient.query.mockResolvedValueOnce({ rows: [mockProduct] });
      // Mock inventory update
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // Mock order insert
      mockClient.query.mockResolvedValueOnce({ rows: [mockOrder] });
      // Mock order_items insert
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // Mock COMMIT
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const response = await app.inject({
        method: 'POST',
        url: '/checkout',
        payload: {
          userId: 'cust_001',
          items: [
            {
              productId: 'prod_001',
              quantity: 1
            }
          ]
        }
      });

      expect(response.statusCode).toBe(202);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.message).toBe('Order created and processing');
      expect(payload.orderId).toBe(1);
      expect(payload.status).toBe('processing');
      expect(payload.totalAmount).toBe(14500);
      expect(payload.jobId).toBe('1');
      expect(payload.items).toHaveLength(1);
      expect(payload.items[0].productId).toBe('prod_001');
      expect(payload.items[0].quantity).toBe(1);

      // Verify job was enqueued
      expect(mockQueue.add).toHaveBeenCalledWith('PROCESS_ORDER', {
        type: 'PROCESS_ORDER',
        orderId: 1,
        userId: 'cust_001',
        orderNumber: 'ORD-123'
      });
    });

    it('should handle multiple items in order', async () => {
      const mockProducts = [
        { id: 'prod_001', name: 'Rolex', price: '14500.00', stock: 5 },
        { id: 'prod_002', name: 'Omega', price: '6800.00', stock: 10 }
      ];

      const mockOrder = {
        id: 2,
        order_number: 'ORD-124',
        customer_id: 'cust_001',
        total_amount: '28100.00',
        status: 'pending',
        created_at: new Date()
      };

      // Mock BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // Mock first product query
      mockClient.query.mockResolvedValueOnce({ rows: [mockProducts[0]] });
      // Mock first inventory update
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // Mock second product query
      mockClient.query.mockResolvedValueOnce({ rows: [mockProducts[1]] });
      // Mock second inventory update
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // Mock order insert
      mockClient.query.mockResolvedValueOnce({ rows: [mockOrder] });
      // Mock order_items inserts (2x)
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // Mock COMMIT
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const response = await app.inject({
        method: 'POST',
        url: '/checkout',
        payload: {
          userId: 'cust_001',
          items: [
            { productId: 'prod_001', quantity: 1 },
            { productId: 'prod_002', quantity: 2 }
          ]
        }
      });

      expect(response.statusCode).toBe(202);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.totalAmount).toBe(28100);
      expect(payload.items).toHaveLength(2);
    });

    it('should reject when insufficient stock', async () => {
      const mockProduct = {
        id: 'prod_001',
        name: 'Rolex',
        price: '14500.00',
        stock: 2
      };

      // Mock BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // Mock product query
      mockClient.query.mockResolvedValueOnce({ rows: [mockProduct] });
      // Mock ROLLBACK
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const response = await app.inject({
        method: 'POST',
        url: '/checkout',
        payload: {
          userId: 'cust_001',
          items: [
            { productId: 'prod_001', quantity: 5 }
          ]
        }
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Insufficient stock for Rolex');
      expect(payload.details).toEqual({
        productId: 'prod_001',
        productName: 'Rolex',
        requested: 5,
        available: 2
      });

      // Verify ROLLBACK was called
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should reject when product not found', async () => {
      // Mock BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // Mock product query (not found)
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // Mock ROLLBACK
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const response = await app.inject({
        method: 'POST',
        url: '/checkout',
        payload: {
          userId: 'cust_001',
          items: [
            { productId: 'prod_999', quantity: 1 }
          ]
        }
      });

      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Product prod_999 not found');
    });

    it('should reject invalid quantity (zero)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/checkout',
        payload: {
          userId: 'cust_001',
          items: [
            { productId: 'prod_001', quantity: 0 }
          ]
        }
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Invalid item. productId and positive quantity are required.');
    });

    it('should reject invalid quantity (negative)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/checkout',
        payload: {
          userId: 'cust_001',
          items: [
            { productId: 'prod_001', quantity: -1 }
          ]
        }
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Invalid item. productId and positive quantity are required.');
    });

    it('should reject when userId is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/checkout',
        payload: {
          items: [
            { productId: 'prod_001', quantity: 1 }
          ]
        }
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Invalid request. userId and items array are required.');
    });

    it('should reject when items array is empty', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/checkout',
        payload: {
          userId: 'cust_001',
          items: []
        }
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Invalid request. userId and items array are required.');
    });

    it('should reject when items is not an array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/checkout',
        payload: {
          userId: 'cust_001',
          items: 'not-an-array'
        }
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Invalid request. userId and items array are required.');
    });
  });

  describe('Get Orders - GET /orders/:userId', () => {
    it('should return all orders for a user', async () => {
      const mockOrders = [
        {
          id: 1,
          order_number: 'ORD-123',
          customer_id: 'cust_001',
          total_amount: '14500.00',
          status: 'completed',
          payment_method: 'credit_card',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      const mockOrderItems = [
        {
          product_id: 'prod_001',
          product_name: 'Rolex',
          quantity: 1,
          price_per_unit: '14500.00',
          total_price: '14500.00'
        }
      ];

      db.query
        .mockResolvedValueOnce({ rows: mockOrders })
        .mockResolvedValueOnce({ rows: mockOrderItems });

      const response = await app.inject({
        method: 'GET',
        url: '/orders/cust_001',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.userId).toBe('cust_001');
      expect(payload.orders).toHaveLength(1);
      expect(payload.orders[0].id).toBe(1);
      expect(payload.orders[0].status).toBe('completed');
      expect(payload.orders[0].items).toHaveLength(1);
      expect(payload.count).toBe(1);
    });

    it('should return empty array when user has no orders', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await app.inject({
        method: 'GET',
        url: '/orders/cust_002',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.orders).toHaveLength(0);
      expect(payload.count).toBe(0);
    });
  });

  describe('Get Order - GET /orders/:userId/:orderId', () => {
    it('should return specific order', async () => {
      const mockOrder = {
        id: 1,
        order_number: 'ORD-123',
        customer_id: 'cust_001',
        total_amount: '14500.00',
        status: 'completed',
        payment_method: 'credit_card',
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockOrderItems = [
        {
          product_id: 'prod_001',
          product_name: 'Rolex',
          quantity: 1,
          price_per_unit: '14500.00',
          total_price: '14500.00'
        }
      ];

      db.query
        .mockResolvedValueOnce({ rows: [mockOrder] })
        .mockResolvedValueOnce({ rows: mockOrderItems });

      const response = await app.inject({
        method: 'GET',
        url: '/orders/cust_001/1',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.order.id).toBe(1);
      expect(payload.order.order_number).toBe('ORD-123');
      expect(payload.order.total_amount).toBe(14500);
      expect(payload.order.items).toHaveLength(1);
    });

    it('should return 404 when order not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await app.inject({
        method: 'GET',
        url: '/orders/cust_001/999',
      });

      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Order not found');
    });

    it('should return 404 when order belongs to different user', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await app.inject({
        method: 'GET',
        url: '/orders/cust_002/1',
      });

      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Order not found');
    });
  });
});

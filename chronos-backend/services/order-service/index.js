const fastify = require('fastify');
const db = require('@chronos/database');
const { Queue, Worker } = require('bullmq');
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

const PORT = process.env.ORDER_SERVICE_PORT || 3004;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Redis connection for BullMQ
const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

// BullMQ Queue
const orderQueue = new Queue('chronos-jobs', { connection });

// BullMQ Worker
const orderWorker = new Worker(
  'chronos-jobs',
  async (job) => {
    app.log.info(`Processing job ${job.id}: ${job.data.type}`);

    if (job.data.type === 'PROCESS_ORDER') {
      await processOrder(job.data);
    }

    return { success: true };
  },
  { connection }
);

// Worker event handlers
orderWorker.on('completed', (job) => {
  app.log.info(`Job ${job.id} completed successfully`);
});

orderWorker.on('failed', (job, err) => {
  app.log.error(`Job ${job.id} failed:`, err);
});

// Ensure reward_points column exists (adds if missing)
async function ensureLoyaltySchema() {
  try {
    await db.query(`
      ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS reward_points INTEGER NOT NULL DEFAULT 0;
    `);
    app.log.info('Loyalty schema verified (reward_points column present)');
  } catch (error) {
    app.log.error('Failed to ensure loyalty schema:', error);
    throw error;
  }
}

// Background Order Processing Logic
async function processOrder(data) {
  const { orderId, userId } = data;

  try {
    app.log.info(`[WORKER] Processing order ${orderId} for user ${userId}`);

    // Simulate Payment & Shipping delay (2 seconds)
    app.log.info(`[WORKER] Simulating payment and shipping...`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Update Order status to COMPLETED
    await db.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['completed', orderId]
    );

    app.log.info(`[WORKER] Order ${orderId} status updated to COMPLETED`);

    // Inventory Alert: Check for low stock
    const orderItems = await db.query(
      `SELECT oi.product_id, p.name, p.stock
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    for (const item of orderItems.rows) {
      if (item.stock < 3) {
        app.log.warn(`[ALERT] Low stock for Product ${item.name} (ID: ${item.product_id}). Current stock: ${item.stock}`);
      }
    }

    // Invalidate recommendation cache for user
    const redisClient = new Redis(REDIS_URL);
    const cacheKey = `recommendations:${userId}`;
    await redisClient.del(cacheKey);
    app.log.info(`[WORKER] Invalidated recommendation cache for user ${userId}`);
    await redisClient.quit();

    app.log.info(`[WORKER] Order ${orderId} processing complete`);

  } catch (error) {
    app.log.error(`[WORKER] Error processing order ${orderId}:`, error);
    throw error;
  }
}

// Health check
app.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    service: 'order-service',
    timestamp: new Date().toISOString(),
    queue: 'active'
  };
});

// Checkout Endpoint
app.post('/checkout', async (request, reply) => {
  const client = await db.pool.connect();

  try {
    const { userId, items } = request.body;

    // Validation
    if (!userId || !items || !Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request. userId and items array are required.'
      });
    }

    // Fetch customer tier for discounts and points
    const customerResult = await client.query(
      'SELECT id, tier, reward_points FROM customers WHERE id = $1',
      [userId]
    );

    if (customerResult.rows.length === 0) {
      return reply.code(404).send({
        success: false,
        error: 'Customer not found'
      });
    }

    const customer = customerResult.rows[0];
    const loyaltyDiscounts = {
      platinum: 0.15,
      gold: 0.10,
      silver: 0.075,
      bronze: 0.05
    };
    const tierKey = (customer.tier || '').toLowerCase();
    const discountRate = loyaltyDiscounts[tierKey] || 0;

    app.log.info(`Processing checkout for user ${userId} with ${items.length} items`);

    // Start Transaction
    await client.query('BEGIN');

    let subtotal = 0;
    const orderItems = [];

    // Process each item
    for (const item of items) {
      const { productId, quantity } = item;

      if (!productId || !quantity || quantity <= 0) {
        await client.query('ROLLBACK');
        return reply.code(400).send({
          success: false,
          error: 'Invalid item. productId and positive quantity are required.'
        });
      }

      // Check product exists and get stock
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

      // Check stock
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

      // Decrement inventory
      await client.query(
        'UPDATE products SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [quantity, productId]
      );

      // Calculate item total
      const itemTotal = parseFloat(product.price) * quantity;
      subtotal += itemTotal;

      orderItems.push({
        productId: product.id,
        productName: product.name,
        quantity: quantity,
        pricePerUnit: parseFloat(product.price),
        totalPrice: itemTotal
      });

      app.log.info(`Processed item: ${product.name} x${quantity} = $${itemTotal}`);
    }

    const discountAmount = parseFloat((subtotal * discountRate).toFixed(2));
    const finalTotal = parseFloat((subtotal - discountAmount).toFixed(2));
    const rewardPointsEarned = Math.max(0, Math.floor(finalTotal));

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Normalize items to snake_case before storing in orders.items
    const normalizedItems = orderItems.map(item => ({
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      price_per_unit: item.pricePerUnit,
      total_price: item.totalPrice
    }));

    // Create Order
    const orderResult = await client.query(
      `INSERT INTO orders (order_number, customer_id, items, total_amount, status, payment_method, shipping_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, order_number, customer_id, total_amount, status, created_at`,
      [
        orderNumber,
        userId,
        JSON.stringify(normalizedItems),
        finalTotal,
        'pending',
        'credit_card', // Default payment method
        JSON.stringify({ address: 'To be confirmed' }) // Placeholder
      ]
    );

    const order = orderResult.rows[0];

    // Create OrderItems
    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price_per_unit, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.productId, item.quantity, item.pricePerUnit, item.totalPrice]
      );
    }

    // Update loyalty reward points
    await client.query(
      `UPDATE customers
       SET reward_points = reward_points + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [rewardPointsEarned, userId]
    );

    // Commit Transaction
    await client.query('COMMIT');

    app.log.info(`Order ${order.id} created successfully. Subtotal: $${subtotal} Discount: ${discountAmount} Final: $${finalTotal}`);

    // Add job to BullMQ queue
    const job = await orderQueue.add('PROCESS_ORDER', {
      type: 'PROCESS_ORDER',
      orderId: order.id,
      userId: userId,
      orderNumber: order.order_number
    });

    app.log.info(`Job ${job.id} added to queue for order ${order.id}`);

    // Return 202 Accepted
    return reply.code(202).send({
      success: true,
      message: 'Order created and processing',
      orderId: order.id,
      orderNumber: order.order_number,
      status: 'processing',
      subtotal: parseFloat(subtotal.toFixed(2)),
      discountRate,
      discountAmount,
      totalAmount: finalTotal,
      rewardPointsEarned,
      items: orderItems,
      jobId: job.id
    });

  } catch (error) {
    await client.query('ROLLBACK');
    app.log.error('Checkout error:', error);
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  } finally {
    client.release();
  }
});

// Get Orders for User
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
      // Get order items
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
    app.log.error('Get orders error:', error);
    return reply.code(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get Order by ID
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

    // Get order items
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
    app.log.error('Get order error:', error);
    return reply.code(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Graceful shutdown
async function closeGracefully(signal) {
  app.log.info(`Received signal to terminate: ${signal}`);

  await orderWorker.close();
  await orderQueue.close();
  await connection.quit();
  await app.close();

  process.exit(0);
}

process.on('SIGINT', () => closeGracefully('SIGINT'));
process.on('SIGTERM', () => closeGracefully('SIGTERM'));

// Start server
async function start() {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Order Service running on http://localhost:${PORT}`);
    console.log(`📦 BullMQ Worker listening to 'chronos-jobs' queue`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

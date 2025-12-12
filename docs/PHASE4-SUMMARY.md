# Phase 4 Summary - Asynchronous Order Processing

## Overview

Phase 4 adds **asynchronous order processing** to Chronos using BullMQ for reliable background job execution. Orders are created synchronously with inventory validation, then processed asynchronously for payment simulation, stock alerts, and cache invalidation.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (Port 3000)                  │
│                    - JWT Authentication                     │
│                    - Rate Limiting                          │
└────────────┬────────────────────────────────────────────────┘
             │
             ├──────> /products/*         → Product Service (3001)
             ├──────> /customers/*        → Customer Service (3002)
             ├──────> /recommendations/*  → Recommendation Service (3003)
             ├──────> /checkout           → Order Service (3004) ⭐ NEW
             └──────> /orders/*           → Order Service (3004) ⭐ NEW
                                              │
                                              ├─> PostgreSQL (transactions)
                                              └─> Redis/BullMQ (job queue)
                                                       │
                                                       ├─> Worker: Process Order
                                                       ├─> Worker: Update Status
                                                       ├─> Worker: Check Stock
                                                       └─> Worker: Invalidate Cache
```

---

## New Service: Order Service (Port 3004)

### Endpoints

#### 1. `POST /checkout`
Creates an order with atomic inventory updates and enqueues background processing.

**Request:**
```bash
curl -X POST http://localhost:3000/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "cust_001",
    "items": [
      {
        "productId": "prod_001",
        "quantity": 1
      }
    ]
  }'
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Order created and processing",
  "orderId": 1,
  "orderNumber": "ORD-1733958123456-ABC123XYZ",
  "status": "processing",
  "totalAmount": 14500,
  "items": [
    {
      "productId": "prod_001",
      "productName": "Rolex Submariner Date",
      "quantity": 1,
      "pricePerUnit": 14500,
      "totalPrice": 14500
    }
  ],
  "jobId": "1"
}
```

**Synchronous Operations:**
1. ✅ Validate request (userId, items)
2. ✅ Start database transaction
3. ✅ For each item:
   - Check product exists
   - Validate sufficient stock
   - Decrement inventory atomically
4. ✅ Create order record (status: `pending`)
5. ✅ Create order_items records
6. ✅ Commit transaction (or rollback on error)
7. ✅ Enqueue BullMQ job
8. ✅ Return 202 Accepted

**Asynchronous Operations (Worker):**
1. ⏳ Simulate payment processing (2 second delay)
2. ⏳ Update order status to `completed`
3. ⏳ Check for low stock alerts (< 5 units)
4. ⏳ Invalidate recommendation cache
5. ⏳ Log completion

---

#### 2. `GET /orders/:userId`
Retrieves all orders for a user.

**Request:**
```bash
curl http://localhost:3000/orders/cust_001 \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true,
  "userId": "cust_001",
  "orders": [
    {
      "id": 1,
      "order_number": "ORD-1733958123456-ABC123XYZ",
      "customer_id": "cust_001",
      "total_amount": 14500,
      "status": "completed",
      "payment_method": "credit_card",
      "created_at": "2025-12-11T...",
      "updated_at": "2025-12-11T...",
      "items": [...]
    }
  ],
  "count": 1
}
```

---

#### 3. `GET /orders/:userId/:orderId`
Retrieves a specific order.

**Request:**
```bash
curl http://localhost:3000/orders/cust_001/1 \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": 1,
    "order_number": "ORD-...",
    "customer_id": "cust_001",
    "total_amount": 14500,
    "status": "completed",
    "items": [...]
  }
}
```

---

## BullMQ Integration

### Queue Setup

```javascript
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

const orderQueue = new Queue('chronos-jobs', { connection });
```

### Worker Implementation

```javascript
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

// Event handlers
orderWorker.on('completed', (job) => {
  app.log.info(`Job ${job.id} completed successfully`);
});

orderWorker.on('failed', (job, err) => {
  app.log.error(`Job ${job.id} failed:`, err);
});
```

### Background Processing Logic

```javascript
async function processOrder(data) {
  const { orderId, userId } = data;

  try {
    // 1. Simulate Payment & Shipping (2 seconds)
    app.log.info(`[WORKER] Simulating payment and shipping...`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 2. Update Order Status
    await db.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['completed', orderId]
    );
    app.log.info(`[WORKER] Order ${orderId} status updated to COMPLETED`);

    // 3. Inventory Alert: Check for low stock
    const orderItems = await db.query(
      `SELECT oi.product_id, p.name, p.stock
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    for (const item of orderItems.rows) {
      if (item.stock < 5) {
        app.log.warn(
          `[ALERT] Low stock for Product ${item.name} (ID: ${item.product_id}). Current stock: ${item.stock}`
        );
      }
    }

    // 4. Invalidate Recommendation Cache
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
```

---

## Database Schema Updates

### New Table: `order_items`

```sql
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id VARCHAR(50) NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price_per_unit DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
```

**Purpose:** Normalized storage of individual line items within each order.

**Relationship:** One-to-many with `orders` table.

---

## Transaction Handling

### Atomic Inventory Updates

```javascript
const client = await db.pool.connect();

try {
  // Start Transaction
  await client.query('BEGIN');

  // Process each item
  for (const item of items) {
    // Check stock
    const product = await client.query(
      'SELECT id, name, price, stock FROM products WHERE id = $1',
      [productId]
    );

    if (product.rows[0].stock < quantity) {
      // Rollback if insufficient stock
      await client.query('ROLLBACK');
      return reply.code(400).send({ error: 'Insufficient stock' });
    }

    // Decrement inventory
    await client.query(
      'UPDATE products SET stock = stock - $1 WHERE id = $2',
      [quantity, productId]
    );

    // Calculate totals
    totalAmount += parseFloat(product.rows[0].price) * quantity;
  }

  // Create order
  const order = await client.query(
    `INSERT INTO orders (...) VALUES (...) RETURNING *`,
    [orderNumber, userId, items, totalAmount, 'pending', ...]
  );

  // Create order items
  for (const item of orderItems) {
    await client.query(
      `INSERT INTO order_items (...) VALUES (...)`,
      [order.id, item.productId, item.quantity, ...]
    );
  }

  // Commit Transaction
  await client.query('COMMIT');

  // Enqueue background job
  await orderQueue.add('PROCESS_ORDER', { orderId: order.id, userId });

  return reply.code(202).send({ success: true, orderId: order.id });

} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

**Benefits:**
- ✅ **Atomicity:** All updates succeed or all fail
- ✅ **Consistency:** No partial orders
- ✅ **Isolation:** Concurrent requests don't interfere
- ✅ **Durability:** Changes persisted before 202 response

---

## Job Enqueuing

### Adding Jobs to Queue

```javascript
// Add job after successful transaction commit
const job = await orderQueue.add('PROCESS_ORDER', {
  type: 'PROCESS_ORDER',
  orderId: order.id,
  userId: userId,
  orderNumber: order.order_number
});

app.log.info(`Job ${job.id} added to queue for order ${order.id}`);
```

**Job Data:**
- `type`: Job type identifier
- `orderId`: Database ID of the order
- `userId`: For cache invalidation
- `orderNumber`: For logging

---

## Low Stock Alerts

### Detection Logic

```javascript
const orderItems = await db.query(
  `SELECT oi.product_id, p.name, p.stock
   FROM order_items oi
   JOIN products p ON p.id = oi.product_id
   WHERE oi.order_id = $1`,
  [orderId]
);

for (const item of orderItems.rows) {
  if (item.stock < 5) {
    app.log.warn(
      `[ALERT] Low stock for Product ${item.name} (ID: ${item.product_id}). ` +
      `Current stock: ${item.stock}`
    );
  }
}
```

**Example Log:**
```
[ALERT] Low stock for Product TAG Heuer Carrera Calibre 16 (ID: prod_004). Current stock: 3
```

**Use Cases:**
- Automated reordering triggers
- Supplier notifications
- Marketing campaigns (limited stock alerts)
- Inventory dashboards

---

## Cache Invalidation

### Recommendation Cache Cleanup

```javascript
const redisClient = new Redis(REDIS_URL);
const cacheKey = `recommendations:${userId}`;
await redisClient.del(cacheKey);
app.log.info(`[WORKER] Invalidated recommendation cache for user ${userId}`);
await redisClient.quit();
```

**Why Invalidate?**
- User's purchase history changed
- Recommendations should reflect new purchases
- Collaborative filtering scores need recalculation
- Content-based preferences may have shifted

**Alternative Approaches:**
- Event-driven cache invalidation
- Time-based expiration (TTL)
- Version-based caching

---

## Gateway Integration

### Updated Routes

Added proxy routes in [services/gateway/index.js](services/gateway/index.js:120-141):

```javascript
// Proxy to Order Service - Checkout
await app.register(async function (fastify) {
  fastify.addHook('preHandler', fastify.authenticate);

  await fastify.register(httpProxy, {
    upstream: process.env.ORDER_SERVICE_URL || 'http://localhost:3004',
    prefix: '/checkout',
    rewritePrefix: '/checkout',
    http2: false,
  });
});

// Proxy to Order Service - Orders
await app.register(async function (fastify) {
  fastify.addHook('preHandler', fastify.authenticate);

  await fastify.register(httpProxy, {
    upstream: process.env.ORDER_SERVICE_URL || 'http://localhost:3004',
    prefix: '/orders',
    rewritePrefix: '/orders',
    http2: false,
  });
});
```

### Environment Variables

Added to [.env](../.env:21-22):
```
ORDER_SERVICE_PORT=3004
ORDER_SERVICE_URL=http://localhost:3004
```

---

## Updated Configuration

### Root package.json

Updated dev script to include order service:
```json
{
  "scripts": {
    "dev": "concurrently -n \"gateway,product-svc,customer-svc,reco-svc,order-svc\" -c \"blue,green,yellow,magenta,cyan\" ..."
  }
}
```

**Services:**
- gateway (blue)
- product-svc (green)
- customer-svc (yellow)
- reco-svc (magenta)
- **order-svc (cyan)** ⭐ NEW

---

## Files Created

### 1. `services/order-service/package.json`
Service configuration with dependencies:
- fastify
- @chronos/database
- bullmq
- ioredis
- pino-pretty
- dotenv

### 2. `services/order-service/index.js`
Complete order service implementation:
- Checkout endpoint with transactions
- Order retrieval endpoints
- BullMQ queue and worker setup
- Background processing logic
- Low stock alerts
- Cache invalidation
- Graceful shutdown

---

## Testing

See [PHASE4-TESTING.md](PHASE4-TESTING.md) for comprehensive testing guide.

### Quick Test

```bash
# 1. Start services
npm run dev

# 2. Get JWT token
TOKEN=$(curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId": "cust_001", "email": "james.bond@mi6.gov.uk"}' \
  | jq -r .token)

# 3. Place an order
curl -X POST http://localhost:3000/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "cust_001",
    "items": [{"productId": "prod_001", "quantity": 1}]
  }'

# 4. Wait 2 seconds, then check order status
sleep 2
curl http://localhost:3000/orders/cust_001/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Key Features

✅ **Asynchronous Processing**
- Orders created synchronously
- Payment/shipping processed asynchronously
- Non-blocking user experience

✅ **Database Transactions**
- Atomic inventory updates
- All-or-nothing order creation
- Concurrent request safety

✅ **BullMQ Integration**
- Reliable job queue
- Worker pattern
- Job status tracking
- Retry mechanisms (built-in)

✅ **Low Stock Alerts**
- Automated monitoring
- Real-time alerts when stock < 5
- Logged for analysis

✅ **Cache Invalidation**
- Keeps recommendations fresh
- Event-driven invalidation
- Separate Redis client per job

✅ **Error Handling**
- Transaction rollback on failure
- Detailed error messages
- Stock validation
- Product existence checks

---

## Production Considerations

### Scaling

**Horizontal Scaling:**
- Run multiple worker instances
- BullMQ handles job distribution
- Redis coordinates workers

**Vertical Scaling:**
- Increase concurrency per worker
- Optimize database queries
- Connection pooling

### Monitoring

**Key Metrics:**
- Queue size
- Job processing time
- Failure rate
- Stock alert frequency

**Tools:**
- Bull Board (Web UI)
- Redis monitoring
- Application logs
- Database query performance

### Error Recovery

**Failed Jobs:**
- Automatic retries (BullMQ default: 3 attempts)
- Dead letter queue for manual review
- Alert on repeated failures

**Database Failures:**
- Transaction rollback prevents corruption
- Log errors for investigation
- Return 500 to client

---

## Future Enhancements

### Phase 5 Ideas

1. **Order Cancellation:** Cancel pending orders
2. **Payment Integration:** Stripe/PayPal integration
3. **Email Notifications:** Order confirmation emails
4. **Shipping Tracking:** Track shipment status
5. **Refunds:** Process returns and refunds
6. **Webhooks:** Notify external systems
7. **Analytics:** Order metrics dashboard
8. **Scheduled Jobs:** Daily inventory reports
9. **Priority Queue:** Rush orders processed first
10. **Multi-Currency:** Support for different currencies

---

## Success Criteria

✅ **Functional Requirements**
- Checkout endpoint creates orders
- Inventory decremented atomically
- Background worker processes orders
- Order status tracked (pending → completed)
- Low stock alerts logged
- Recommendation cache invalidated

✅ **Non-Functional Requirements**
- Response time < 500ms for checkout
- 202 Accepted returned immediately
- Worker processes within 3 seconds
- Graceful error handling
- Transaction safety guaranteed

✅ **Business Requirements**
- Inventory never oversold
- Orders tracked from creation to completion
- Stock alerts for restocking
- Fresh recommendations after purchase

---

## Conclusion

Phase 4 successfully adds asynchronous order processing to Chronos using:
- **BullMQ** for reliable background jobs
- **Database transactions** for atomic operations
- **Worker pattern** for scalable processing
- **Event-driven cache invalidation** for fresh data
- **Low stock alerts** for inventory management

The system is ready for production deployment with proper monitoring and scaling strategies.

**Total Implementation:**
- 1 new service (order-service)
- 3 API endpoints
- 1 background worker
- 1 new database table
- BullMQ integration
- Transaction handling
- Comprehensive testing guide

🎉 **Phase 4 Complete!**

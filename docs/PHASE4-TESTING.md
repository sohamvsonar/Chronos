# Phase 4 Testing Guide - Asynchronous Order Processing

This guide provides testing instructions for the Order Service with BullMQ background processing.

---

## Prerequisites

1. **Ensure database schema is updated:**
   ```bash
   npm run seed
   ```
   This will create the new `order_items` table.

2. **Ensure Redis is running:**
   ```bash
   # Check if Redis is running
   redis-cli ping
   # Should return: PONG
   ```

3. **Start all services:**
   ```bash
   npm run dev
   ```
   This will start:
   - Gateway (Port 3000)
   - Product Service (Port 3001)
   - Customer Service (Port 3002)
   - Recommendation Service (Port 3003)
   - **Order Service (Port 3004)** ⭐ NEW

4. **Get JWT Token:**
   ```bash
   curl -X POST http://localhost:3000/auth/token \
     -H "Content-Type: application/json" \
     -d '{"userId": "cust_001", "email": "james.bond@mi6.gov.uk"}'
   ```

   **Save the token:**
   ```bash
   # On Windows (PowerShell):
   $TOKEN = "your-jwt-token-here"

   # On macOS/Linux (Bash):
   export TOKEN="your-jwt-token-here"
   ```

---

## Testing Checkout Flow

### 1. Place an Order (Checkout)

**Test: User `cust_001` buys 1 unit of Product `prod_001`:**

```bash
# Windows (PowerShell):
Invoke-RestMethod -Uri "http://localhost:3000/checkout" `
  -Method POST `
  -Headers @{"Authorization" = "Bearer $TOKEN"; "Content-Type" = "application/json"} `
  -Body '{"userId": "cust_001", "items": [{"productId": "prod_001", "quantity": 1}]}'

# macOS/Linux (Bash):
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

**Expected Response (202 Accepted):**
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

**What happens:**
1. ✅ **Synchronous:** Inventory is decremented atomically in a transaction
2. ✅ **Synchronous:** Order is created with status `pending`
3. ✅ **Synchronous:** Order items are saved
4. ✅ **Synchronous:** Job is added to BullMQ queue
5. ✅ **Returns 202:** Request accepted for processing
6. ⏳ **Asynchronous:** Background worker processes the order

---

### 2. Verify Background Processing

**Check the terminal logs for the Order Service** (cyan color in concurrently output):

You should see the following logs:

```
[ORDER-SVC] [WORKER] Processing order 1 for user cust_001
[ORDER-SVC] [WORKER] Simulating payment and shipping...
[ORDER-SVC] [WORKER] Order 1 status updated to COMPLETED
[ORDER-SVC] [WORKER] Invalidated recommendation cache for user cust_001
[ORDER-SVC] [WORKER] Order 1 processing complete
[ORDER-SVC] Job 1 completed successfully
```

**What the worker does:**
1. ✅ **Waits 2 seconds** (simulates payment processing)
2. ✅ **Updates order status** from `pending` to `completed`
3. ✅ **Checks for low stock** on purchased products
4. ✅ **Logs alert** if any product has stock < 5
5. ✅ **Invalidates recommendation cache** for the user

---

### 3. Get Order Status

**Check if the order is now completed:**

```bash
# Windows (PowerShell):
Invoke-RestMethod -Uri "http://localhost:3000/orders/cust_001/1" `
  -Headers @{"Authorization" = "Bearer $TOKEN"}

# macOS/Linux (Bash):
curl http://localhost:3000/orders/cust_001/1 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "order": {
    "id": 1,
    "order_number": "ORD-1733958123456-ABC123XYZ",
    "customer_id": "cust_001",
    "total_amount": 14500,
    "status": "completed",
    "payment_method": "credit_card",
    "created_at": "2025-12-11T...",
    "updated_at": "2025-12-11T...",
    "items": [
      {
        "productId": "prod_001",
        "productName": "Rolex Submariner Date",
        "quantity": 1,
        "pricePerUnit": 14500,
        "totalPrice": 14500
      }
    ]
  }
}
```

**Notice:** Status is now `completed` (was `pending` initially)

---

### 4. Get All Orders for User

**Retrieve all orders for `cust_001`:**

```bash
# Windows (PowerShell):
Invoke-RestMethod -Uri "http://localhost:3000/orders/cust_001" `
  -Headers @{"Authorization" = "Bearer $TOKEN"}

# macOS/Linux (Bash):
curl http://localhost:3000/orders/cust_001 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
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

## Testing Low Stock Alert

### 1. Buy Multiple Items to Trigger Low Stock

**Place an order that will reduce stock below 5:**

```bash
# Example: Buy 10 units of prod_004 (which has 15 in stock)
curl -X POST http://localhost:3000/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "cust_001",
    "items": [
      {
        "productId": "prod_004",
        "quantity": 12
      }
    ]
  }'
```

**Expected Terminal Logs:**
```
[ORDER-SVC] [WORKER] Processing order 2 for user cust_001
[ORDER-SVC] [WORKER] Simulating payment and shipping...
[ORDER-SVC] [WORKER] Order 2 status updated to COMPLETED
[ORDER-SVC] [ALERT] Low stock for Product TAG Heuer Carrera Calibre 16 (ID: prod_004). Current stock: 3
[ORDER-SVC] [WORKER] Invalidated recommendation cache for user cust_001
[ORDER-SVC] [WORKER] Order 2 processing complete
```

**Notice:** The `[ALERT]` message appears because stock is now 3 (< 5)

---

## Testing Multi-Item Order

### Place an Order with Multiple Products

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
      },
      {
        "productId": "prod_002",
        "quantity": 2
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Order created and processing",
  "orderId": 3,
  "orderNumber": "ORD-...",
  "status": "processing",
  "totalAmount": 28100,
  "items": [
    {
      "productId": "prod_001",
      "productName": "Rolex Submariner Date",
      "quantity": 1,
      "pricePerUnit": 14500,
      "totalPrice": 14500
    },
    {
      "productId": "prod_002",
      "productName": "Omega Seamaster Diver 300M",
      "quantity": 2,
      "pricePerUnit": 6800,
      "totalPrice": 13600
    }
  ],
  "jobId": "3"
}
```

**Total:** 14500 + (6800 × 2) = $28,100

---

## Testing Error Cases

### 1. Insufficient Stock

```bash
curl -X POST http://localhost:3000/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "cust_001",
    "items": [
      {
        "productId": "prod_001",
        "quantity": 999
      }
    ]
  }'
```

**Expected Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Insufficient stock for Rolex Submariner Date",
  "details": {
    "productId": "prod_001",
    "productName": "Rolex Submariner Date",
    "requested": 999,
    "available": 3
  }
}
```

**Notice:** Transaction is rolled back, no order created

---

### 2. Invalid Product

```bash
curl -X POST http://localhost:3000/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "cust_001",
    "items": [
      {
        "productId": "prod_999",
        "quantity": 1
      }
    ]
  }'
```

**Expected Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Product prod_999 not found"
}
```

---

### 3. Invalid Quantity

```bash
curl -X POST http://localhost:3000/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "cust_001",
    "items": [
      {
        "productId": "prod_001",
        "quantity": 0
      }
    ]
  }'
```

**Expected Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Invalid item. productId and positive quantity are required."
}
```

---

### 4. Missing Required Fields

```bash
curl -X POST http://localhost:3000/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "cust_001"
  }'
```

**Expected Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Invalid request. userId and items array are required."
}
```

---

## Testing Recommendation Cache Invalidation

### 1. Get Recommendations (Cached)

```bash
curl http://localhost:3000/recommendations/cust_001 \
  -H "Authorization: Bearer $TOKEN"
```

**Response includes recommendations based on old purchase history**

### 2. Place an Order

```bash
curl -X POST http://localhost:3000/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "cust_001",
    "items": [{"productId": "prod_005", "quantity": 1}]
  }'
```

### 3. Wait for Background Worker (2 seconds)

**Check logs:**
```
[ORDER-SVC] [WORKER] Invalidated recommendation cache for user cust_001
```

### 4. Get Recommendations Again (Fresh)

```bash
curl http://localhost:3000/recommendations/cust_001 \
  -H "Authorization: Bearer $TOKEN"
```

**Response now includes NEW recommendations based on updated purchase history**

---

## Direct Service Testing (Bypassing Gateway)

### Health Check

```bash
curl http://localhost:3004/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "service": "order-service",
  "timestamp": "2025-12-11T...",
  "queue": "active"
}
```

### Checkout (No Auth Required)

```bash
curl -X POST http://localhost:3004/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "cust_001",
    "items": [{"productId": "prod_001", "quantity": 1}]
  }'
```

---

## Monitoring BullMQ Queue

### Install BullMQ Board (Optional)

```bash
npm install -g bull-board
bull-board
```

Then visit: `http://localhost:3000/admin/queues`

---

## Understanding the Flow

### Synchronous Part (Checkout Endpoint)

1. **Validate Request:** Check userId and items
2. **Start Transaction:** Begin DB transaction
3. **For Each Item:**
   - Check product exists
   - Check sufficient stock
   - Decrement inventory
   - Calculate totals
4. **Create Order:** Insert order record (status: `pending`)
5. **Create Order Items:** Insert order_items records
6. **Commit Transaction:** All or nothing
7. **Enqueue Job:** Add to BullMQ queue
8. **Return 202:** Accepted for processing

### Asynchronous Part (Background Worker)

1. **Pick Job from Queue:** BullMQ worker receives job
2. **Simulate Payment:** Wait 2 seconds
3. **Update Status:** Change order from `pending` to `completed`
4. **Check Stock:** For each product in order
   - If stock < 5: Log `[ALERT]`
5. **Invalidate Cache:** Delete `recommendations:${userId}` from Redis
6. **Complete Job:** Mark job as successful

---

## Key Features Demonstrated

✅ **Database Transactions:** Atomic inventory updates
✅ **Asynchronous Processing:** Non-blocking order processing
✅ **BullMQ Integration:** Reliable job queue
✅ **Worker Pattern:** Background task execution
✅ **Low Stock Alerts:** Automated inventory monitoring
✅ **Cache Invalidation:** Keep recommendations fresh
✅ **Error Handling:** Rollback on failure
✅ **Status Tracking:** Order lifecycle management

---

## Verification Checklist

- [ ] Order created with `pending` status (synchronous)
- [ ] 202 Accepted response returned immediately
- [ ] Inventory decremented in database
- [ ] Job added to BullMQ queue
- [ ] Worker picks up job (check logs)
- [ ] 2-second delay occurs
- [ ] Order status updated to `completed`
- [ ] Low stock alert logged (if stock < 5)
- [ ] Recommendation cache invalidated
- [ ] Job marked as completed
- [ ] GET /orders shows completed order

---

## Troubleshooting

### Worker Not Processing Jobs

**Check Redis Connection:**
```bash
redis-cli ping
```

**Check Worker Logs:**
Look for `📦 BullMQ Worker listening to 'chronos-jobs' queue` on startup

**Check Queue:**
```bash
redis-cli
> KEYS chronos-jobs*
```

### Order Stuck in Pending

**Check Worker Logs for Errors:**
```
[ORDER-SVC] Job X failed: ...
```

**Manually Complete:**
```sql
UPDATE orders SET status = 'completed' WHERE id = X;
```

### Database Transaction Errors

**Check PostgreSQL Logs:**
```bash
# Ensure no deadlocks or constraint violations
```

**Verify Schema:**
```bash
npm run seed
```

---

## Next Steps

With Phase 4 complete, the Chronos backend now supports:
1. ✅ Asynchronous order processing
2. ✅ Background job execution with BullMQ
3. ✅ Inventory management with transactions
4. ✅ Automated stock alerts
5. ✅ Cache invalidation for fresh recommendations

Consider adding:
- Order cancellation endpoint
- Payment gateway integration
- Email notifications
- Order tracking updates
- Refund processing

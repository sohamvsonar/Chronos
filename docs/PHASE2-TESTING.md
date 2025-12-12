# Phase 2 - Core Business Logic Testing Guide

This document provides step-by-step instructions and curl commands to test all Phase 2 functionality.

## Prerequisites

1. **Seed the database with orders data:**
   ```bash
   npm run seed
   ```

2. **Start all services:**
   ```bash
   npm run dev
   ```

3. **Generate a JWT token for authentication:**
   ```bash
   curl -X POST http://localhost:3000/auth/token \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "test_user",
       "email": "test@example.com"
     }'
   ```

   Save the returned token and export it as an environment variable:
   ```bash
   export TOKEN="your_jwt_token_here"
   ```

   Or on Windows:
   ```cmd
   set TOKEN=your_jwt_token_here
   ```

---

## Product Service Tests

### 1. Get All Products with Pagination

**Basic request (first 10 products):**
```bash
curl -X GET "http://localhost:3000/products?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Get second page:**
```bash
curl -X GET "http://localhost:3000/products?limit=5&offset=5" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 10,
    "hasMore": false
  }
}
```

### 2. Filter Products by Category

**Get sport watches:**
```bash
curl -X GET "http://localhost:3000/products?category=sport" \
  -H "Authorization: Bearer $TOKEN"
```

**Get luxury watches:**
```bash
curl -X GET "http://localhost:3000/products?category=luxury" \
  -H "Authorization: Bearer $TOKEN"
```

**Get dress watches:**
```bash
curl -X GET "http://localhost:3000/products?category=dress" \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Filter by Brand

```bash
curl -X GET "http://localhost:3000/products?brand=Rolex" \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Combined Filters with Pagination

```bash
curl -X GET "http://localhost:3000/products?category=sport&limit=3&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Get Single Product (Test Caching)

**First request (cache MISS):**
```bash
curl -X GET "http://localhost:3000/products/prod_001" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "prod_001",
    "name": "Rolex Submariner Date",
    "brand": "Rolex",
    "price": "14500.00",
    "stock": 3,
    "category": "sport",
    ...
  },
  "cached": false
}
```

**Second request within 60 seconds (cache HIT):**
```bash
curl -X GET "http://localhost:3000/products/prod_001" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {...},
  "cached": true
}
```

### 6. Decrement Inventory (Purchase Simulation)

**Successful purchase:**
```bash
curl -X PATCH "http://localhost:3000/products/prod_001/inventory" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 1
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Inventory updated successfully",
  "data": {
    "product_id": "prod_001",
    "product_name": "Rolex Submariner Date",
    "quantity_purchased": 1,
    "remaining_stock": 2,
    "price_per_unit": "14500.00",
    "total_cost": "14500.00"
  }
}
```

**Verify cache invalidation (should be cache MISS again):**
```bash
curl -X GET "http://localhost:3000/products/prod_001" \
  -H "Authorization: Bearer $TOKEN"
```

**Test insufficient stock:**
```bash
curl -X PATCH "http://localhost:3000/products/prod_010/inventory" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 10
  }'
```

**Expected Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Insufficient stock",
  "details": {
    "requested": 10,
    "available": 1
  }
}
```

---

## Customer Service Tests

### 7. Get Customer with VIP Tier Calculation

**Customer with Gold tier (total_spent > $10,000):**
```bash
curl -X GET "http://localhost:3000/customers/cust_001" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "cust_001",
    "email": "john.smith@email.com",
    "name": "John Smith",
    "tier": "platinum",
    "phone": "+1-555-0101",
    "address": {...},
    "created_at": "2023-01-15T10:00:00.000Z",
    "updated_at": "...",
    "total_spent": 89000,
    "vip_tier": "Gold"
  }
}
```

**Customer with Silver tier (total_spent > $5,000):**
```bash
curl -X GET "http://localhost:3000/customers/cust_002" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "cust_002",
    "email": "sarah.johnson@email.com",
    "name": "Sarah Johnson",
    ...
    "total_spent": 6800,
    "vip_tier": "Silver"
  }
}
```

**Customer with Bronze tier (total_spent <= $5,000):**
```bash
curl -X GET "http://localhost:3000/customers/cust_009" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "cust_009",
    "email": "robert.taylor@email.com",
    "name": "Robert Taylor",
    ...
    "total_spent": 3200,
    "vip_tier": "Bronze"
  }
}
```

### 8. Update Customer Information

**Update customer email and name:**
```bash
curl -X PUT "http://localhost:3000/customers/cust_009" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "robert.taylor.updated@email.com",
    "name": "Robert Taylor Jr."
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Customer updated successfully",
  "data": {
    "id": "cust_009",
    "email": "robert.taylor.updated@email.com",
    "name": "Robert Taylor Jr.",
    ...
  }
}
```

**Verify the update:**
```bash
curl -X GET "http://localhost:3000/customers/cust_009" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Direct Service Access (Without Gateway)

You can also test services directly on their dedicated ports:

### Product Service (Port 3001)

```bash
# No authentication required for direct access
curl -X GET "http://localhost:3001/products?category=sport"

curl -X GET "http://localhost:3001/products/prod_001"

curl -X PATCH "http://localhost:3001/products/prod_001/inventory" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 1}'
```

### Customer Service (Port 3002)

```bash
# No authentication required for direct access
curl -X GET "http://localhost:3002/customers/cust_001"

curl -X PUT "http://localhost:3002/customers/cust_009" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}'
```

---

## Health Checks

**Gateway:**
```bash
curl http://localhost:3000/health
```

**Product Service:**
```bash
curl http://localhost:3001/health
```

**Customer Service:**
```bash
curl http://localhost:3002/health
```

---

## Testing Scenarios

### Scenario 1: Complete Purchase Flow

1. Get product details:
   ```bash
   curl -X GET "http://localhost:3000/products/prod_005" \
     -H "Authorization: Bearer $TOKEN"
   ```

2. Purchase 2 units:
   ```bash
   curl -X PATCH "http://localhost:3000/products/prod_005/inventory" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"quantity": 2}'
   ```

3. Verify updated stock:
   ```bash
   curl -X GET "http://localhost:3000/products/prod_005" \
     -H "Authorization: Bearer $TOKEN"
   ```

### Scenario 2: Customer VIP Tier Analysis

1. Check customer with high spending (Gold):
   ```bash
   curl -X GET "http://localhost:3000/customers/cust_001" \
     -H "Authorization: Bearer $TOKEN"
   ```

2. Check customer with medium spending (Silver):
   ```bash
   curl -X GET "http://localhost:3000/customers/cust_004" \
     -H "Authorization: Bearer $TOKEN"
   ```

3. Check customer with low spending (Bronze):
   ```bash
   curl -X GET "http://localhost:3000/customers/cust_009" \
     -H "Authorization: Bearer $TOKEN"
   ```

### Scenario 3: Pagination and Filtering

1. Get first page of sport watches:
   ```bash
   curl -X GET "http://localhost:3000/products?category=sport&limit=3&offset=0" \
     -H "Authorization: Bearer $TOKEN"
   ```

2. Get next page:
   ```bash
   curl -X GET "http://localhost:3000/products?category=sport&limit=3&offset=3" \
     -H "Authorization: Bearer $TOKEN"
   ```

---

## VIP Tier Calculation Reference

| Total Spent | VIP Tier |
|-------------|----------|
| > $10,000   | Gold     |
| > $5,000    | Silver   |
| ≤ $5,000    | Bronze   |

### Sample Customer Spending:
- **cust_001**: $89,000 → **Gold**
- **cust_002**: $6,800 → **Silver**
- **cust_003**: $14,500 → **Gold**
- **cust_004**: $5,200 → **Silver**
- **cust_005**: $7,800 → **Silver**
- **cust_009**: $3,200 → **Bronze**

---

## Troubleshooting

### Issue: "Unauthorized" errors
**Solution:** Make sure you've generated and exported a valid JWT token.

### Issue: Cache not working
**Solution:** Ensure Redis is running and the `REDIS_URL` is set in `.env`. If Redis is not available, caching will be disabled but services will still work.

### Issue: "Product not found" or "Customer not found"
**Solution:** Run `npm run seed` to populate the database with sample data.

### Issue: Database connection errors
**Solution:** Ensure PostgreSQL is running and the `DATABASE_URL` in `.env` is correct.

---

## Next Steps

After testing Phase 2, you're ready for:
- Phase 3: Order Service Implementation
- Advanced features: webhooks, notifications, analytics
- Performance optimization
- Load testing

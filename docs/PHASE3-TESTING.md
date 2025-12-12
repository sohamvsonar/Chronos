# Phase 3 Testing Guide - Recommendation Engine

This guide provides curl commands to test the Recommendation Engine functionality.

---

## Prerequisites

1. **Start all services:**
   ```bash
   npm run dev
   ```
   This will start:
   - Gateway (Port 3000)
   - Product Service (Port 3001)
   - Customer Service (Port 3002)
   - Recommendation Service (Port 3003)

2. **Get JWT Token:**
   ```bash
   curl -X POST http://localhost:3000/auth/token \
     -H "Content-Type: application/json" \
     -d '{"userId": "cust_001", "email": "james.bond@mi6.gov.uk"}'
   ```

   **Expected Response:**
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "expiresIn": "24h"
   }
   ```

   **Save the token in an environment variable:**
   ```bash
   # On Windows (PowerShell):
   $TOKEN = "your-jwt-token-here"

   # On macOS/Linux (Bash):
   export TOKEN="your-jwt-token-here"
   ```

---

## Testing the Recommendation Engine

### 1. Get Recommendations for User with Purchase History

**Test for user `cust_001` (James Bond) - has purchased luxury watches:**

```bash
# Windows (PowerShell):
curl http://localhost:3000/recommendations/cust_001 `
  -H "Authorization: Bearer $TOKEN"

# macOS/Linux (Bash):
curl http://localhost:3000/recommendations/cust_001 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "user_id": "cust_001",
  "recommendations": [
    {
      "id": "prod_002",
      "name": "Omega Seamaster Diver 300M",
      "brand": "Omega",
      "category": "luxury",
      "price": "6800.00",
      "stock": 7,
      "metadata": {},
      "scores": {
        "content": 0.750,
        "collaborative": 0.820,
        "hybrid": 0.785
      }
    },
    {
      "id": "prod_004",
      "name": "TAG Heuer Carrera Calibre 16",
      "brand": "TAG Heuer",
      "category": "sport",
      "price": "5200.00",
      "stock": 15,
      "metadata": {},
      "scores": {
        "content": 0.600,
        "collaborative": 0.650,
        "hybrid": 0.625
      }
    }
    // ... up to 4 recommendations
  ],
  "count": 4,
  "strategy": "hybrid",
  "weights": {
    "collaborative": 0.5,
    "content": 0.5
  }
}
```

**What this tests:**
- ✅ Hybrid recommendation algorithm
- ✅ Content-based filtering (user prefers luxury/sport watches)
- ✅ Collaborative filtering (users who bought similar items)
- ✅ Score normalization and ranking
- ✅ Default weights (50/50 split)

---

### 2. Get Recommendations for New User (Cold Start)

**Test for user `cust_002` (Ethan Hunt) - has NO purchase history:**

```bash
# Windows (PowerShell):
curl http://localhost:3000/recommendations/cust_002 `
  -H "Authorization: Bearer $TOKEN"

# macOS/Linux (Bash):
curl http://localhost:3000/recommendations/cust_002 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "user_id": "cust_002",
  "recommendations": [
    {
      "id": "prod_001",
      "name": "Rolex Submariner Date",
      "brand": "Rolex",
      "category": "luxury",
      "price": "14500.00",
      "stock": 3,
      "metadata": {},
      "reason": "Top-selling product"
    },
    {
      "id": "prod_003",
      "name": "Patek Philippe Nautilus",
      "brand": "Patek Philippe",
      "category": "luxury",
      "price": "89000.00",
      "stock": 1,
      "metadata": {},
      "reason": "Top-selling product"
    }
    // ... up to 4 top-selling products
  ],
  "count": 4,
  "strategy": "cold-start",
  "weights": null
}
```

**What this tests:**
- ✅ Cold start handling
- ✅ Top-selling products fallback
- ✅ No personalization when no history exists

---

### 3. Configure Recommendation Weights (Favor Content-Based)

**Set weights to favor content-based filtering (80/20 split):**

```bash
# Windows (PowerShell):
curl -X POST http://localhost:3000/recommendations/admin/weights `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{\"collaborative\": 0.2, \"content\": 0.8}'

# macOS/Linux (Bash):
curl -X POST http://localhost:3000/recommendations/admin/weights \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"collaborative": 0.2, "content": 0.8}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Weights updated successfully",
  "weights": {
    "collaborative": 0.2,
    "content": 0.8
  }
}
```

**What this tests:**
- ✅ Admin endpoint for weight configuration
- ✅ Redis persistence of weights
- ✅ Validation (weights must sum to 1.0)

---

### 4. Get Recommendations with Updated Weights

**Now get recommendations again with the new 80/20 split:**

```bash
# Windows (PowerShell):
curl http://localhost:3000/recommendations/cust_001 `
  -H "Authorization: Bearer $TOKEN"

# macOS/Linux (Bash):
curl http://localhost:3000/recommendations/cust_001 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "user_id": "cust_001",
  "recommendations": [
    {
      "id": "prod_002",
      "name": "Omega Seamaster Diver 300M",
      "scores": {
        "content": 0.900,
        "collaborative": 0.650,
        "hybrid": 0.850
      }
    }
    // ... ranked by new hybrid score (0.9 * 0.8 + 0.65 * 0.2)
  ],
  "strategy": "hybrid",
  "weights": {
    "collaborative": 0.2,
    "content": 0.8
  }
}
```

**What this tests:**
- ✅ Weights are applied correctly
- ✅ Hybrid scores recalculated with new weights
- ✅ Content-based signals weighted more heavily

---

### 5. Configure Weights to Favor Collaborative Filtering

**Set weights to favor collaborative filtering (20/80 split):**

```bash
# Windows (PowerShell):
curl -X POST http://localhost:3000/recommendations/admin/weights `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{\"collaborative\": 0.8, \"content\": 0.2}'

# macOS/Linux (Bash):
curl -X POST http://localhost:3000/recommendations/admin/weights \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"collaborative": 0.8, "content": 0.2}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Weights updated successfully",
  "weights": {
    "collaborative": 0.8,
    "content": 0.2
  }
}
```

---

### 6. Get Current Weights

**Check what weights are currently configured:**

```bash
# Windows (PowerShell):
curl http://localhost:3000/recommendations/admin/weights `
  -H "Authorization: Bearer $TOKEN"

# macOS/Linux (Bash):
curl http://localhost:3000/recommendations/admin/weights \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "weights": {
    "collaborative": 0.8,
    "content": 0.2
  }
}
```

---

## Validation Testing

### Invalid Weight Configuration (Doesn't Sum to 1.0)

```bash
# Windows (PowerShell):
curl -X POST http://localhost:3000/recommendations/admin/weights `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{\"collaborative\": 0.3, \"content\": 0.5}'

# macOS/Linux (Bash):
curl -X POST http://localhost:3000/recommendations/admin/weights \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"collaborative": 0.3, "content": 0.5}'
```

**Expected Response (400 Error):**
```json
{
  "success": false,
  "error": "Weights must sum to 1.0 (current sum: 0.8)"
}
```

---

### Invalid Weight Values (Negative)

```bash
# Windows (PowerShell):
curl -X POST http://localhost:3000/recommendations/admin/weights `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{\"collaborative\": -0.2, \"content\": 1.2}'

# macOS/Linux (Bash):
curl -X POST http://localhost:3000/recommendations/admin/weights \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"collaborative": -0.2, "content": 1.2}'
```

**Expected Response (400 Error):**
```json
{
  "success": false,
  "error": "Weights must be between 0 and 1"
}
```

---

### Non-Existent User

```bash
# Windows (PowerShell):
curl http://localhost:3000/recommendations/cust_999 `
  -H "Authorization: Bearer $TOKEN"

# macOS/Linux (Bash):
curl http://localhost:3000/recommendations/cust_999 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (404 Error):**
```json
{
  "success": false,
  "error": "User not found"
}
```

---

## Direct Service Testing (Bypassing Gateway)

You can also test the recommendation service directly on port 3003:

### Health Check

```bash
curl http://localhost:3003/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "service": "recommendation-service",
  "timestamp": "2025-12-11T...",
  "redis": "connected"
}
```

### Get Recommendations (No Auth Required)

```bash
curl http://localhost:3003/recommendations/cust_001
```

---

## Understanding the Recommendation Algorithm

### Content-Based Filtering
1. **Analyzes user's purchase history** to extract preferred attributes:
   - Top brand (e.g., "Rolex")
   - Top category (e.g., "luxury")
2. **Finds similar products** based on attribute matching:
   - Brand + Category match: Score 1.0
   - Brand match only: Score 0.7
   - Category match only: Score 0.6
   - Other: Score 0.3

### Collaborative Filtering
1. **Finds similar users** who bought the same products
2. **Identifies products** those users also purchased
3. **Weights by co-occurrence**:
   - More common products = higher weight
   - More similar users = higher weight

### Hybrid Scoring
1. **Normalizes scores** to 0-1 range for fairness
2. **Applies weights**:
   ```
   hybrid_score = (content_score × content_weight) + (collab_score × collab_weight)
   ```
3. **Ranks and returns** top 4 products by hybrid score

---

## Testing Scenarios

### Scenario 1: New Product Launch
**Goal:** Favor collaborative filtering to surface trending products

```bash
# Set weights to 80% collaborative
curl -X POST http://localhost:3000/recommendations/admin/weights \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"collaborative": 0.8, "content": 0.2}'

# Get recommendations
curl http://localhost:3000/recommendations/cust_001 \
  -H "Authorization: Bearer $TOKEN"
```

### Scenario 2: Personalized Experience
**Goal:** Favor content-based to match user's exact preferences

```bash
# Set weights to 80% content-based
curl -X POST http://localhost:3000/recommendations/admin/weights \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"collaborative": 0.2, "content": 0.8}'

# Get recommendations
curl http://localhost:3000/recommendations/cust_001 \
  -H "Authorization: Bearer $TOKEN"
```

### Scenario 3: Balanced Recommendations
**Goal:** Equal weight to both strategies

```bash
# Reset to default 50/50
curl -X POST http://localhost:3000/recommendations/admin/weights \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"collaborative": 0.5, "content": 0.5}'

# Get recommendations
curl http://localhost:3000/recommendations/cust_001 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Success Criteria

✅ **All endpoints respond correctly**
✅ **Hybrid algorithm returns 4 personalized recommendations**
✅ **Cold start returns top-selling products**
✅ **Weights can be configured and persisted in Redis**
✅ **Scores are normalized and ranked properly**
✅ **Validation prevents invalid weight configurations**
✅ **JWT authentication works through gateway**

---

## Next Steps

With Phase 3 complete, you now have a fully functional recommendation engine! Consider:
1. Adding A/B testing to compare weight configurations
2. Implementing more sophisticated algorithms (matrix factorization, deep learning)
3. Adding real-time event tracking for better personalization
4. Creating a recommendation analytics dashboard

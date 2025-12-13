# Chronos Backend

A microservices-based backend for a luxury watch e-commerce platform built with Node.js, Fastify, PostgreSQL, and Redis.

## Architecture Overview

```
chronos-backend/
├── data/
│   ├── products.json
│   ├── customers.json
│   └── orders.json
├── packages/
│   └── database/
│       ├── package.json
│       ├── index.js          # PostgreSQL client
│       ├── schema.js         # Database schema
│       └── seed.js           # Seeding script
├── services/
│   ├── gateway/              # API Gateway (Port 3000)
│   │   ├── package.json
│   │   └── index.js
│   ├── product-service/      # Product Service (Port 3001)
│   │   ├── package.json
│   │   └── index.js
│   └── customer-service/     # Customer Service (Port 3002)
│       ├── package.json
│       └── index.js
├── .env.example
└── package.json
```

## Key Features

### Hybrid Recommendation Engine
The recommendation service implements a sophisticated hybrid algorithm:

- **Cold Start**: Returns top-selling products for new users with no purchase history
- **Content-Based Filtering**: Analyzes user's order history to identify preferred brands and categories, then scores products by preference match (1.0 = perfect match, 0.2 = no match)
- **Collaborative Filtering**: Finds similar users who bought the same products and recommends what they purchased; falls back to global top-sellers when no similar users exist
- **Hybrid Scoring**: Combines both strategies using configurable weights stored in Redis
  ```
  hybridScore = (content_score × content_weight) + (collab_score × collaborative_weight)
  ```
- **Admin Controls**: Update weights via `POST /recommendations/admin/weights`

### Loyalty & Rewards System
Automated tier-based discounts and reward points:

| Tier     | Discount | Points Multiplier |
|----------|----------|-------------------|
| Platinum | 15%      | 2x                |
| Gold     | 10%      | 1.5x              |
| Silver   | 7.5%     | 1.25x             |
| Bronze   | 5%       | 1x                |

- Tiers calculated automatically based on total spending
- Reward points earned on every purchase
- Discounts applied automatically at checkout

### Wishlist Management
- Add/remove products to personal wishlist
- Unique constraint per customer/product pair
- Full CRUD via gateway endpoints

### API Documentation
- **Swagger UI**: Interactive docs at `http://localhost:3000/docs`
- **OpenAPI Spec**: Available at `/docs/openapi.yaml`
- All endpoints documented with request/response schemas

### Inventory Management
- Real-time stock tracking
- Low-stock alerts when quantity < 3
- Stock validation before checkout
- Cache invalidation on inventory changes

## Services

### API Gateway (Port 3000)
- JWT authentication middleware
- Rate limiting (100 req/min per IP)
- Request proxying to microservices
- Swagger UI hosting

### Product Service (Port 3001)
- Product CRUD operations
- Redis caching (60s TTL)
- Pagination and filtering (brand, category, price range)
- Inventory management

### Customer Service (Port 3002)
- Customer profiles with VIP tier calculation
- Order management and analytics
- Wishlist CRUD operations
- Reward points tracking

### Recommendation Service (Port 3003)
- Hybrid recommendation algorithm
- Configurable content/collaborative weights
- Cold-start handling for new users
- Real-time personalization

## Prerequisites

- **Node.js** >= 18.0.0
- **PostgreSQL** database running
- **Redis**

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

This will install dependencies for all workspaces (root, services, and packages).

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your database credentials:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/chronos
REDIS_URL=redis://localhost:6379
```

### 3. Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE chronos;

# Exit psql
\q
```

### 4. Seed the Database

Run the seeding script to create tables and populate initial data:

```bash
npm run seed
```

This will:
- Drop existing tables (if any)
- Create new tables (products, customers, orders)
- Insert data from `data/products.json`, `data/customers.json`, and `data/orders.json`

### 5. Start Development Servers

Run all services concurrently:

```bash
npm run dev
```

## API Endpoints

### Authentication
```bash
POST /auth/token              # Generate JWT token
```

### Products
```bash
GET  /products                # List products (with filters)
GET  /products/:id            # Get product details
POST /products                # Create product
PUT  /products/:id            # Update product
PATCH /products/:id/inventory # Update stock
```

### Customers
```bash
GET  /customers/:id           # Get customer with tier/points
GET  /customers/:id/orders    # Get order history
PUT  /customers/:id           # Update profile
```

### Orders
```bash
POST /checkout                # Create order (applies discounts)
GET  /orders/:userId          # Get user's orders
```

### Recommendations
```bash
GET  /recommendations/:userId        # Get personalized recommendations
GET  /recommendations/admin/weights  # Get current weights
POST /recommendations/admin/weights  # Update weights
```

### Wishlist
```bash
GET    /wishlist/:customerId           # Get wishlist
POST   /wishlist/:customerId/:productId # Add to wishlist
DELETE /wishlist/:customerId/:productId # Remove from wishlist
```

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/chronos
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
GATEWAY_PORT=3000
PRODUCT_SERVICE_PORT=3001
CUSTOMER_SERVICE_PORT=3002
RECOMMENDATION_SERVICE_PORT=3003
```

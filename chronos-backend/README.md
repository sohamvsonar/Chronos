# Chronos Management Backend

A microservices-based backend system for a luxury watch store built with Node.js, Fastify, PostgreSQL, and Redis.

## Project Structure

```
chronos-backend/
├── data/
│   ├── products.json
│   └── customers.json
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

## Features Implemented

### API Gateway (`services/gateway`)
- **Port:** 3000
- **Features:**
  - Rate Limiting (100 requests per minute)
  - JWT Authentication middleware
  - Proxy routes to microservices
  - Token generation endpoint for testing
- **Routes:**
  - `GET /health` - Health check
  - `POST /auth/token` - Generate JWT token
  - `/products/*` - Proxy to Product Service
  - `/customers/*` - Proxy to Customer Service

### Product Service (`services/product-service`)
- **Port:** 3001
- **Routes:**
  - `GET /health` - Health check
  - `GET /products` - List all products (with filters: brand, category, minPrice, maxPrice)
  - `GET /products/:id` - Get product by ID
  - `POST /products` - Create new product
  - `PUT /products/:id` - Update product
  - `DELETE /products/:id` - Delete product

### Customer Service (`services/customer-service`)
- **Port:** 3002
- **Routes:**
  - `GET /health` - Health check
  - `GET /customers` - List all customers (with filters: tier, email)
  - `GET /customers/:id` - Get customer by ID
  - `GET /customers/:id/orders` - Get customer orders
  - `POST /customers` - Create new customer
  - `PUT /customers/:id` - Update customer
  - `DELETE /customers/:id` - Delete customer

### Shared Database Package (`packages/database`)
- PostgreSQL connection pool
- Schema management with tables:
  - `products` - Product catalog
  - `customers` - Customer information
  - `orders` - Order records
- Seeding functionality from JSON files

## Prerequisites

- **Node.js** >= 18.0.0
- **PostgreSQL** database running
- **Redis** (optional, for distributed rate limiting)

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
- Insert data from `data/products.json` and `data/customers.json`

### 5. Start Development Servers

Run all services concurrently:

```bash
npm run dev
```

This starts:
- **API Gateway** on `http://localhost:3000`
- **Product Service** on `http://localhost:3001`
- **Customer Service** on `http://localhost:3002`

## Testing the API

### 1. Generate an Authentication Token

```bash
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123", "email": "test@example.com"}'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h"
}
```

### 2. Use the Token for Authenticated Requests

```bash
# Get all products
curl http://localhost:3000/products \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Get all customers
curl http://localhost:3000/customers \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Get product by ID
curl http://localhost:3000/products/prod_001 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Filter products by brand
curl "http://localhost:3000/products?brand=Rolex" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Filter customers by tier
curl "http://localhost:3000/customers?tier=platinum" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 3. Direct Service Access (No Auth Required)

You can also access services directly without going through the gateway:

```bash
# Product Service
curl http://localhost:3001/products
curl http://localhost:3001/health

# Customer Service
curl http://localhost:3002/customers
curl http://localhost:3002/health
```

## Architecture Notes

- **No Docker:** All services run locally on different ports as required
- **Monorepo:** Using npm workspaces for dependency management
- **Microservices:** Each service is independent and can be scaled separately
- **Shared Database Package:** Common database logic shared across services
- **API Gateway:** Single entry point with authentication and rate limiting

## Development Tips

- Each service has its own logger with color-coded output
- Services automatically reload when code changes (use nodemon in production)
- The gateway handles all authentication - services trust the gateway
- Rate limiting is per IP address with 100 requests per minute limit

## Testing

Comprehensive test suite for Phase 1 implementation with 44 passing tests covering:
- Gateway service (JWT, rate limiting, authentication)
- Product service (CRUD operations, filtering)
- Customer service (CRUD operations, filtering, orders)

### Run Tests

```bash
# Run all tests with coverage
npm test

# Run tests in watch mode
npm run test:watch

# Run individual service tests
npm run test:gateway
npm run test:products
npm run test:customers
```

For detailed testing documentation, see [TESTING.md](TESTING.md).

## Next Steps

- Implement order service for managing watch purchases
- Add Redis for session management and caching
- Implement BullMQ for background job processing
- Add comprehensive error handling and validation
- Implement API documentation with Swagger/OpenAPI

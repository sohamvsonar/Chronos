# CHRONOS
## Luxury Watch E-Commerce Platform
### Final Project Report

---

**Project Name:** Chronos
**Version:** 1.0
**Date:** December 2025
**Architecture:** Microservices
**Tech Stack:** Node.js, Next.js, PostgreSQL, Redis

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Backend Services](#3-backend-services)
4. [Frontend Application](#4-frontend-application)
5. [Recommendation Engine](#5-recommendation-engine)
6. [Loyalty & Rewards System](#6-loyalty--rewards-system)
7. [Database Design](#7-database-design)
8. [API Reference](#8-api-reference)
9. [Security Features](#9-security-features)
10. [Setup & Deployment](#10-setup--deployment)

---

## 1. Executive Summary

Chronos is a full-stack luxury watch e-commerce platform designed with a microservices architecture. The platform provides a premium shopping experience with personalized recommendations, a loyalty rewards system, and real-time inventory management.

### Key Highlights

| Feature | Description |
|---------|-------------|
| **Hybrid Recommendations** | AI-powered product suggestions using content-based and collaborative filtering |
| **Loyalty Program** | Automated tier-based discounts (Bronze to Platinum) with reward points |
| **Real-time Inventory** | Live stock tracking with low-stock alerts |
| **Wishlist** | Persistent product bookmarking per user |
| **Advanced Discovery** | Search bar with brand/category filters |
| **API Documentation** | Interactive Swagger UI for all endpoints |

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Node.js, Fastify |
| Database | PostgreSQL |
| Cache | Redis |
| Authentication | JWT |
| Documentation | Swagger/OpenAPI |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│                                                                 │
│    ┌─────────────────────────────────────────────────────┐     │
│    │              Next.js Frontend (Port 8080)            │     │
│    │    • Dark Luxury Theme    • User Switcher           │     │
│    │    • Product Catalog      • Recommendations         │     │
│    │    • Wishlist             • Order History           │     │
│    └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API GATEWAY                              │
│                                                                 │
│    ┌─────────────────────────────────────────────────────┐     │
│    │              Gateway Service (Port 3000)             │     │
│    │    • JWT Authentication   • Rate Limiting (100/min) │     │
│    │    • Request Routing      • Swagger UI (/docs)      │     │
│    └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Product     │     │   Customer    │     │Recommendation │
│   Service     │     │   Service     │     │   Service     │
│  (Port 3001)  │     │  (Port 3002)  │     │  (Port 3003)  │
├───────────────┤     ├───────────────┤     ├───────────────┤
│ • CRUD Ops    │     │ • Profiles    │     │ • Content-    │
│ • Inventory   │     │ • Orders      │     │   Based       │
│ • Caching     │     │ • Wishlist    │     │ • Collabora-  │
│ • Filtering   │     │ • Loyalty     │     │   tive        │
└───────────────┘     └───────────────┘     └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                               │
│                                                                 │
│    ┌────────────────────┐     ┌────────────────────┐           │
│    │    PostgreSQL      │     │       Redis        │           │
│    │    • products      │     │  • Product Cache   │           │
│    │    • customers     │     │  • Rate Limits     │           │
│    │    • orders        │     │  • Config Weights  │           │
│    │    • wishlist      │     │                    │           │
│    └────────────────────┘     └────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Service Communication

| From | To | Method | Purpose |
|------|-----|--------|---------|
| Frontend | Gateway | HTTP/REST | All API requests |
| Gateway | Product Service | HTTP Proxy | Product operations |
| Gateway | Customer Service | HTTP Proxy | Customer/Order operations |
| Gateway | Recommendation Service | HTTP Proxy | Personalized suggestions |
| Services | PostgreSQL | TCP | Data persistence |
| Services | Redis | TCP | Caching & configuration |

---

## 3. Backend Services

### 3.1 API Gateway (Port 3000)

The central entry point for all client requests.

**Responsibilities:**
- JWT token generation and validation
- Request rate limiting (100 requests/minute per IP)
- Request routing to appropriate microservices
- Swagger UI documentation hosting

**Key Endpoints:**
```
POST /auth/token              Generate authentication token
GET  /health                  Service health check
GET  /docs                    Swagger UI documentation
/*                            Proxy to microservices
```

### 3.2 Product Service (Port 3001)

Manages the product catalog and inventory.

**Features:**
- Full CRUD operations for products
- Redis caching with 60-second TTL
- Pagination support (limit/offset)
- Advanced filtering (brand, category, price range)
- Real-time inventory management
- Cache invalidation on updates

**Key Endpoints:**
```
GET    /products              List products with filters
GET    /products/:id          Get product details (cached)
POST   /products              Create new product
PUT    /products/:id          Update product
DELETE /products/:id          Delete product
PATCH  /products/:id/inventory  Update stock quantity
```

**Product Schema:**
```json
{
  "id": "prod_001",
  "name": "Submariner Date",
  "brand": "Rolex",
  "category": "dive",
  "price": 14500.00,
  "stock": 5,
  "metadata": {
    "movement": "automatic",
    "case_size": "41mm",
    "water_resistance": "300m"
  }
}
```

### 3.3 Customer Service (Port 3002)

Handles customer profiles, orders, and loyalty.

**Features:**
- Customer profile management
- Order creation and history
- Wishlist CRUD operations
- VIP tier calculation
- Reward points tracking
- Loyalty discount application

**Key Endpoints:**
```
GET    /customers/:id                    Get customer with tier/points
PUT    /customers/:id                    Update profile
GET    /customers/:id/orders             Order history
POST   /checkout                         Create order with discounts
GET    /orders/:userId                   Get user orders
GET    /wishlist/:customerId             Get wishlist
POST   /wishlist/:customerId/:productId  Add to wishlist
DELETE /wishlist/:customerId/:productId  Remove from wishlist
```

### 3.4 Recommendation Service (Port 3003)

AI-powered personalized product recommendations.

**Features:**
- Hybrid recommendation algorithm
- Cold-start handling for new users
- Configurable algorithm weights
- Real-time personalization

**Key Endpoints:**
```
GET  /recommendations/:userId         Get 4 personalized recommendations
GET  /recommendations/admin/weights   Get current weights
POST /recommendations/admin/weights   Update weights (must sum to 1.0)
```

---

## 4. Frontend Application

### 4.1 Design System

**Theme:** Dark Luxury
```css
Background:     #0a0a0a (Near Black)
Surface:        #111111 (Dark Gray)
Border:         #2a2a2a (Subtle Gray)
Primary:        #d4af37 (Gold)
Primary Hover:  #f4d03f (Bright Gold)
Text Primary:   #ffffff (White)
Text Secondary: #808080 (Gray)
Text Muted:     #666666 (Dark Gray)
```

### 4.2 Pages & Components

| Page | Route | Description |
|------|-------|-------------|
| Homepage | `/` | Hero, recommendations, full catalog with filters |
| Product Detail | `/products/[id]` | Full product info, buy now, stock status |
| Orders | `/orders` | Purchase history with status badges |
| Wishlist | `/wishlist` | Saved products with quick actions |

**Key Components:**
- `Navbar` - Navigation with user switcher dropdown
- `ProductCard` - Grid display with badges (Limited, Exclusive)
- `SearchBar` - Real-time search input
- `FilterDropdown` - Brand and category filters
- `ToastNotification` - Action feedback system

### 4.3 Features

**Advanced Discovery:**
- Real-time search across product names and brands
- Brand filter dropdown (dynamically populated)
- Category filter dropdown (Sport, Luxury, Dress, Dive, etc.)
- Filter count display ("X of Y products")
- Clear filters button

**Personalized Recommendations:**
- "Curated For You" section for users with history
- "Trending Now" for new users (cold start)
- Exclusive badges on recommended products
- Real-time updates when switching users

**Loyalty Display:**
- Tier badge in user dropdown
- Strike-through original price with discounted price
- Reward points display and updates after checkout

**Real-time Updates:**
- Optimistic UI updates on checkout
- Stock quantity updates immediately
- Toast notifications for all actions

---

## 5. Recommendation Engine

### 5.1 Algorithm Overview

The recommendation engine uses a **hybrid approach** combining two strategies:

```
┌─────────────────────────────────────────────────────────────┐
│                    RECOMMENDATION FLOW                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Has Purchase   │
                    │    History?     │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │ NO                          │ YES
              ▼                             ▼
    ┌─────────────────┐         ┌─────────────────────────┐
    │   COLD START    │         │    HYBRID STRATEGY      │
    │                 │         │                         │
    │  Return top 4   │         │  ┌─────────────────┐   │
    │  best-selling   │         │  │ Content-Based   │   │
    │  products       │         │  │ (User Prefs)    │   │
    └─────────────────┘         │  └────────┬────────┘   │
                                │           │            │
                                │  ┌────────┴────────┐   │
                                │  │                 │   │
                                │  │  Combine with   │   │
                                │  │    Weights      │   │
                                │  │                 │   │
                                │  └────────┬────────┘   │
                                │           │            │
                                │  ┌────────┴────────┐   │
                                │  │ Collaborative   │   │
                                │  │ (Similar Users) │   │
                                │  └─────────────────┘   │
                                └─────────────────────────┘
```

### 5.2 Content-Based Filtering

Analyzes the user's purchase history to identify preferences.

**Process:**
1. Retrieve all products the user has purchased
2. Count occurrences of each brand and category
3. Identify top 2 preferred brands and categories
4. Score all unpurchased products:

| Match Type | Score |
|------------|-------|
| Top brand + Top category | 1.0 |
| Top brand + Second category | 0.9 |
| Second brand + Top category | 0.85 |
| Top brand only | 0.7 |
| Second brand only | 0.6 |
| Top category only | 0.5 |
| Second category only | 0.4 |
| No match | 0.2 |

### 5.3 Collaborative Filtering

Finds users with similar purchase patterns and recommends what they bought.

**Process:**
1. Find all products the target user has purchased
2. Identify "similar users" who bought the same products
3. Calculate similarity score (count of common products)
4. Find products similar users bought that target hasn't
5. Weight recommendations by purchase frequency × similarity

**Fallback:** When no similar users exist, returns top-selling products globally.

### 5.4 Hybrid Scoring

Combines both strategies using configurable weights:

```
hybridScore = (content_score × content_weight) + (collab_score × collaborative_weight)
```

**Default Weights:**
```json
{
  "content": 0.5,
  "collaborative": 0.5
}
```

**Weight Configuration:**
```bash
# Get current weights
GET /recommendations/admin/weights

# Update weights (must sum to 1.0)
POST /recommendations/admin/weights
{
  "content": 0.7,
  "collaborative": 0.3
}
```

### 5.5 Response Format

```json
{
  "success": true,
  "user_id": "cust_001",
  "recommendations": [
    {
      "id": "prod_005",
      "name": "Speedmaster Professional",
      "brand": "Omega",
      "category": "sport",
      "price": 6350.00,
      "stock": 8,
      "scores": {
        "content": 0.850,
        "collaborative": 0.720,
        "hybrid": 0.785
      }
    }
  ],
  "count": 4,
  "strategy": "hybrid",
  "weights": {
    "content": 0.5,
    "collaborative": 0.5
  }
}
```

---

## 6. Loyalty & Rewards System

### 6.1 Tier Structure

Tiers are calculated automatically based on total customer spending:

| Tier | Spending Threshold | Discount | Points Multiplier |
|------|-------------------|----------|-------------------|
| Platinum | > $50,000 | 15% | 2.0x |
| Gold | > $10,000 | 10% | 1.5x |
| Silver | > $5,000 | 7.5% | 1.25x |
| Bronze | ≤ $5,000 | 5% | 1.0x |

### 6.2 Reward Points

- **Earning:** 1 point per $1 spent (multiplied by tier)
- **Display:** Real-time points balance in user profile
- **Updates:** Points added immediately after checkout

### 6.3 Discount Application

Discounts are applied automatically at checkout:

```
Original Price:     $10,000
Gold Tier Discount: -$1,000 (10%)
─────────────────────────────
Final Price:        $9,000
Points Earned:      +150 (100 × 1.5x)
```

### 6.4 Frontend Display

- Strike-through original price
- Discounted price highlighted in gold
- Tier badge next to username
- Points balance in profile

---

## 7. Database Design

### 7.1 Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐
│    products     │       │    customers    │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ name            │       │ name            │
│ brand           │       │ email           │
│ category        │       │ phone           │
│ price           │       │ address (JSONB) │
│ stock           │       │ tier            │
│ metadata (JSONB)│       │ reward_points   │
│ created_at      │       │ created_at      │
│ updated_at      │       │ updated_at      │
└─────────────────┘       └────────┬────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
           ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
           │   orders    │ │  wishlist   │ │   (calc)    │
           ├─────────────┤ ├─────────────┤ │ total_spent │
           │ id (PK)     │ │ id (PK)     │ │ vip_tier    │
           │ order_number│ │ customer_id │ └─────────────┘
           │ customer_id │ │ product_id  │
           │ items(JSONB)│ │ created_at  │
           │ total_amount│ └─────────────┘
           │ status      │
           │ payment_meth│
           │ created_at  │
           └─────────────┘
```

### 7.2 Table Definitions

**products**
```sql
CREATE TABLE products (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  price DECIMAL(10,2) NOT NULL,
  stock INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**customers**
```sql
CREATE TABLE customers (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  address JSONB,
  tier VARCHAR(20) DEFAULT 'bronze',
  reward_points INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**orders**
```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id VARCHAR(50) REFERENCES customers(id),
  items JSONB NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**wishlist**
```sql
CREATE TABLE wishlist (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(50) REFERENCES customers(id),
  product_id VARCHAR(50) REFERENCES products(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id, product_id)
);
```

---

## 8. API Reference

### 8.1 Authentication

All API requests (except `/auth/token` and `/health`) require JWT authentication.

**Generate Token:**
```bash
POST /auth/token
Content-Type: application/json

{
  "userId": "cust_001",
  "email": "james@example.com"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "24h"
}
```

**Using Token:**
```bash
Authorization: Bearer <token>
```

### 8.2 Products API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products` | List all products |
| GET | `/products?brand=Rolex` | Filter by brand |
| GET | `/products?category=sport` | Filter by category |
| GET | `/products?minPrice=5000&maxPrice=15000` | Filter by price |
| GET | `/products?limit=10&offset=0` | Pagination |
| GET | `/products/:id` | Get single product |
| POST | `/products` | Create product |
| PUT | `/products/:id` | Update product |
| DELETE | `/products/:id` | Delete product |
| PATCH | `/products/:id/inventory` | Update stock |

### 8.3 Customers API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/customers` | List all customers |
| GET | `/customers/:id` | Get customer with tier |
| PUT | `/customers/:id` | Update customer |
| GET | `/customers/:id/orders` | Get order history |

### 8.4 Orders API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/checkout` | Create new order |
| GET | `/orders/:userId` | Get user's orders |

**Checkout Request:**
```json
{
  "customerId": "cust_001",
  "productId": "prod_001",
  "quantity": 1,
  "paymentMethod": "credit_card"
}
```

### 8.5 Recommendations API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/recommendations/:userId` | Get 4 recommendations |
| GET | `/recommendations/admin/weights` | Get current weights |
| POST | `/recommendations/admin/weights` | Update weights |

### 8.6 Wishlist API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/wishlist/:customerId` | Get user's wishlist |
| POST | `/wishlist/:customerId/:productId` | Add to wishlist |
| DELETE | `/wishlist/:customerId/:productId` | Remove from wishlist |

---

## 9. Security Features

### 9.1 Authentication
- JWT tokens with 24-hour expiration
- HS256 signing algorithm
- Token required for all protected endpoints

### 9.2 Rate Limiting
- 100 requests per minute per IP address
- Implemented at gateway level
- Returns 429 Too Many Requests when exceeded

### 9.3 Input Validation
- Request body validation on all endpoints
- SQL injection prevention via parameterized queries
- XSS prevention in frontend rendering

### 9.4 Data Protection
- Passwords not stored (demo uses token-based auth)
- Sensitive data not logged
- CORS configured for frontend origin

---

## 10. Setup & Deployment

### 10.1 Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14
- Redis >= 6

### 10.2 Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/chronos

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-key

# Service Ports
GATEWAY_PORT=3000
PRODUCT_SERVICE_PORT=3001
CUSTOMER_SERVICE_PORT=3002
RECOMMENDATION_SERVICE_PORT=3003
```

### 10.3 Installation Steps

```bash
# 1. Clone repository
git clone https://github.com/sohamvsonar/Chronos
cd Chronos

# 2. Install backend dependencies
cd chronos-backend
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 4. Create database
psql -U postgres -c "CREATE DATABASE chronos;"

# 5. Seed database
npm run seed

# 6. Start backend services
npm run dev

# 7. Install frontend dependencies (new terminal)
cd ../chronos-frontend
npm install

# 8. Start frontend
npm run dev
```

### 10.4 Accessing the Application

| Service | URL |
|---------|-----|
| Frontend | http://localhost:8080 |
| API Gateway | http://localhost:3000 |
| Swagger Docs | http://localhost:3000/docs |
| Product Service | http://localhost:3001 |
| Customer Service | http://localhost:3002 |
| Recommendation Service | http://localhost:3003 |

### 10.5 Test Users

| Name | Customer ID | Has History | Tier |
|------|-------------|-------------|------|
| James Bond | cust_001 | Yes | Gold |
| Alice Johnson | cust_002 | Yes | Silver |
| Guest | - | No | - |

---

## Appendix A: File Structure

```
Chronos/
├── chronos-backend/
│   ├── data/
│   │   ├── products.json
│   │   ├── customers.json
│   │   └── orders.json
│   ├── packages/
│   │   └── database/
│   │       ├── index.js
│   │       ├── schema.js
│   │       └── seed.js
│   ├── services/
│   │   ├── gateway/
│   │   │   └── index.js
│   │   ├── product-service/
│   │   │   └── index.js
│   │   ├── customer-service/
│   │   │   └── index.js
│   │   └── recommendation-service/
│   │       └── index.js
│   ├── package.json
│   └── README.md
│
├── chronos-frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── products/[id]/page.tsx
│   │   ├── orders/page.tsx
│   │   └── wishlist/page.tsx
│   ├── components/
│   │   ├── Navbar.tsx
│   │   └── ProductCard.tsx
│   ├── contexts/
│   │   ├── UserContext.tsx
│   │   └── ToastContext.tsx
│   ├── lib/
│   │   └── api.ts
│   ├── package.json
│   └── README.md
│
└── CHRONOS_PROJECT_REPORT.md
```

---

## Appendix B: API Response Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET/PUT/PATCH |
| 201 | Created | Successful POST |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing/invalid token |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate entry |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal error |

---

**End of Report**


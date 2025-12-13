# 🕰️ Chronos - Luxury Watch E-Commerce Platform

> Full Stack Application for **Chronos**, a luxury Swiss watch store. Microservices backend, personalized recommendations, loyalty rewards, wishlist, and a modern Next.js frontend with Swagger-documented APIs.

![Status](https://img.shields.io/badge/Status-Active-success?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-Next.js_Node_Fastify_Postgres_Redis_BullMQ-blue?style=flat-square)

## 🏗️ Architecture

This project uses a **Monorepo** structure with a microservices backend and a Next.js frontend. Services run as parallel Node.js processes on distinct ports.

### Backend Services
* **Gateway (Port 3000):** API Gateway with Swagger UI (`/docs`), JWT auth, rate limiting, and proxying
* **Product Service (Port 3001):** Catalog, inventory, Redis caching; low-stock alert threshold `<3`
* **Customer Service (Port 3002):** Profiles, analytics, wishlist CRUD, reward points/tier data
* **Recommendation Service (Port 3003):** Hybrid recommendation engine (collaborative + content-based filtering)
* **Order Service (Port 3004):** Checkout with loyalty discounts (Platinum 15%, Gold 10%, Silver 7.5%, Bronze 5%), reward points accrual, BullMQ async processing
* **Shared Packages:** Centralized database logic to prevent code duplication

### Frontend
* **Next.js App (Port 8080):** Modern React-based UI with TypeScript and Tailwind CSS

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v18+)
* **PostgreSQL** (Port 5432)
* **Redis** (Port 6379)

### Quick Start

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/sohamvsonar/Chronos.git
    cd Chronos
    ```

2.  **Install all dependencies:**
    ```bash
    # Backend
    cd chronos-backend
    npm install

    # Frontend
    cd ../chronos-frontend
    npm install

    # Or use root script
    cd ..
    npm run install:all
    ```

3.  **Environment Setup:**
    Create a `.env` file in `chronos-backend`:
    ```env
    DATABASE_URL="postgresql://user:password@localhost:5432/chronos"
    REDIS_URL="redis://localhost:6379"
    JWT_SECRET="supersecret_chronos_key"
    ```

4.  **Seed the Database:**
    ```bash
    cd chronos-backend
    psql -U postgres -c "CREATE DATABASE chronos;"
    npm run seed
    ```

5.  **Run the Full Stack:**
    ```bash
    # From root directory
    npm run dev
    ```

    This starts:
    - All backend services (Ports 3000-3004)
    - Frontend (Port 8080)
    - Swagger UI at http://localhost:3000/docs

6.  **Access the Application:**
    - Frontend: [http://localhost:8080](http://localhost:8080)
    - API Gateway: [http://localhost:3000](http://localhost:3000)

## ✅ Implementation Status

| Phase | Feature | Status | Description |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Infrastructure** | ✅ Complete | Gateway, Product/Customer services, Shared DB package |
| **Phase 2** | **Core Logic** | ✅ Complete | Inventory management, Redis caching, VIP tier calculation |
| **Phase 3** | **Recommendations** | ✅ Complete | Hybrid recommendation engine (collaborative + content-based) |
| **Phase 4** | **Async Processing** | ✅ Complete | Order service with BullMQ, background jobs, stock alerts |
| **Phase 5** | **Frontend** | ✅ Complete | Next.js app with user simulation, product catalog, checkout |

## 🔌 API Reference

All requests go through the API Gateway (Port 3000).

### Products
* `GET /products` - List all products (pagination, filtering)
* `GET /products/:id` - Get product details (Redis cached)
* `PATCH /products/:id/inventory` - Decrement inventory atomically

### Customers
* `GET /customers/:id` - Get customer profile with VIP tier
* `PUT /customers/:id` - Update customer details
* `GET /customers/:id/orders` - Get customer order history

### Recommendations
* `GET /recommendations/:userId` - Get personalized recommendations
* `POST /recommendations/admin/weights` - Update algorithm weights
* `GET /recommendations/admin/weights` - Get current weights

### Orders
* `POST /checkout` - Create order (asynchronous processing)
* `GET /orders/:userId` - Get all orders for user
* `GET /orders/:userId/:orderId` - Get specific order

### Authentication
* `POST /auth/token` - Generate JWT token (dev only)

## 🎨 Frontend Features

### User Experience
* **User Switcher**: Toggle between James Bond, Alice Johnson, or Guest mode
* **Personalized Homepage**: "For You" section with hybrid recommendations
* **Product Catalog**: Browse all luxury watches with live stock indicators
* **Product Details**: Full product information with Buy Now functionality
* **Toast Notifications**: Real-time feedback for orders and errors
* **Responsive Design**: Mobile-first Tailwind CSS styling

### Smart Features
* **Cold Start Detection**: Shows "Trending Now" for users without purchase history
* **Real-time Updates**: Product stock updates after each purchase
* **Error Handling**: Graceful handling of insufficient stock scenarios
* **Loading States**: Skeleton screens for better UX

## 🧪 Testing

### Frontend Testing
1. Visit [http://localhost:8080](http://localhost:8080)
2. Use the user switcher to select different users
3. Browse personalized recommendations
4. Click a product to view details
5. Click "Buy Now" to place an order
6. Watch toast notification confirm your order

### Backend Testing
See `chronos-backend/PHASE*.md` files for comprehensive testing guides.

**Quick Test:**
```bash
# Get recommendations
curl http://localhost:3000/recommendations/cust_001

# Place an order
curl -X POST http://localhost:3000/checkout \
  -H "Content-Type: application/json" \
  -d '{"userId": "cust_001", "items": [{"productId": "prod_001", "quantity": 1}]}'
```


## 📁 Project Structure

```
Chronos/
├── chronos-backend/          # Backend microservices
│   ├── data/
│   │   ├── products.json
│   │   ├── customers.json
│   │   └── orders.json
│   ├── packages/
│   │   └── database/         # Shared database package
│   ├── services/
│   │   ├── gateway/          # API Gateway (Port 3000)
│   │   ├── product-service/  # Products (Port 3001)
│   │   ├── customer-service/ # Customers (Port 3002)
│   │   ├── recommendation-service/  # Recommendations (Port 3003)
│   │   └── order-service/    # Orders (Port 3004)
│   ├── PHASE*.md             # Documentation
│   └── package.json
│
├── chronos-frontend/         # Next.js frontend
│   ├── app/                  # App Router pages
│   │   ├── products/[id]/    # Product detail page
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Homepage
│   │   └── globals.css
│   ├── components/           # React components
│   │   └── Navbar.tsx
│   ├── contexts/             # React contexts
│   │   ├── UserContext.tsx
│   │   └── ToastContext.tsx
│   ├── lib/
│   │   └── api.ts            # API client
│   └── package.json
│
├── package.json              # Root workspace
└── README.md
```

## 🧪 Test Coverage

All services include comprehensive Jest tests:

| Service | Tests | Coverage |
| :--- | :--- | :--- |
| Gateway | 11 tests | JWT auth, rate limiting |
| Product Service | 29 tests | CRUD, pagination, inventory |
| Customer Service | 42 tests | VIP tiers, analytics |
| Recommendation Service | 14 tests | Hybrid algorithm, weights |
| Order Service | 15 tests | Checkout, async jobs |
| **Total** | **111 tests** | **All passing** ✅ |

Run tests:
```bash
cd chronos-backend
npm test
```

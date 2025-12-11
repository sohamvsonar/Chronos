# 🕰️ Chronos Management Backend

> **Work Trial Project** | Dec 10 - Dec 12, 2025
>
> A bespoke microservices backend for **Chronos**, a luxury Swiss watch store. This system manages products, customers, and orders, featuring a high-performance "For You" recommendation engine.

![Status Phase 2](https://img.shields.io/badge/Status-Phase_2_Complete-success?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-Node_Fastify_Postgres_Redis-blue?style=flat-square)

## 🏗️ Architecture

This project uses a **Monorepo** structure to simulate a distributed microservices environment without the complexity of container orchestration (Docker). Services run as parallel Node.js processes on distinct ports, unified by an API Gateway.

* **Gateway (Port 3000):** The single entry point. Handles routing (Proxy), rate limiting, and authentication.
* **Product Service (Port 3001):** Manages catalog, inventory transactions, and Redis caching.
* **Customer Service (Port 3002):** Manages profiles, real-time analytics, and dynamic VIP tier calculation.
* **Shared Packages:** Centralized database logic (`packages/database`) to prevent code duplication across services.

## 🚀 Getting Started

### Prerequisites
Since Docker is not used in this environment, ensure you have the following running locally:
* **Node.js** (v18+)
* **PostgreSQL** (Port 5432)
* **Redis** (Port 6379)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/sohamvsonar/Chronos.git
    cd chronos-backend
    ```

2.  **Install dependencies (Workspaces):**
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    Create a `.env` file in the root directory:
    ```env
    DATABASE_URL="postgresql://user:password@localhost:5432/chronos"
    REDIS_URL="redis://localhost:6379"
    JWT_SECRET="supersecret_chronos_key"
    ```

4.  **Seed the Database:**
    Populate Postgres with the provided `products.json`, `customers.json`, and simulated `orders.json`.
    ```bash
    npm run seed
    ```

5.  **Run the System:**
    Start the Gateway and all Microservices simultaneously using `concurrently`.
    ```bash
    npm run dev
    ```

## ✅ Implementation Status

| Phase | Feature | Status | Description |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Infrastructure** | ✅ Done | Monorepo setup, API Gateway configuration, Shared DB logic. |
| **Phase 2** | **Core Logic** | ✅ Done | Inventory control (atomic decrements), Redis caching strategy, Dynamic VIP Tier calculation. |
| **Phase 3** | **"For You" Engine** | 🚧 Pending | Collaborative filtering & personalized recommendations. |
| **Phase 4** | **Async Jobs** | 🚧 Pending | BullMQ integration for background tasks and alerts. |

## 🔌 API Reference

The Gateway (Port 3000) proxies requests to the underlying services.

### Product Endpoints
* `GET /products` - List all watches (supports pagination `?limit=10` & filtering).
* `GET /products/:id` - Get details (Cached via Redis for performance).
* `PATCH /products/:id/inventory` - Decrement stock safely (Invalidates cache on success).

### Customer Endpoints
* `GET /customers/:id` - Get profile with dynamic **VIP Tier** (Gold/Silver/Bronze) calculated from total spend.
* `PUT /customers/:id` - Update profile details.

## 🧪 Testing Logic

I have included `curl` commands to verify the core business logic.

**Test 1: Check VIP Tier Calculation**
*The system calculates `total_spent` on the fly. If > $10,000, returns "Gold".*
```bash
curl http://localhost:3000/customers/cust_001

**Test 2: Buy a Watch (Decrement Stock)**
*Decrements inventory by 1. If you run this enough times to deplete stock, it will return 400 Bad Request.*
```bash
curl -X PATCH http://localhost:3000/products/prod_001/inventory \
  -H "Content-Type: application/json" \
  -d '{"quantity": 1}'
```


## Project Structure

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
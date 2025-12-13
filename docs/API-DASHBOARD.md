# Chronos API Dashboard & Docs

Interactive docs are now available via Swagger UI, backed by a consolidated OpenAPI spec that covers the gateway and downstream services.

- Swagger UI: `http://localhost:3000/docs`
- Raw OpenAPI spec: `chronos-backend/services/gateway/openapi.yaml` (also served at `http://localhost:3000/docs/openapi.yaml`)
- Gateway base URL: `http://localhost:3000`

## How to run

1) Install deps if needed (root of repo): `npm install` then `npm run install:all`  
2) Start the gateway only: `npm run dev -w services/gateway` (or `npm run dev` to start all services).  
3) Open `http://localhost:3000/docs` in the browser.

## Authentication

- Most routes require a bearer token. Use `POST /auth/token` in Swagger (“Try it out”) to mint a 24h JWT for testing.  
- Click **Authorize** in Swagger and paste `Bearer <token>`.  
- Public routes: `/health`, `/auth/token`.

## What’s documented

- Products: list/filter, get by id, create/update/delete, inventory decrement.
- Customers: list/filter, get with VIP tier, create/update/delete, fetch customer orders.
- Orders: checkout (async with BullMQ), loyalty discounts (platinum 15%, gold 10%, silver 7.5%, bronze 5%), reward points accrual, list user orders, get order details.
- Recommendations: personalized and cold-start, admin weight tuning.
- Gateway/infra: health, auth, rate limiting (100 req/min, Redis-backed when configured).
- Wishlist: add/remove products, fetch a user’s wishlist (returns product details + added date).

## Quick payload references

- Product create:  
  ```json
  {
    "id": "w-2000",
    "name": "Chronos Diver",
    "brand": "Chronos",
    "price": 4999.5,
    "stock": 25,
    "category": "sports",
    "metadata": { "waterResistance": "200m", "strap": "rubber" }
  }
  ```
- Checkout:  
  ```json
  {
    "userId": "user-123",
    "items": [
      { "productId": "w-1000", "quantity": 1 },
      { "productId": "w-2000", "quantity": 2 }
    ]
  }
  ```
- Loyalty discounts (applied automatically by tier): platinum 15%, gold 10%, silver 7.5%, bronze 5%. Reward points accrue on the post-discount total.
- Recommendation weights:  
  ```json
  { "collaborative": 0.6, "content": 0.4 }
  ```
- Wishlist add:  
  ```json
  { "productId": "w-1000" }
  ```

## Suggested flows to validate

1) **Catalog & cache**: GET `/products` → GET `/products/{id}` twice to see `cached: true` on second hit.  
2) **Checkout**: POST `/checkout` with two line items → GET `/orders/{userId}` for status → verify queue log in console.  
3) **Recommendations**: GET `/recommendations/{userId}` before and after a checkout to see strategy change from `cold-start` to `hybrid`.  
4) **Weights tuning**: POST `/recommendations/admin/weights` then re-run recommendations to confirm new weights.  
5) **Customer insights**: GET `/customers/{id}` to view `vip_tier` and `total_spent`.
6) **Wishlist**: POST `/customers/{id}/wishlist` with `productId`, GET `/customers/{id}/wishlist` to confirm, DELETE `/customers/{id}/wishlist/{productId}` to remove.

## Notes

- Gateway proxies to the services with auth enforced per prefix (`/products`, `/customers`, `/recommendations`, `/checkout`, `/orders`).  
- Redis (if `REDIS_URL` set) is used for rate limiting, product cache, and recommendation weight storage.  
- The OpenAPI spec is static and lives alongside the gateway for easy handoff to tooling (postman, codegen, etc.).

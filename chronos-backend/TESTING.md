# Testing Documentation

This document describes the test suite for the Chronos Backend Phase 1 implementation.

## Test Coverage

### Gateway Service Tests
**File:** [services/gateway/gateway.test.js](services/gateway/gateway.test.js)

- **Health Check**: Verifies the `/health` endpoint returns proper status
- **JWT Authentication**:
  - Token generation with valid credentials
  - Token validation and verification
  - Rejection of invalid/expired tokens
  - Rejection of requests missing required fields
- **Rate Limiting**:
  - Allows requests within rate limit
  - Includes proper rate limit headers
- **Authentication Middleware**:
  - Protected route access with valid tokens
  - Denial of access without tokens
  - Denial of access with invalid tokens

### Product Service Tests
**File:** [services/product-service/product.test.js](services/product-service/product.test.js)

- **Health Check**: Service health verification
- **GET /products**:
  - List all products
  - Filter by brand
  - Filter by category
  - Filter by price range (minPrice, maxPrice)
- **GET /products/:id**:
  - Retrieve product by ID
  - Handle non-existent products (404)
- **POST /products**:
  - Create new products
  - Validate required fields
  - Handle duplicate IDs (409)
- **PUT /products/:id**:
  - Update product fields
  - Handle non-existent products (404)
  - Validate at least one field to update
- **DELETE /products/:id**:
  - Delete products
  - Handle non-existent products (404)

### Customer Service Tests
**File:** [services/customer-service/customer.test.js](services/customer-service/customer.test.js)

- **Health Check**: Service health verification
- **GET /customers**:
  - List all customers
  - Filter by tier
  - Filter by email (partial match)
- **GET /customers/:id**:
  - Retrieve customer by ID
  - Handle non-existent customers (404)
- **POST /customers**:
  - Create new customers
  - Validate required fields
  - Handle duplicate IDs/emails (409)
- **PUT /customers/:id**:
  - Update customer fields
  - Handle non-existent customers (404)
  - Handle duplicate emails (409)
  - Validate at least one field to update
- **DELETE /customers/:id**:
  - Delete customers
  - Handle non-existent customers (404)
  - Prevent deletion of customers with orders (409)
- **GET /customers/:id/orders**:
  - Retrieve customer order history
  - Handle customers with no orders

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests with Coverage Report
```bash
npm test -- --coverage
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Individual Service Tests
```bash
# Gateway service tests only
npm run test:gateway

# Product service tests only
npm run test:products

# Customer service tests only
npm run test:customers
```

### Run a Specific Test File
```bash
npx jest services/gateway/gateway.test.js
```

### Run Tests with Verbose Output
```bash
npm test -- --verbose
```

## Test Configuration

- **Test Framework**: Jest
- **HTTP Testing**: Fastify's built-in `inject()` method (no need for supertest in these tests)
- **Database Mocking**: Uses `jest.mock()` to mock the database module
- **Test Environment**: Node.js
- **Test Timeout**: 30 seconds (configurable in [jest.config.js](jest.config.js))

## Test Environment Variables

Test-specific environment variables are defined in [.env.test](.env.test):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chronos_test
JWT_SECRET=test-secret-key-for-testing
GATEWAY_PORT=3100
PRODUCT_SERVICE_PORT=3101
CUSTOMER_SERVICE_PORT=3102
```

## Mocking Strategy

The tests use Jest mocking to isolate service logic from external dependencies:

1. **Database Mocking**: The `@chronos/database` module is mocked to avoid requiring a real database connection
2. **Fastify Injection**: Uses Fastify's `inject()` method to simulate HTTP requests without starting actual servers
3. **Isolated Tests**: Each test suite runs in isolation with its own Fastify instance

## Test Structure

Each test file follows this structure:

```javascript
describe('Service Name', () => {
  let app;

  beforeEach(async () => {
    // Set up Fastify app and routes
    app = fastify({ logger: false });
    // ... register routes ...
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('Feature Group', () => {
    it('should do something specific', async () => {
      // Arrange: Set up mocks and test data
      // Act: Make request
      // Assert: Verify response
    });
  });
});
```

## Code Coverage

To generate a detailed coverage report:

```bash
npm test -- --coverage
```

Coverage reports are generated in the `coverage/` directory and include:
- Line coverage
- Branch coverage
- Function coverage
- Statement coverage

Coverage is collected from:
- `services/**/*.js`
- `packages/**/*.js`
- Excludes: `node_modules/`, `coverage/`

## Continuous Integration

These tests are designed to run in CI/CD pipelines. They:
- Don't require external services (database, Redis)
- Run quickly (all mocked)
- Provide consistent results
- Exit with proper exit codes

## Adding New Tests

When adding new features, follow this pattern:

1. Create a test file alongside your service code
2. Mock external dependencies
3. Test all success paths
4. Test all error conditions
5. Test edge cases
6. Aim for 80%+ code coverage

Example test structure:
```javascript
describe('New Feature', () => {
  it('should handle success case', async () => { /* ... */ });
  it('should handle validation errors', async () => { /* ... */ });
  it('should handle not found errors', async () => { /* ... */ });
  it('should handle database errors', async () => { /* ... */ });
});
```

## Best Practices

1. **Arrange-Act-Assert**: Structure tests clearly
2. **One Assertion Per Test**: Keep tests focused
3. **Descriptive Names**: Use clear, descriptive test names
4. **Clean Mocks**: Always clear mocks in `afterEach()`
5. **Async/Await**: Use async/await consistently
6. **Error Testing**: Test both success and failure paths
7. **Edge Cases**: Test boundary conditions and edge cases

## Troubleshooting

### Tests Failing Due to Timeouts
Increase timeout in [jest.config.js](jest.config.js):
```javascript
testTimeout: 60000 // 60 seconds
```

### Database Connection Errors
Ensure the database module is properly mocked in your test file:
```javascript
jest.mock('@chronos/database', () => ({
  query: jest.fn(),
}));
```

### Port Already in Use
Tests use `inject()` and don't bind to actual ports. If you see port errors, check that you're not running the actual services.

## Future Test Plans

- Integration tests with real database (test database)
- E2E tests covering full API workflows
- Load testing for performance validation
- Security testing for authentication/authorization
- Contract testing for service interactions

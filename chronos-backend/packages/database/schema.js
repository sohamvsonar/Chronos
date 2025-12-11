const { query } = require('./index');

const createSchema = async () => {
  const client = await require('./index').getClient();

  try {
    await client.query('BEGIN');

    // Create products table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        brand VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        category VARCHAR(50) NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index on brand and category for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    `);

    // Create customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(50) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        tier VARCHAR(50) NOT NULL,
        phone VARCHAR(50),
        address JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index on email and tier
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(tier);
    `);

    // Create orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        customer_id VARCHAR(50) NOT NULL REFERENCES customers(id),
        items JSONB NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        payment_method VARCHAR(50),
        shipping_address JSONB,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index on customer_id and status
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    `);

    await client.query('COMMIT');
    console.log('✓ Database schema created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating schema:', error);
    throw error;
  } finally {
    client.release();
  }
};

const dropSchema = async () => {
  const client = await require('./index').getClient();

  try {
    await client.query('BEGIN');
    await client.query('DROP TABLE IF EXISTS orders CASCADE;');
    await client.query('DROP TABLE IF EXISTS customers CASCADE;');
    await client.query('DROP TABLE IF EXISTS products CASCADE;');
    await client.query('COMMIT');
    console.log('✓ Database schema dropped successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error dropping schema:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  createSchema,
  dropSchema,
};

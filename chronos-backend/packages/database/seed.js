const fs = require('fs');
const path = require('path');
const { createSchema, dropSchema } = require('./schema');
const { query, pool } = require('./index');

const seedDatabase = async () => {
  try {
    console.log('Starting database seeding...\n');

    // Drop and recreate schema
    console.log('Dropping existing schema...');
    await dropSchema();

    console.log('Creating new schema...');
    await createSchema();

    // Read data files
    const productsPath = path.resolve(__dirname, '../../data/products.json');
    const customersPath = path.resolve(__dirname, '../../data/customers.json');

    console.log('\nReading data files...');
    const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    const customers = JSON.parse(fs.readFileSync(customersPath, 'utf8'));

    console.log(`Found ${products.length} products`);
    console.log(`Found ${customers.length} customers`);

    // Seed products
    console.log('\nSeeding products...');
    for (const product of products) {
      await query(
        `INSERT INTO products (id, name, brand, price, stock, category, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          product.id,
          product.name,
          product.brand,
          product.price,
          product.stock,
          product.category,
          JSON.stringify(product.metadata),
        ]
      );
    }
    console.log(`✓ Seeded ${products.length} products`);

    // Seed customers
    console.log('\nSeeding customers...');
    for (const customer of customers) {
      await query(
        `INSERT INTO customers (id, email, name, tier, phone, address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          customer.id,
          customer.email,
          customer.name,
          customer.tier,
          customer.phone,
          JSON.stringify(customer.address),
          customer.created_at,
        ]
      );
    }
    console.log(`✓ Seeded ${customers.length} customers`);

    console.log('\n✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('\n❌ Error seeding database:', error);
    throw error;
  } finally {
    await pool.end();
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { seedDatabase };

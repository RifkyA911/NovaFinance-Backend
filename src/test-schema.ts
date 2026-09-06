import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import * as schema from './db/schema';

const pool = new Pool({
  host: process.env.DB_HOST || '172.27.66.97',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'novajournal',
});

const db = drizzle(pool);

async function testSchema() {
  try {
    console.log('🔍 Testing database schema...');

    // Insert a test user
    const [user] = await db.insert(schema.users).values({
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: 'hashed_password_here',
    }).returning();
    console.log('✅ Created user:', user.id);

    // Insert a test workspace
    const [workspace] = await db.insert(schema.workspaces).values({
      ownerId: user.id,
      name: 'Personal Workspace',
      type: 'personal',
      currency: 'IDR',
    }).returning();
    console.log('✅ Created workspace:', workspace.id);

    // Insert a test category
    const [category] = await db.insert(schema.categories).values({
      workspaceId: workspace.id,
      name: 'Salary',
      type: 'income',
      color: '#10B981',
    }).returning();
    console.log('✅ Created category:', category.id);

    // Insert a test account
    const [account] = await db.insert(schema.accounts).values({
      workspaceId: workspace.id,
      name: 'Bank Account',
      type: 'bank',
      balance: '5000000',
      currency: 'IDR',
    }).returning();
    console.log('✅ Created account:', account.id);

    // Insert a test transaction
    const [transaction] = await db.insert(schema.transactions).values({
      workspaceId: workspace.id,
      accountId: account.id,
      categoryId: category.id,
      amount: '5000000',
      type: 'income',
      description: 'Monthly Salary',
      date: new Date(),
    }).returning();
    console.log('✅ Created transaction:', transaction.id);

    // Query all data
    const users = await db.select().from(schema.users);
    const workspaces = await db.select().from(schema.workspaces);
    const transactions = await db.select().from(schema.transactions);

    console.log('📊 Summary:');
    console.log(`  - Users: ${users.length}`);
    console.log(`  - Workspaces: ${workspaces.length}`);
    console.log(`  - Transactions: ${transactions.length}`);

    // Clean up test data
    await db.delete(schema.transactions).where(eq(schema.transactions.id, transaction.id));
    await db.delete(schema.accounts).where(eq(schema.accounts.id, account.id));
    await db.delete(schema.categories).where(eq(schema.categories.id, category.id));
    await db.delete(schema.workspaces).where(eq(schema.workspaces.id, workspace.id));
    await db.delete(schema.users).where(eq(schema.users.id, user.id));
    console.log('✅ Cleaned up test data');

    console.log('✅ Schema test completed successfully');
  } catch (error) {
    console.error('❌ Schema test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testSchema();

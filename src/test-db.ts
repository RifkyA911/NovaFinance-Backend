import { Client } from 'pg';

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'novajournal',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing database connection...');
    console.log(`📍 Connecting to: ${client.host}:${client.port}/${client.database}`);
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');
    
    const result = await client.query('SELECT version()');
    console.log('📊 Database version:', result.rows[0].version);
    
    const dbList = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false');
    console.log('📁 Databases:', dbList.rows.map((r: any) => r.datname));
    
    await client.end();
    console.log('✅ Database test completed successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

testDatabaseConnection();

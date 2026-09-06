import { createClient } from 'redis';

const client = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

async function testRedisConnection() {
  try {
    console.log('🔍 Testing Redis connection...');
    await client.connect();
    console.log('✅ Connected to Redis');
    
    // Test PING
    const ping = await client.ping();
    console.log('🏓 PING:', ping);
    
    // Test SET/GET
    await client.set('test-key', 'test-value');
    const value = await client.get('test-key');
    console.log('📝 SET/GET test:', value);
    
    // Clean up
    await client.del('test-key');
    
    await client.disconnect();
    console.log('✅ Redis test completed successfully');
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    process.exit(1);
  }
}

testRedisConnection();

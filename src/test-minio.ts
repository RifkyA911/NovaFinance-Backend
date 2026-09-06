import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';

const client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minio',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minio123',
  },
  forcePathStyle: true,
});

async function testMinioConnection() {
  try {
    console.log('🔍 Testing Minio S3 connection...');
    
    const command = new ListBucketsCommand({});
    const response = await client.send(command);
    
    console.log('✅ Connected to Minio S3');
    console.log('📦 Buckets:', response.Buckets?.map(b => b.Name));
    
    console.log('✅ Minio test completed successfully');
  } catch (error) {
    console.error('❌ Minio connection failed:', error);
    process.exit(1);
  }
}

testMinioConnection();

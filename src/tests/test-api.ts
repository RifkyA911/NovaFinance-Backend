async function testAPIConnection() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:8080';
  
  try {
    console.log('🔍 Testing API connection...');
    
    // Test root endpoint
    const rootResponse = await fetch(`${baseUrl}/`);
    const rootData = await rootResponse.json();
    console.log('🏠 Root endpoint:', rootData);
    
    // Test health endpoint
    const healthResponse = await fetch(`${baseUrl}/health`);
    const healthData = await healthResponse.json();
    console.log('💚 Health endpoint:', healthData);
    
    // Test dummy accounts endpoint
    const accountsResponse = await fetch(`${baseUrl}/api/auth/dummy-accounts`);
    const accountsData = await accountsResponse.json();
    console.log('👥 Dummy accounts:', accountsData);
    
    // Test workspaces endpoint
    const workspacesResponse = await fetch(`${baseUrl}/api/workspaces`);
    const workspacesData = await workspacesResponse.json();
    console.log('💼 Workspaces:', workspacesData);
    
    console.log('✅ API test completed successfully');
  } catch (error) {
    console.error('❌ API connection failed:', error);
    process.exit(1);
  }
}

testAPIConnection();

async function testWorkspaces() {
  const baseUrl = 'http://localhost:8080';
  
  try {
    console.log('🔍 Testing Workspace API...');
    
    // First, sign in to get a token
    console.log('\n1. Signing in...');
    const signInResponse = await fetch(`${baseUrl}/api/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
      }),
    });
    const signInData = await signInResponse.json();
    console.log('Sign-in response:', signInData);
    
    if (!signInData.data?.token) {
      console.log('❌ Failed to get token');
      return;
    }
    
    const token = signInData.data.token;
    
    // Test create workspace
    console.log('\n2. Creating workspace...');
    const createResponse = await fetch(`${baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Personal Workspace',
        type: 'personal',
        currency: 'IDR',
      }),
    });
    const createData = await createResponse.json();
    console.log('Create workspace response:', createData);
    
    const workspaceId = createData.data?.workspace?.id;
    
    if (workspaceId) {
      // Test get workspaces
      console.log('\n3. Getting workspaces...');
      const listResponse = await fetch(`${baseUrl}/api/workspaces`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`,
        },
      });
      const listData = await listResponse.json();
      console.log('List workspaces response:', listData);
      
      // Test get single workspace
      console.log('\n4. Getting single workspace...');
      const getResponse = await fetch(`${baseUrl}/api/workspaces/${workspaceId}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`,
        },
      });
      const getData = await getResponse.json();
      console.log('Get workspace response:', getData);
      
      // Test update workspace
      console.log('\n5. Updating workspace...');
      const updateResponse = await fetch(`${baseUrl}/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: 'Updated Personal Workspace',
        }),
      });
      const updateData = await updateResponse.json();
      console.log('Update workspace response:', updateData);
      
      // Test delete workspace (soft delete)
      console.log('\n6. Deleting workspace...');
      const deleteResponse = await fetch(`${baseUrl}/api/workspaces/${workspaceId}`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`,
        },
      });
      const deleteData = await deleteResponse.json();
      console.log('Delete workspace response:', deleteData);
    }
    
    console.log('\n✅ Workspace API test completed');
  } catch (error) {
    console.error('❌ Workspace API test failed:', error);
    process.exit(1);
  }
}

testWorkspaces();

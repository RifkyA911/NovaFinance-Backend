async function testAuth() {
  const baseUrl = 'http://localhost:8080';
  
  try {
    console.log('🔍 Testing Better Auth endpoints...');
    
    // Test sign-up
    console.log('\n1. Testing sign-up...');
    const signUpResponse = await fetch(`${baseUrl}/api/auth/sign-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      }),
    });
    const signUpData = await signUpResponse.json();
    console.log('Sign-up response:', signUpData);
    
    // Test sign-in
    console.log('\n2. Testing sign-in...');
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
    
    // Test session
    console.log('\n3. Testing session...');
    if (signInData.data?.token) {
      const sessionResponse = await fetch(`${baseUrl}/api/auth/get-session`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'authorization': `Bearer ${signInData.data.token}`,
        },
      });
      const sessionData = await sessionResponse.json();
      console.log('Session response:', sessionData);
    } else {
      console.log('No token available for session test');
    }
    
    console.log('\n✅ Auth test completed');
  } catch (error) {
    console.error('❌ Auth test failed:', error);
    process.exit(1);
  }
}

testAuth();

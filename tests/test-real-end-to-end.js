const { spawn, exec } = require('child_process');
const axios = require('axios');
const path = require('path');

// Load environment variables from .env.test
require('dotenv').config({ path: '.env.test' });

/**
 * Real End-to-End Test Script
 * 
 * This script:
 * 1. Kills any existing Node.js processes on the test port
 * 2. Starts the actual server with real environment variables
 * 3. Makes real HTTP requests to test the full stack
 * 4. Uses real Supabase authentication and database connections
 * 5. Tests actual AI service integration
 * 6. Cleans up properly
 */

// Configuration
const CONFIG = {
  SERVER_PORT: 3001,
  SERVER_HOST: 'localhost',
  BASE_URL: 'http://localhost:3001',
  TIMEOUT: 15000,
  // Load from .env.test file
  TEST_USER_TOKEN: process.env.TEST_USER_TOKEN || 'your-real-jwt-token-here',
  TEST_WORKSPACE_ID: process.env.TEST_WORKSPACE_ID || 'your-real-workspace-id-here',
  TEST_DB_CONNECTION_STRING: process.env.TEST_DB_CONNECTION_STRING || 'your-real-db-connection-string-here'
};

let serverProcess = null;
let isServerReady = false;


/**
 * Kill any existing Node.js processes on the test port
 */
async function killExistingServers() {
  console.log('🔍 Checking for existing servers on port', CONFIG.SERVER_PORT);
  
  return new Promise((resolve) => {
    // Kill processes on the specific port (Windows)
    exec(`netstat -ano | findstr :${CONFIG.SERVER_PORT}`, (error, stdout) => {
      if (stdout) {
        const lines = stdout.split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5 && parts[1].includes(`:${CONFIG.SERVER_PORT}`)) {
            const pid = parts[4];
            console.log(`🔪 Killing existing process PID: ${pid}`);
            exec(`taskkill /PID ${pid} /F`, (killError) => {
              if (killError) {
                console.log('⚠️  Could not kill process (may not exist):', killError.message);
              } else {
                console.log(`✅ Killed process PID: ${pid}`);
              }
            });
          }
        }
      }
      // Wait a bit for processes to be killed
      setTimeout(resolve, 2000);
    });
  });
}

/**
 * Start the actual server
 */
async function startServer() {
  console.log('🚀 Starting server...');
  
  // Set environment variables for testing
  const env = {
    ...process.env,
    PORT: CONFIG.SERVER_PORT,
    NODE_ENV: 'test',
    // You can override any environment variables here for testing
    // OPENAI_API_KEY: 'your-test-openai-key',
    // SUPABASE_URL: 'your-test-supabase-url',
    // SUPABASE_ANON_KEY: 'your-test-supabase-key'
  };

  serverProcess = spawn('node', ['src/index.js'], {
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: path.resolve(__dirname, '..')
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Server failed to start within ${CONFIG.TIMEOUT / 1000} seconds`));
    }, CONFIG.TIMEOUT);

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('📝 Server output:', output.trim());
      
      if (output.includes('Server is running') || output.includes('Server running') || output.includes(`port ${CONFIG.SERVER_PORT}`)) {
        clearTimeout(timeout);
        isServerReady = true;
        console.log('✅ Server is ready!');
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error('❌ Server error:', error.trim());
    });

    serverProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    serverProcess.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0 && !isServerReady) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

/**
 * Stop the server
 */
async function stopServer() {
  console.log('🛑 Stopping server...');
  
  if (serverProcess) {
    return new Promise((resolve) => {
      serverProcess.kill('SIGTERM');
      
      // Force kill if it doesn't stop gracefully
      setTimeout(() => {
        if (!serverProcess.killed) {
          console.log('🔪 Force killing server...');
          serverProcess.kill('SIGKILL');
        }
      }, 5000);

      serverProcess.on('close', (code) => {
        console.log(`✅ Server stopped (exit code: ${code})`);
        resolve();
      });
    });
  }
}

/**
 * Wait for server to be ready for requests
 */
async function waitForServer() {
  const maxAttempts = 30;
  const delay = 1000;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await axios.get(`${CONFIG.BASE_URL}/health`, { timeout: 2000 });
      if (response.status === 200) {
        console.log('✅ Server is responding to requests');
        return true;
      }
    } catch (error) {
      console.log(`⏳ Waiting for server... (attempt ${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Server did not become ready for requests');
}

/**
 * Test authentication
 */
async function testAuthentication() {
  console.log('\n🔐 Testing Authentication...');
  
  try {
    // Test without token
    await axios.post(`${CONFIG.BASE_URL}/api/query/execute`, {
      workspaceId: CONFIG.TEST_WORKSPACE_ID,
      question: 'test question'
    });
    console.log('❌ Should have failed without token');
    return false;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Correctly rejected request without token');
    } else {
      console.log('❌ Unexpected error:', error.message);
      return false;
    }
  }

  try {
    // Test with invalid token
    await axios.post(`${CONFIG.BASE_URL}/api/query/execute`, {
      workspaceId: CONFIG.TEST_WORKSPACE_ID,
      question: 'test question'
    }, {
      headers: { Authorization: 'Bearer invalid-token' }
    });
    console.log('❌ Should have failed with invalid token');
    return false;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Correctly rejected request with invalid token');
    } else {
      console.log('❌ Unexpected error:', error.message);
      return false;
    }
  }

  return true;
}

/**
 * Test with real authentication token
 */
async function testWithRealAuth() {
  console.log('\n🔑 Testing with Real Authentication...');
  
  if (CONFIG.TEST_USER_TOKEN === 'your-real-jwt-token-here') {
    console.log('⚠️  Skipping real auth test - no token provided');
    console.log('   Set TEST_USER_TOKEN environment variable to test with real authentication');
    return true;
  }

  try {
    const response = await axios.post(`${CONFIG.BASE_URL}/api/query/execute`, {
      workspaceId: CONFIG.TEST_WORKSPACE_ID,
      question: 'How many users are in the database?'
    }, {
      headers: { Authorization: `Bearer ${CONFIG.TEST_USER_TOKEN}` }
    });

    console.log('✅ Real authentication successful!');
    console.log('📊 Response:', {
      status: response.status,
      hasSql: !!response.data.sql,
      hasExplanation: !!response.data.explanation,
      hasData: !!response.data.data,
      rowCount: response.data.rowCount
    });
    return true;
  } catch (error) {
    console.log('❌ Real authentication failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test workspace operations
 */
async function testWorkspaceOperations() {
  console.log('\n🏢 Testing Workspace Operations...');
  
  if (CONFIG.TEST_USER_TOKEN === 'your-real-jwt-token-here') {
    console.log('⚠️  Skipping workspace test - no token provided');
    return true;
  }

  try {
    // Get user's workspaces
    const response = await axios.get(`${CONFIG.BASE_URL}/api/workspaces`, {
      headers: { Authorization: `Bearer ${CONFIG.TEST_USER_TOKEN}` }
    });

    console.log('✅ Retrieved workspaces successfully!');
    console.log('📊 Workspaces count:', response.data.workspaces?.length || 0);
    return true;
  } catch (error) {
    console.log('❌ Workspace operations failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test error handling
 */
async function testErrorHandling() {
  console.log('\n⚠️  Testing Error Handling...');
  
  const tests = [
    {
      name: 'Invalid JSON',
      test: () => axios.post(`${CONFIG.BASE_URL}/api/query/execute`, 
        'invalid json', 
        { headers: { 'Content-Type': 'application/json' } }
      )
    },
    {
      name: 'Non-existent endpoint',
      test: () => axios.get(`${CONFIG.BASE_URL}/api/nonexistent`)
    },
    {
      name: 'Invalid UUID',
      test: () => axios.post(`${CONFIG.BASE_URL}/api/query/execute`, {
        workspaceId: 'invalid-uuid',
        question: 'test'
      }, {
        headers: { Authorization: `Bearer ${CONFIG.TEST_USER_TOKEN}` }
      })
    }
  ];

  let passed = 0;
  for (const test of tests) {
    try {
      await test.test();
      console.log(`❌ ${test.name}: Should have failed`);
    } catch (error) {
      console.log(`✅ ${test.name}: Correctly handled (${error.response?.status || 'error'})`);
      passed++;
    }
  }

  return passed === tests.length;
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🧪 Starting Real End-to-End Tests');
  console.log('📋 Configuration:', {
    port: CONFIG.SERVER_PORT,
    hasToken: CONFIG.TEST_USER_TOKEN !== 'your-real-jwt-token-here',
    hasWorkspaceId: CONFIG.TEST_WORKSPACE_ID !== 'your-real-workspace-id-here',
    hasConnectionString: CONFIG.TEST_DB_CONNECTION_STRING !== 'your-real-db-connection-string-here'
  });

  try {
    // Step 1: Kill existing servers
    await killExistingServers();
    
    // Step 2: Start server
    await startServer();
    
    // Step 3: Wait for server to be ready
    await waitForServer();
    
    // Step 4: Run tests
    const results = [];
    
    results.push(await testAuthentication());
    results.push(await testWithRealAuth());
    results.push(await testWorkspaceOperations());
    results.push(await testErrorHandling());
    
    // Summary
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${total - passed}/${total}`);
    
    if (passed === total) {
      console.log('🎉 All tests passed!');
    } else {
      console.log('⚠️  Some tests failed');
    }
    
  } catch (error) {
    console.error('💥 Test runner failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup
    await stopServer();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down...');
  await stopServer();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  await stopServer();
  process.exit(0);
});

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  CONFIG
};

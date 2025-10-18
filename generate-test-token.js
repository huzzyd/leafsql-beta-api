const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateTestToken() {
  try {
    console.log('🔐 Attempting to sign in with test credentials...');
    
    // Try to sign in with the known user
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'huzaifah.din@gmail.com',
      password: 'test-password' // You'll need to know the password
    });

    if (error) {
      console.error('❌ Sign in failed:', error.message);
      console.log('\n📝 To get a valid JWT token:');
      console.log('1. Go to https://supabase.com/dashboard/project/wzmlqhsgvurgwpfkilsy');
      console.log('2. Navigate to Authentication → Users');
      console.log('3. Find user: huzaifah.din@gmail.com');
      console.log('4. Copy their JWT token');
      return;
    }

    console.log('✅ Successfully signed in!');
    console.log('🔑 JWT Token:', data.session.access_token);
    console.log('\n📋 Copy this token and replace it in tests/test-end-to-end.js');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

generateTestToken();

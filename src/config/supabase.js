const { createClient } = require('@supabase/supabase-js');
const config = require('./env');

/**
 * Supabase client configuration
 * Creates a singleton instance for auth verification and metadata queries
 */

let supabaseClient = null;

/**
 * Creates and returns a Supabase client instance
 * @returns {Object} Supabase client
 */
function createSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  try {
    // Validate required Supabase environment variables
    if (!config.SUPABASE_URL) {
      throw new Error('SUPABASE_URL is required but not provided');
    }
    
    if (!config.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required but not provided');
    }

    // Create Supabase client with service role key for server-side operations
    supabaseClient = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          // Use service role key for server-side operations
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          // Schema for the database operations
          schema: 'public'
        }
      }
    );

    console.log('✅ Supabase client created successfully');
    return supabaseClient;

  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error.message);
    throw new Error(`Supabase connection failed: ${error.message}`);
  }
}

/**
 * Gets the Supabase client instance
 * Creates it if it doesn't exist
 * @returns {Object} Supabase client
 */
function getSupabaseClient() {
  if (!supabaseClient) {
    return createSupabaseClient();
  }
  return supabaseClient;
}

/**
 * Verifies a user JWT token
 * @param {string} token - JWT token to verify
 * @returns {Promise<Object>} User data if valid, null if invalid
 */
async function verifyUserToken(token) {
  try {
    const supabase = getSupabaseClient();
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error('Token verification failed:', error.message);
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Error verifying token:', error.message);
    return null;
  }
}

/**
 * Queries the workspaces table
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Query result
 */
async function queryWorkspaces(options = {}) {
  try {
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('workspaces')
      .select('*');
    
    // Add filters if provided
    if (options.userId) {
      query = query.eq('user_id', options.userId);
    }
    
    if (options.workspaceId) {
      query = query.eq('id', options.workspaceId);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Workspaces query failed:', error.message);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error querying workspaces:', error.message);
    throw error;
  }
}

/**
 * Saves query history
 * @param {Object} queryData - Query data to save
 * @returns {Promise<Object>} Saved query result
 */
async function saveQueryHistory(queryData) {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('query_history')
      .insert([queryData])
      .select()
      .single();
    
    if (error) {
      console.error('Failed to save query history:', error.message);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error saving query history:', error.message);
    throw error;
  }
}

/**
 * Tests the Supabase connection
 * @returns {Promise<boolean>} True if connection is successful
 */
async function testConnection() {
  try {
    const supabase = getSupabaseClient();
    
    console.log('🔍 Testing Supabase connection...');
    console.log('📍 Supabase URL:', config.SUPABASE_URL);
    console.log('🔑 Service Role Key (first 20 chars):', config.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + '...');
    
    // Try a simple database operation that works with service role
    // Use the workspaces table which exists in this project
    const { data, error } = await supabase
      .from('workspaces')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection test failed:', error.message);
      console.error('❌ Error details:', error);
      return false;
    }
    
    console.log('✅ Supabase connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection test error:', error.message);
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Full error:', error);
    return false;
  }
}

module.exports = {
  createSupabaseClient,
  getSupabaseClient,
  verifyUserToken,
  queryWorkspaces,
  saveQueryHistory,
  testConnection
};

const { Pool } = require('pg');

/**
 * External Database Service
 * Manages connection pools to external client databases (NOT Supabase)
 * Each workspace connects to a different client database
 */

class DatabaseService {
  constructor() {
    // Map of workspace_id -> Pool
    this.pools = new Map();
    
    // Pool configuration
    this.poolConfig = {
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000
    };
  }

  /**
   * Mask connection string for logging and error messages
   * @param {string} connectionString - Original connection string
   * @returns {string} Masked connection string
   */
  maskConnectionString(connectionString) {
    if (!connectionString || typeof connectionString !== 'string') {
      return '[INVALID_CONNECTION_STRING]';
    }

    try {
      // Parse the connection string
      const url = new URL(connectionString);
      
      // Mask password if present
      if (url.password) {
        url.password = '***';
      }
      
      // Mask host for security (show only first part)
      if (url.hostname) {
        const parts = url.hostname.split('.');
        if (parts.length > 1) {
          url.hostname = parts[0] + '.***';
        } else {
          url.hostname = '***';
        }
      }
      
      return url.toString();
    } catch (error) {
      // If URL parsing fails, return a generic mask
      return '[MASKED_CONNECTION_STRING]';
    }
  }

  /**
   * Get or create a connection pool for a workspace
   * @param {string} workspaceId - The workspace ID
   * @param {string} connectionString - PostgreSQL connection string
   * @returns {Pool} PostgreSQL connection pool
   */
  getPool(workspaceId, connectionString) {
    // Validate connection string
    if (!connectionString || typeof connectionString !== 'string') {
      throw new Error('Connection string must be a non-empty string');
    }

    // Check if pool already exists
    if (this.pools.has(workspaceId)) {
      return this.pools.get(workspaceId);
    }

    // Create new pool with connection string and config
    const pool = new Pool({
      connectionString,
      ...this.poolConfig
    });

    // Store in Map
    this.pools.set(workspaceId, pool);

    // Log with masked connection string for security
    const maskedConnectionString = this.maskConnectionString(connectionString);
    console.log(`📊 Created new database pool for workspace: ${workspaceId}`);
    console.log(`🔗 Connection: ${maskedConnectionString}`);
    return pool;
  }

  /**
   * Execute a SQL query on a workspace's database
   * @param {string} workspaceId - The workspace ID
   * @param {string} connectionString - PostgreSQL connection string
   * @param {string} sql - SQL query to execute
   * @returns {Promise<Object>} Query result with rows, rowCount, and executionTime
   */
  async executeQuery(workspaceId, connectionString, sql) {
    const startTime = Date.now();
    let client;

    try {
      // Validate inputs
      if (!sql || typeof sql !== 'string') {
        throw new Error('SQL query must be a non-empty string');
      }

      // Get or create pool
      const pool = this.getPool(workspaceId, connectionString);
      
      // Acquire client from pool
      client = await pool.connect();
      
      // Execute query
      const result = await client.query(sql);
      
      // Check result size limit (10,000 rows max)
      const MAX_ROWS = 10000;
      if (result.rowCount > MAX_ROWS) {
        throw new Error(`Query result exceeds maximum allowed rows (${MAX_ROWS}). Please add LIMIT clause or use pagination to reduce result set size.`);
      }
      
      // Calculate execution time
      const executionTime = Date.now() - startTime;
      
      console.log(`✅ Query executed for workspace ${workspaceId} in ${executionTime}ms (${result.rowCount} rows)`);
      
      return {
        rows: result.rows,
        rowCount: result.rowCount,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Mask connection string in error logging
      const maskedConnectionString = this.maskConnectionString(connectionString);
      console.error(`❌ Query failed for workspace ${workspaceId} after ${executionTime}ms:`, error.message);
      console.error(`🔗 Connection: ${maskedConnectionString}`);
      
      // Provide descriptive error messages
      let errorMessage = 'Database query failed';
      
      if (error.message.includes('exceeds maximum allowed rows')) {
        // This is our custom error for row limits
        throw error;
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Database connection refused - check if database is running';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Database host not found - check connection string';
      } else if (error.code === '28P01') {
        errorMessage = 'Database authentication failed - check username/password';
      } else if (error.code === '3D000') {
        errorMessage = 'Database does not exist - check database name';
      } else if (error.code === '42P01') {
        errorMessage = 'Table does not exist - check table name';
      } else if (error.code === '42601') {
        errorMessage = 'SQL syntax error - check query syntax';
      } else if (error.code === '23505') {
        errorMessage = 'Duplicate key violation - unique constraint failed';
      } else if (error.code === '23503') {
        errorMessage = 'Foreign key violation - referenced record does not exist';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Query timeout - query took too long to execute';
      } else {
        errorMessage = `Database error: ${error.message}`;
      }
      
      throw new Error(`${errorMessage} (${error.code || 'UNKNOWN'})`);
      
    } finally {
      // Release client back to pool
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Get database schema for a workspace
   * @param {string} workspaceId - The workspace ID
   * @param {string} connectionString - PostgreSQL connection string
   * @returns {Promise<Object>} Schema object with tables and columns
   */
  async getSchema(workspaceId, connectionString) {
    try {
      const sql = `
        SELECT 
          table_name, 
          column_name, 
          data_type, 
          is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        ORDER BY table_name, ordinal_position
      `;

      const result = await this.executeQuery(workspaceId, connectionString, sql);
      
      // Transform results into object format
      const schema = {};
      
      result.rows.forEach(row => {
        const tableName = row.table_name;
        const column = {
          name: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === 'YES'
        };

        if (!schema[tableName]) {
          schema[tableName] = [];
        }
        
        schema[tableName].push(column);
      });

      console.log(`📋 Retrieved schema for workspace ${workspaceId}: ${Object.keys(schema).length} tables`);
      return schema;

    } catch (error) {
      console.error(`❌ Failed to get schema for workspace ${workspaceId}:`, error.message);
      throw new Error(`Schema retrieval failed: ${error.message}`);
    }
  }

  /**
   * Test a database connection
   * @param {string} connectionString - PostgreSQL connection string
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection(connectionString) {
    let pool;
    let client;

    try {
      // Validate connection string
      if (!connectionString || typeof connectionString !== 'string') {
        throw new Error('Connection string must be a non-empty string');
      }

      // Create temporary pool
      pool = new Pool({
        connectionString,
        max: 1, // Only need one connection for testing
        idleTimeoutMillis: 5000,
        connectionTimeoutMillis: 5000
      });

      // Acquire client
      client = await pool.connect();
      
      // Execute simple test query
      await client.query('SELECT 1');
      
      const maskedConnectionString = this.maskConnectionString(connectionString);
      console.log('✅ Database connection test successful');
      console.log(`🔗 Connection: ${maskedConnectionString}`);
      return true;

    } catch (error) {
      const maskedConnectionString = this.maskConnectionString(connectionString);
      console.error('❌ Database connection test failed:', error.message);
      console.error(`🔗 Connection: ${maskedConnectionString}`);
      
      let errorMessage = 'Connection test failed';
      
      if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused - database server is not running or not accessible';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Host not found - check database host in connection string';
      } else if (error.code === '28P01') {
        errorMessage = 'Authentication failed - check username and password';
      } else if (error.code === '3D000') {
        errorMessage = 'Database does not exist - check database name';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = 'Connection timeout - database server is not responding';
      } else {
        errorMessage = `Connection error: ${error.message}`;
      }
      
      throw new Error(`${errorMessage} (${error.code || 'UNKNOWN'})`);
      
    } finally {
      // Clean up
      if (client) {
        client.release();
      }
      if (pool) {
        await pool.end();
      }
    }
  }

  /**
   * Close a workspace's connection pool
   * @param {string} workspaceId - The workspace ID
   * @returns {Promise<boolean>} True if pool was closed, false if not found
   */
  async closePool(workspaceId) {
    try {
      const pool = this.pools.get(workspaceId);
      
      if (!pool) {
        console.log(`⚠️  No pool found for workspace: ${workspaceId}`);
        return false;
      }

      // End pool and close all connections
      await pool.end();
      
      // Remove from Map
      this.pools.delete(workspaceId);
      
      console.log(`🔌 Closed database pool for workspace: ${workspaceId}`);
      return true;

    } catch (error) {
      console.error(`❌ Error closing pool for workspace ${workspaceId}:`, error.message);
      throw new Error(`Failed to close pool: ${error.message}`);
    }
  }

  /**
   * Get all active workspace IDs
   * @returns {Array<string>} Array of workspace IDs with active pools
   */
  getActiveWorkspaces() {
    return Array.from(this.pools.keys());
  }

  /**
   * Close all connection pools
   * @returns {Promise<void>}
   */
  async closeAllPools() {
    const workspaceIds = this.getActiveWorkspaces();
    
    console.log(`🔌 Closing ${workspaceIds.length} database pools...`);
    
    await Promise.all(
      workspaceIds.map(workspaceId => this.closePool(workspaceId))
    );
    
    console.log('✅ All database pools closed');
  }
}

// Export singleton instance
module.exports = new DatabaseService();

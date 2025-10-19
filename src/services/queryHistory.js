const { getSupabaseClient } = require('../config/supabase');

/**
 * Query History Service
 * Manages query history operations in Supabase
 * Tracks all user queries for analytics, favorites, and history
 */

class QueryHistoryService {
  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Save a query to history
   * @param {Object} queryData - Query data to save
   * @param {string} queryData.userId - User ID
   * @param {string} queryData.workspaceId - Workspace ID
   * @param {string} queryData.question - Natural language question
   * @param {string} queryData.sql - Generated SQL query
   * @param {string} queryData.explanation - Query explanation
   * @param {string} queryData.databaseProvider - Database provider
   * @param {number} queryData.executionTime - Query execution time in ms
   * @param {number} queryData.rowCount - Number of rows returned
   * @param {boolean} queryData.success - Whether query was successful
   * @param {string} [queryData.errorMessage] - Error message if query failed
   * @returns {Promise<Object>} Saved query history record
   */
  async saveQuery(queryData) {
    try {
      const historyRecord = {
        user_id: queryData.userId,
        workspace_id: queryData.workspaceId,
        question: queryData.question,
        sql_query: queryData.sql,
        explanation: queryData.explanation,
        database_provider: queryData.databaseProvider,
        execution_time_ms: queryData.executionTime,
        row_count: queryData.rowCount,
        success: queryData.success,
        error_message: queryData.errorMessage || null,
        is_favorite: false,
        created_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('query_history')
        .insert([historyRecord])
        .select()
        .single();

      if (error) {
        console.error('Failed to save query history:', error.message);
        throw new Error(`Failed to save query history: ${error.message}`);
      }

      console.log(`✅ Saved query to history: ${data.id} for user: ${queryData.userId}`);
      return data;

    } catch (error) {
      console.error(`❌ Error saving query history for user ${queryData.userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get query history for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @param {string} [options.workspaceId] - Filter by workspace ID
   * @param {number} [options.limit] - Limit number of results (default: 50)
   * @param {number} [options.offset] - Offset for pagination (default: 0)
   * @param {boolean} [options.favoritesOnly] - Only return favorite queries
   * @returns {Promise<Array>} Array of query history records
   */
  async getUserQueryHistory(userId, options = {}) {
    try {
      const {
        workspaceId,
        limit = 50,
        offset = 0,
        favoritesOnly = false
      } = options;

      let query = this.supabase
        .from('query_history')
        .select(`
          id,
          workspace_id,
          question,
          sql_query,
          explanation,
          database_provider,
          execution_time_ms,
          row_count,
          success,
          error_message,
          is_favorite,
          created_at,
          workspaces(name, database_provider)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }

      if (favoritesOnly) {
        query = query.eq('is_favorite', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching query history:', error.message);
        throw new Error(`Failed to fetch query history: ${error.message}`);
      }

      console.log(`✅ Retrieved ${data?.length || 0} query history records for user: ${userId}`);
      return data || [];

    } catch (error) {
      console.error(`❌ Error getting query history for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get a specific query history record
   * @param {string} queryId - Query history ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Query history record
   */
  async getQuery(queryId, userId) {
    try {
      const { data, error } = await this.supabase
        .from('query_history')
        .select(`
          id,
          workspace_id,
          question,
          sql_query,
          explanation,
          database_provider,
          execution_time_ms,
          row_count,
          success,
          error_message,
          is_favorite,
          created_at,
          workspaces(name, database_provider)
        `)
        .eq('id', queryId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Query not found');
        }
        console.error('Error fetching query:', error.message);
        throw new Error(`Failed to fetch query: ${error.message}`);
      }

      if (!data) {
        throw new Error('Query not found');
      }

      console.log(`✅ Retrieved query: ${queryId} for user: ${userId}`);
      return data;

    } catch (error) {
      console.error(`❌ Error getting query ${queryId}:`, error.message);
      throw error;
    }
  }

  /**
   * Toggle favorite status of a query
   * @param {string} queryId - Query history ID
   * @param {string} userId - User ID
   * @param {boolean} isFavorite - Whether to mark as favorite
   * @returns {Promise<Object>} Updated query record
   */
  async toggleFavorite(queryId, userId, isFavorite) {
    try {
      const { data, error } = await this.supabase
        .from('query_history')
        .update({ 
          is_favorite: isFavorite,
          updated_at: new Date().toISOString()
        })
        .eq('id', queryId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Query not found');
        }
        console.error('Error updating query favorite status:', error.message);
        throw new Error(`Failed to update query favorite status: ${error.message}`);
      }

      if (!data) {
        throw new Error('Query not found');
      }

      console.log(`✅ Updated favorite status for query: ${queryId} to ${isFavorite}`);
      return data;

    } catch (error) {
      console.error(`❌ Error updating favorite status for query ${queryId}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete a query from history
   * @param {string} queryId - Query history ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteQuery(queryId, userId) {
    try {
      const { data, error } = await this.supabase
        .from('query_history')
        .delete()
        .eq('id', queryId)
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('Error deleting query:', error.message);
        throw new Error(`Failed to delete query: ${error.message}`);
      }

      if (!data || data.length === 0) {
        console.log(`⚠️  Query ${queryId} not found for user ${userId}`);
        return false;
      }

      console.log(`✅ Deleted query: ${queryId}`);
      return true;

    } catch (error) {
      console.error(`❌ Error deleting query ${queryId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get query statistics for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @param {string} [options.workspaceId] - Filter by workspace ID
   * @param {number} [options.days] - Number of days to look back (default: 30)
   * @returns {Promise<Object>} Query statistics
   */
  async getQueryStatistics(userId, options = {}) {
    try {
      const { workspaceId, days = 30 } = options;
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateISO = startDate.toISOString();

      let query = this.supabase
        .from('query_history')
        .select('success, execution_time_ms, row_count, database_provider, created_at')
        .eq('user_id', userId)
        .gte('created_at', startDateISO);

      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching query statistics:', error.message);
        throw new Error(`Failed to fetch query statistics: ${error.message}`);
      }

      const queries = data || [];
      const totalQueries = queries.length;
      const successfulQueries = queries.filter(q => q.success).length;
      const failedQueries = totalQueries - successfulQueries;
      const averageExecutionTime = queries.length > 0 
        ? Math.round(queries.reduce((sum, q) => sum + (q.execution_time_ms || 0), 0) / queries.length)
        : 0;
      const totalRowsReturned = queries.reduce((sum, q) => sum + (q.row_count || 0), 0);

      // Group by database provider
      const providerStats = queries.reduce((acc, q) => {
        const provider = q.database_provider || 'unknown';
        acc[provider] = (acc[provider] || 0) + 1;
        return acc;
      }, {});

      const statistics = {
        totalQueries,
        successfulQueries,
        failedQueries,
        successRate: totalQueries > 0 ? Math.round((successfulQueries / totalQueries) * 100) : 0,
        averageExecutionTime,
        totalRowsReturned,
        providerStats,
        periodDays: days
      };

      console.log(`✅ Retrieved query statistics for user: ${userId} (${totalQueries} queries in ${days} days)`);
      return statistics;

    } catch (error) {
      console.error(`❌ Error getting query statistics for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Test the query history service connection
   * @returns {Promise<boolean>} True if connection is successful
   */
  async testConnection() {
    try {
      const { data, error } = await this.supabase
        .from('query_history')
        .select('id')
        .limit(1);

      if (error) {
        console.error('❌ Query history service connection test failed:', error.message);
        return false;
      }

      console.log('✅ Query history service connection test successful');
      return true;

    } catch (error) {
      console.error('❌ Query history service connection test error:', error.message);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new QueryHistoryService();

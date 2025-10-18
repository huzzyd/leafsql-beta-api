const { getSupabaseClient } = require('../config/supabase');

/**
 * Workspace Service
 * Manages workspace metadata in Supabase
 * Queries the 'workspaces' table (NOT external databases)
 */

class WorkspaceService {
  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Get a workspace by ID and user ID
   * @param {string} workspaceId - The workspace ID
   * @param {string} userId - The user ID
   * @returns {Promise<Object>} Workspace object
   * @throws {Error} 'Workspace not found' if workspace doesn't exist or doesn't belong to user
   */
  async getWorkspace(workspaceId, userId) {
    try {
      const { data, error } = await this.supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          throw new Error('Workspace not found');
        }
        console.error('Error fetching workspace:', error.message);
        throw new Error(`Failed to fetch workspace: ${error.message}`);
      }

      if (!data) {
        throw new Error('Workspace not found');
      }

      console.log(`✅ Retrieved workspace: ${workspaceId} for user: ${userId}`);
      return data;

    } catch (error) {
      console.error(`❌ Error getting workspace ${workspaceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get all workspaces for a user
   * @param {string} userId - The user ID
   * @returns {Promise<Array>} Array of workspace objects, ordered by updated_at descending
   */
  async getUserWorkspaces(userId) {
    try {
      const { data, error } = await this.supabase
        .from('workspaces')
        .select('id, name, database_provider, description, status, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching user workspaces:', error.message);
        throw new Error(`Failed to fetch user workspaces: ${error.message}`);
      }

      console.log(`✅ Retrieved ${data?.length || 0} workspaces for user: ${userId}`);
      return data || [];

    } catch (error) {
      console.error(`❌ Error getting workspaces for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Create a new workspace
   * @param {string} userId - The user ID
   * @param {Object} workspaceData - Workspace data
   * @param {string} workspaceData.name - Workspace name
   * @param {string} workspaceData.databaseProvider - Database provider (e.g., 'postgresql')
   * @param {string} workspaceData.connectionString - Database connection string
   * @param {string} [workspaceData.description] - Optional workspace description
   * @returns {Promise<Object>} Created workspace object
   */
  async createWorkspace(userId, { name, databaseProvider, connectionString, description }) {
    try {
      const workspaceData = {
        user_id: userId,
        name,
        database_provider: databaseProvider,
        connection_string: connectionString,
        description: description || null,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('workspaces')
        .insert([workspaceData])
        .select()
        .single();

      if (error) {
        console.error('Error creating workspace:', error.message);
        throw new Error(`Failed to create workspace: ${error.message}`);
      }

      console.log(`✅ Created workspace: ${data.id} for user: ${userId}`);
      return data;

    } catch (error) {
      console.error(`❌ Error creating workspace for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Update workspace last used timestamp
   * @param {string} workspaceId - The workspace ID
   * @param {string} userId - The user ID
   * @returns {Promise<void>} Fire and forget - doesn't throw errors
   */
  async updateLastUsed(workspaceId, userId) {
    try {
      const { error } = await this.supabase
        .from('workspaces')
        .update({ 
          updated_at: new Date().toISOString() 
        })
        .eq('id', workspaceId)
        .eq('user_id', userId);

      if (error) {
        console.warn(`⚠️  Failed to update last used for workspace ${workspaceId}:`, error.message);
        // Don't throw - this is fire and forget
        return;
      }

      console.log(`✅ Updated last used for workspace: ${workspaceId}`);

    } catch (error) {
      console.warn(`⚠️  Error updating last used for workspace ${workspaceId}:`, error.message);
      // Don't throw - this is fire and forget
    }
  }

  /**
   * Update workspace details
   * @param {string} workspaceId - The workspace ID
   * @param {string} userId - The user ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated workspace object
   */
  async updateWorkspace(workspaceId, userId, updateData) {
    try {
      const updatePayload = {
        ...updateData,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('workspaces')
        .update(updatePayload)
        .eq('id', workspaceId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Workspace not found');
        }
        console.error('Error updating workspace:', error.message);
        throw new Error(`Failed to update workspace: ${error.message}`);
      }

      if (!data) {
        throw new Error('Workspace not found');
      }

      console.log(`✅ Updated workspace: ${workspaceId}`);
      return data;

    } catch (error) {
      console.error(`❌ Error updating workspace ${workspaceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete a workspace
   * @param {string} workspaceId - The workspace ID
   * @param {string} userId - The user ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteWorkspace(workspaceId, userId) {
    try {
      const { data, error } = await this.supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceId)
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('Error deleting workspace:', error.message);
        throw new Error(`Failed to delete workspace: ${error.message}`);
      }

      if (!data || data.length === 0) {
        console.log(`⚠️  Workspace ${workspaceId} not found for user ${userId}`);
        return false;
      }

      console.log(`✅ Deleted workspace: ${workspaceId}`);
      return true;

    } catch (error) {
      console.error(`❌ Error deleting workspace ${workspaceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Test the workspace service connection
   * @returns {Promise<boolean>} True if connection is successful
   */
  async testConnection() {
    try {
      const { data, error } = await this.supabase
        .from('workspaces')
        .select('id')
        .limit(1);

      if (error) {
        console.error('❌ Workspace service connection test failed:', error.message);
        return false;
      }

      console.log('✅ Workspace service connection test successful');
      return true;

    } catch (error) {
      console.error('❌ Workspace service connection test error:', error.message);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new WorkspaceService();

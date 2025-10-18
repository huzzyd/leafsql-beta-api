const express = require('express');
const workspaceService = require('../services/workspace');
const databaseService = require('../services/database');
const { validate } = require('../middleware/validation');
const { workspaceCreateSchema, workspaceIdParamSchema } = require('../validators/schemas');

const router = express.Router();

/**
 * GET /api/workspaces
 * Get all workspaces for authenticated user
 * 
 * Response: {
 *   workspaces: Array<{
 *     id: string,
 *     name: string,
 *     database_provider: string,
 *     description: string,
 *     status: string,
 *     created_at: string,
 *     updated_at: string
 *   }>
 * }
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    console.log(`📋 Fetching workspaces for user: ${userId}`);
    
    const workspaces = await workspaceService.getUserWorkspaces(userId);
    
    console.log(`✅ Retrieved ${workspaces.length} workspaces for user: ${userId}`);
    
    res.status(200).json({
      workspaces
    });

  } catch (error) {
    console.error('❌ Error fetching workspaces:', error.message);
    next(error);
  }
});

/**
 * POST /api/workspaces
 * Create new workspace
 * 
 * Body: {
 *   name: string,
 *   databaseProvider: string,
 *   connectionString: string,
 *   description?: string
 * }
 * 
 * Response: {
 *   workspace: {
 *     id: string,
 *     name: string,
 *     database_provider: string,
 *     connection_string: string,
 *     description: string,
 *     status: string,
 *     created_at: string,
 *     updated_at: string
 *   }
 * }
 */
router.post('/', validate(workspaceCreateSchema), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, databaseProvider, connectionString, description } = req.body;

    console.log(`🔧 Creating workspace "${name}" for user: ${userId}`);

    // Test connection before saving
    console.log(`🔌 Testing database connection...`);
    try {
      await databaseService.testConnection(connectionString);
      console.log(`✅ Database connection test successful`);
    } catch (connectionError) {
      console.error(`❌ Database connection test failed:`, connectionError.message);
      return res.status(400).json({
        error: 'Connection test failed',
        message: connectionError.message
      });
    }

    // Create workspace
    const workspace = await workspaceService.createWorkspace(userId, {
      name: name.trim(),
      databaseProvider: databaseProvider.trim(),
      connectionString: connectionString.trim(),
      description: description ? description.trim() : null
    });

    console.log(`✅ Created workspace: ${workspace.id} for user: ${userId}`);

    // Remove connection_string from response for security
    const { connection_string, ...safeWorkspace } = workspace;

    res.status(201).json({
      workspace: safeWorkspace
    });

  } catch (error) {
    console.error('❌ Error creating workspace:', error.message);
    next(error);
  }
});

/**
 * GET /api/workspaces/:id/schema
 * Get workspace schema
 * 
 * Response: {
 *   schema: {
 *     [tableName]: Array<{
 *       name: string,
 *       type: string,
 *       nullable: boolean
 *     }>
 *   }
 * }
 */
router.get('/:id/schema', validate(workspaceIdParamSchema, 'params'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const workspaceId = req.params.id;

    console.log(`📋 Fetching schema for workspace: ${workspaceId}`);

    // Get workspace and validate it belongs to user
    const workspace = await workspaceService.getWorkspace(workspaceId, userId);
    
    if (!workspace) {
      return res.status(404).json({
        error: 'Workspace not found',
        message: 'The specified workspace does not exist or you do not have access to it'
      });
    }

    // Validate workspace has required connection data
    if (!workspace.connection_string) {
      return res.status(400).json({
        error: 'Invalid workspace configuration',
        message: 'Workspace is missing database connection string'
      });
    }

    // Remove connection_string from workspace object for security
    const { connection_string, ...safeWorkspace } = workspace;

    // Get database schema
    console.log(`🔍 Retrieving schema from database...`);
    const schema = await databaseService.getSchema(workspaceId, workspace.connection_string);

    console.log(`✅ Retrieved schema for workspace ${workspaceId}: ${Object.keys(schema).length} tables`);

    res.status(200).json({
      schema
    });

  } catch (error) {
    console.error('❌ Error fetching workspace schema:', error.message);
    next(error);
  }
});

// Error handler for this router
router.use((error, req, res, next) => {
  console.error('Workspace route error:', error.message);
  
  // If response was already sent, delegate to default error handler
  if (res.headersSent) {
    return next(error);
  }

  // Return structured error response
  res.status(500).json({
    error: 'Internal Server Error',
    message: error.message
  });
});

module.exports = router;

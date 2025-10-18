const express = require('express');
const databaseService = require('../services/database');
const aiService = require('../services/ai');
const workspaceService = require('../services/workspace');
const { validate } = require('../middleware/validation');
const { queryExecuteSchema } = require('../validators/schemas');

const router = express.Router();

/**
 * POST /api/query/execute
 * Execute a natural language query against a workspace database
 * 
 * Body: {
 *   workspaceId: string,
 *   question: string
 * }
 * 
 * Response: {
 *   sql: string,
 *   explanation: string,
 *   data: Array,
 *   rowCount: number,
 *   executionTime: string
 * }
 */
router.post('/execute', validate(queryExecuteSchema), async (req, res, next) => {
  try {
    // Extract validated inputs
    const { workspaceId, question } = req.body;
    const userId = req.user.id;

    console.log(`🔍 Processing query for workspace ${workspaceId}: "${question}"`);

    // Get workspace from Supabase
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

    if (!workspace.database_provider) {
      return res.status(400).json({
        error: 'Invalid workspace configuration',
        message: 'Workspace is missing database provider information'
      });
    }

    // Remove connection_string from workspace object before any response
    // to ensure it's never included in API responses
    const { connection_string, ...safeWorkspace } = workspace;

    // Get database schema
    console.log(`📋 Retrieving schema for workspace ${workspaceId}...`);
    const schema = await databaseService.getSchema(workspaceId, workspace.connection_string);

    // Generate SQL using AI service
    console.log(`🤖 Generating SQL for question: "${question}"...`);
    const { sql, explanation } = await aiService.generateSQL(
      question, 
      schema, 
      workspace.database_provider
    );

    // Execute the generated SQL query
    console.log(`⚡ Executing SQL query...`);
    const queryResult = await databaseService.executeQuery(
      workspaceId, 
      workspace.connection_string, 
      sql
    );

    // Update workspace last used (async, don't wait)
    workspaceService.updateLastUsed(workspaceId, userId).catch(error => {
      console.warn(`⚠️  Failed to update last used for workspace ${workspaceId}:`, error.message);
    });

    // Format execution time for response
    const executionTime = `${queryResult.executionTime}ms`;

    // Return successful response
    console.log(`✅ Query executed successfully in ${executionTime}`);
    
    res.status(200).json({
      sql,
      explanation,
      data: queryResult.rows,
      rowCount: queryResult.rowCount,
      executionTime
    });

  } catch (error) {
    console.error('❌ Query execution error:', error.message);
    
    // Pass error to Express error handler
    next(error);
  }
});

module.exports = router;

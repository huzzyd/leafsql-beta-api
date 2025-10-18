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

/**
 * POST /api/query/execute/stream
 * Execute a natural language query against a workspace database with streaming response
 * 
 * Body: {
 *   workspaceId: string,
 *   question: string
 * }
 * 
 * Response: Server-Sent Events stream with events:
 * - schema: Database schema information
 * - sql: Generated SQL query (partial and final)
 * - explanation: Query explanation (partial and final)
 * - status: Processing status updates
 * - results: Query execution results
 * - complete: Stream completion
 * - error: Error information
 */
router.post('/execute/stream', validate(queryExecuteSchema), async (req, res, next) => {
  try {
    // Extract validated inputs
    const { workspaceId, question } = req.body;
    const userId = req.user.id;

    // Set up Server-Sent Events headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    console.log(`🔍 Processing streaming query for workspace ${workspaceId}: "${question}"`);

    // Get workspace from Supabase
    const workspace = await workspaceService.getWorkspace(workspaceId, userId);
    
    if (!workspace) {
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        message: 'Workspace not found or access denied' 
      })}\n\n`);
      res.end();
      return;
    }

    // Validate workspace has required connection data
    if (!workspace.connection_string) {
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        message: 'Workspace is missing database connection string' 
      })}\n\n`);
      res.end();
      return;
    }

    if (!workspace.database_provider) {
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        message: 'Workspace is missing database provider information' 
      })}\n\n`);
      res.end();
      return;
    }

    // Get database schema
    console.log(`📋 Retrieving schema for workspace ${workspaceId}...`);
    const schema = await databaseService.getSchema(workspaceId, workspace.connection_string);

    // Send schema information
    res.write(`data: ${JSON.stringify({ 
      type: 'schema', 
      message: `Found ${Object.keys(schema).length} tables in database`,
      tableCount: Object.keys(schema).length
    })}\n\n`);

    // Generate SQL with streaming
    console.log(`🤖 Starting streaming SQL generation for question: "${question}"...`);
    const stream = await aiService.generateSQLStream(
      question, 
      schema, 
      workspace.database_provider
    );
    
    let sqlBuffer = '';
    let explanationBuffer = '';
    let isSQL = false;
    let isExplanation = false;

    // Process streaming response
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      
      if (content.includes('SQL:')) {
        isSQL = true;
        isExplanation = false;
        continue;
      }
      
      if (content.includes('Explanation:')) {
        isSQL = false;
        isExplanation = true;
        continue;
      }

      if (isSQL) {
        sqlBuffer += content;
        res.write(`data: ${JSON.stringify({ 
          type: 'sql', 
          content: sqlBuffer,
          partial: true 
        })}\n\n`);
      } else if (isExplanation) {
        explanationBuffer += content;
        res.write(`data: ${JSON.stringify({ 
          type: 'explanation', 
          content: explanationBuffer,
          partial: true 
        })}\n\n`);
      }
    }

    // Validate the complete SQL
    const finalSQL = sqlBuffer.trim();
    try {
      aiService.validateSQL(finalSQL);
      
      // Send final SQL and explanation
      res.write(`data: ${JSON.stringify({ 
        type: 'sql', 
        content: finalSQL,
        partial: false 
      })}\n\n`);
      
      res.write(`data: ${JSON.stringify({ 
        type: 'explanation', 
        content: explanationBuffer.trim(),
        partial: false 
      })}\n\n`);

      // Execute the query
      res.write(`data: ${JSON.stringify({ 
        type: 'status', 
        message: 'Executing query...' 
      })}\n\n`);

      console.log(`⚡ Executing SQL query...`);
      const queryResult = await databaseService.executeQuery(
        workspaceId, 
        workspace.connection_string, 
        finalSQL
      );

      // Send results
      res.write(`data: ${JSON.stringify({ 
        type: 'results', 
        data: queryResult.rows,
        rowCount: queryResult.rowCount,
        executionTime: `${queryResult.executionTime}ms`
      })}\n\n`);

      // Update workspace last used (async, don't wait)
      workspaceService.updateLastUsed(workspaceId, userId).catch(error => {
        console.warn(`⚠️  Failed to update last used for workspace ${workspaceId}:`, error.message);
      });

      console.log(`✅ Streaming query executed successfully in ${queryResult.executionTime}ms`);
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      res.end();

    } catch (validationError) {
      console.error('❌ SQL validation failed:', validationError.message);
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        message: validationError.message 
      })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('❌ Streaming query execution error:', error.message);
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      message: error.message 
    })}\n\n`);
    res.end();
  }
});

module.exports = router;

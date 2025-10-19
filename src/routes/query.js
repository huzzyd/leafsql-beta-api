const express = require('express');
const databaseService = require('../services/database');
const aiService = require('../services/ai');
const workspaceService = require('../services/workspace');
const queryHistoryService = require('../services/queryHistory');
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

    // Save query to history (async, don't wait)
    const historyData = {
      userId,
      workspaceId,
      question,
      sql,
      explanation,
      databaseProvider: workspace.database_provider,
      executionTime: queryResult.executionTime,
      rowCount: queryResult.rowCount,
      success: true
    };

    queryHistoryService.saveQuery(historyData).catch(error => {
      console.warn(`⚠️  Failed to save query to history:`, error.message);
    });

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
    
    // Try to save failed query to history (async, don't wait)
    try {
      const { workspaceId, question } = req.body;
      const userId = req.user.id;
      
      // Get workspace info if available
      if (workspaceId && userId) {
        workspaceService.getWorkspace(workspaceId, userId).then(workspace => {
          const historyData = {
            userId,
            workspaceId,
            question,
            sql: null,
            explanation: null,
            databaseProvider: workspace?.database_provider || 'unknown',
            executionTime: 0,
            rowCount: 0,
            success: false,
            errorMessage: error.message
          };

          return queryHistoryService.saveQuery(historyData);
        }).catch(historyError => {
          console.warn(`⚠️  Failed to save failed query to history:`, historyError.message);
        });
      }
    } catch (historyError) {
      console.warn(`⚠️  Error saving failed query to history:`, historyError.message);
    }
    
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
    
    let fullResponse = '';
    let sqlBuffer = '';
    let explanationBuffer = '';
    let currentSection = null; // 'sql' or 'explanation'

    // Process streaming response
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
      
      // Check for section markers in the accumulated response
      const lowerResponse = fullResponse.toLowerCase();
      
      // Look for SQL section start
      if (lowerResponse.includes('sql:') && !sqlBuffer) {
        const sqlStart = lowerResponse.indexOf('sql:');
        const sqlContent = fullResponse.substring(sqlStart + 4);
        
        // Check if we have explanation marker to know where SQL ends
        const expStart = lowerResponse.indexOf('explanation:');
        if (expStart > sqlStart) {
          // We have both markers, extract SQL content
          sqlBuffer = sqlContent.substring(0, expStart - sqlStart - 4).trim();
          currentSection = 'explanation';
        } else {
          // Only SQL marker found, start accumulating
          currentSection = 'sql';
          sqlBuffer = sqlContent.trim();
        }
      }
      
      // Look for explanation section start
      if (lowerResponse.includes('explanation:') && !explanationBuffer) {
        const expStart = lowerResponse.indexOf('explanation:');
        explanationBuffer = fullResponse.substring(expStart + 12).trim();
        currentSection = 'explanation';
      }

      // Send streaming updates based on current section
      if (currentSection === 'sql' && sqlBuffer) {
        res.write(`data: ${JSON.stringify({ 
          type: 'sql', 
          content: sqlBuffer,
          partial: true 
        })}\n\n`);
      } else if (currentSection === 'explanation' && explanationBuffer) {
        res.write(`data: ${JSON.stringify({ 
          type: 'explanation', 
          content: explanationBuffer,
          partial: true 
        })}\n\n`);
      }
    }

    // Final parsing - extract clean SQL and explanation
    const lowerResponse = fullResponse.toLowerCase();
    const sqlStart = lowerResponse.indexOf('sql:');
    const expStart = lowerResponse.indexOf('explanation:');
    
    if (sqlStart !== -1) {
      const sqlEnd = expStart !== -1 ? expStart : fullResponse.length;
      const sqlContent = fullResponse.substring(sqlStart + 4, sqlEnd).trim();
      // Clean up SQL content (remove any remaining explanation markers)
      sqlBuffer = sqlContent.replace(/explanation:.*$/i, '').trim();
    }
    
    if (expStart !== -1) {
      explanationBuffer = fullResponse.substring(expStart + 12).trim();
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

      // Save query to history (async, don't wait)
      const historyData = {
        userId,
        workspaceId,
        question,
        sql: finalSQL,
        explanation: explanationBuffer.trim(),
        databaseProvider: workspace.database_provider,
        executionTime: queryResult.executionTime,
        rowCount: queryResult.rowCount,
        success: true
      };

      queryHistoryService.saveQuery(historyData).catch(error => {
        console.warn(`⚠️  Failed to save query to history:`, error.message);
      });

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
    
    // Try to save failed query to history (async, don't wait)
    try {
      const { workspaceId, question } = req.body;
      const userId = req.user.id;
      
      // Get workspace info if available
      if (workspaceId && userId) {
        workspaceService.getWorkspace(workspaceId, userId).then(workspace => {
          const historyData = {
            userId,
            workspaceId,
            question,
            sql: null,
            explanation: null,
            databaseProvider: workspace?.database_provider || 'unknown',
            executionTime: 0,
            rowCount: 0,
            success: false,
            errorMessage: error.message
          };

          return queryHistoryService.saveQuery(historyData);
        }).catch(historyError => {
          console.warn(`⚠️  Failed to save failed streaming query to history:`, historyError.message);
        });
      }
    } catch (historyError) {
      console.warn(`⚠️  Error saving failed streaming query to history:`, historyError.message);
    }
    
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      message: error.message 
    })}\n\n`);
    res.end();
  }
});

module.exports = router;

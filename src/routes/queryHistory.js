const express = require('express');
const queryHistoryService = require('../services/queryHistory');
const { validate } = require('../middleware/validation');
const { queryHistoryGetSchema, queryHistoryIdParamSchema } = require('../validators/schemas');

const router = express.Router();

/**
 * GET /api/query/history
 * Get query history for authenticated user
 * 
 * Query Parameters:
 * - workspaceId: string (optional) - Filter by workspace
 * - limit: number (optional, default: 50) - Number of results to return
 * - offset: number (optional, default: 0) - Offset for pagination
 * - favoritesOnly: boolean (optional) - Only return favorite queries
 * 
 * Response: {
 *   queries: Array<{
 *     id: string,
 *     workspace_id: string,
 *     question: string,
 *     sql_query: string,
 *     explanation: string,
 *     database_provider: string,
 *     execution_time_ms: number,
 *     row_count: number,
 *     success: boolean,
 *     error_message: string|null,
 *     is_favorite: boolean,
 *     created_at: string,
 *     workspaces: { name: string, database_provider: string }
 *   }>,
 *   total: number,
 *   limit: number,
 *   offset: number
 * }
 */
router.get('/', validate(queryHistoryGetSchema, 'query'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      workspaceId,
      limit = 50,
      offset = 0,
      favoritesOnly = false
    } = req.query;

    console.log(`📋 Fetching query history for user: ${userId}`);

    const options = {
      workspaceId,
      limit: parseInt(limit),
      offset: parseInt(offset),
      favoritesOnly: favoritesOnly === 'true'
    };

    const queries = await queryHistoryService.getUserQueryHistory(userId, options);

    console.log(`✅ Retrieved ${queries.length} query history records for user: ${userId}`);

    res.status(200).json({
      queries,
      total: queries.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('❌ Error fetching query history:', error.message);
    next(error);
  }
});

/**
 * GET /api/query/history/:id
 * Get a specific query history record
 * 
 * Response: {
 *   query: {
 *     id: string,
 *     workspace_id: string,
 *     question: string,
 *     sql_query: string,
 *     explanation: string,
 *     database_provider: string,
 *     execution_time_ms: number,
 *     row_count: number,
 *     success: boolean,
 *     error_message: string|null,
 *     is_favorite: boolean,
 *     created_at: string,
 *     workspaces: { name: string, database_provider: string }
 *   }
 * }
 */
router.get('/:id', validate(queryHistoryIdParamSchema, 'params'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const queryId = req.params.id;

    console.log(`📋 Fetching query: ${queryId} for user: ${userId}`);

    const query = await queryHistoryService.getQuery(queryId, userId);

    console.log(`✅ Retrieved query: ${queryId} for user: ${userId}`);

    res.status(200).json({
      query
    });

  } catch (error) {
    console.error('❌ Error fetching query:', error.message);
    
    if (error.message === 'Query not found') {
      return res.status(404).json({
        error: 'Query not found',
        message: 'The specified query does not exist or you do not have access to it'
      });
    }
    
    next(error);
  }
});

/**
 * PUT /api/query/history/:id/favorite
 * Toggle favorite status of a query
 * 
 * Body: {
 *   isFavorite: boolean
 * }
 * 
 * Response: {
 *   query: {
 *     id: string,
 *     is_favorite: boolean,
 *     // ... other query fields
 *   }
 * }
 */
router.put('/:id/favorite', validate(queryHistoryIdParamSchema, 'params'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const queryId = req.params.id;
    const { isFavorite } = req.body;

    if (typeof isFavorite !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'isFavorite must be a boolean value'
      });
    }

    console.log(`⭐ ${isFavorite ? 'Adding' : 'Removing'} favorite for query: ${queryId} for user: ${userId}`);

    const query = await queryHistoryService.toggleFavorite(queryId, userId, isFavorite);

    console.log(`✅ Updated favorite status for query: ${queryId} to ${isFavorite}`);

    res.status(200).json({
      query
    });

  } catch (error) {
    console.error('❌ Error updating favorite status:', error.message);
    
    if (error.message === 'Query not found') {
      return res.status(404).json({
        error: 'Query not found',
        message: 'The specified query does not exist or you do not have access to it'
      });
    }
    
    next(error);
  }
});

/**
 * DELETE /api/query/history/:id
 * Delete a query from history
 * 
 * Response: {
 *   message: string,
 *   deleted: boolean
 * }
 */
router.delete('/:id', validate(queryHistoryIdParamSchema, 'params'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const queryId = req.params.id;

    console.log(`🗑️  Deleting query: ${queryId} for user: ${userId}`);

    const deleted = await queryHistoryService.deleteQuery(queryId, userId);

    if (!deleted) {
      return res.status(404).json({
        error: 'Query not found',
        message: 'The specified query does not exist or you do not have access to it'
      });
    }

    console.log(`✅ Deleted query: ${queryId} for user: ${userId}`);

    res.status(200).json({
      message: 'Query deleted successfully',
      deleted: true
    });

  } catch (error) {
    console.error('❌ Error deleting query:', error.message);
    next(error);
  }
});

/**
 * GET /api/query/history/stats
 * Get query statistics for authenticated user
 * 
 * Query Parameters:
 * - workspaceId: string (optional) - Filter by workspace
 * - days: number (optional, default: 30) - Number of days to look back
 * 
 * Response: {
 *   statistics: {
 *     totalQueries: number,
 *     successfulQueries: number,
 *     failedQueries: number,
 *     successRate: number,
 *     averageExecutionTime: number,
 *     totalRowsReturned: number,
 *     providerStats: { [provider: string]: number },
 *     periodDays: number
 *   }
 * }
 */
router.get('/stats', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { workspaceId, days = 30 } = req.query;

    console.log(`📊 Fetching query statistics for user: ${userId}`);

    const options = {
      workspaceId,
      days: parseInt(days)
    };

    const statistics = await queryHistoryService.getQueryStatistics(userId, options);

    console.log(`✅ Retrieved query statistics for user: ${userId}`);

    res.status(200).json({
      statistics
    });

  } catch (error) {
    console.error('❌ Error fetching query statistics:', error.message);
    next(error);
  }
});

// Error handler for this router
router.use((error, req, res, next) => {
  console.error('Query history route error:', error.message);
  
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

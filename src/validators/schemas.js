const Joi = require('joi');

/**
 * Validation schemas for API endpoints
 */

// Query execution schemas
const queryExecuteSchema = Joi.object({
  workspaceId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'workspaceId must be a valid UUID',
      'any.required': 'workspaceId is required'
    }),
  question: Joi.string().min(1).max(500).trim().required()
    .messages({
      'string.min': 'question must be at least 1 character long',
      'string.max': 'question must be 500 characters or less',
      'any.required': 'question is required',
      'string.empty': 'question must be at least 1 character long'
    })
});

// Workspace schemas
const workspaceCreateSchema = Joi.object({
  name: Joi.string().min(1).max(100).trim().required()
    .messages({
      'string.min': 'name must be at least 1 character long',
      'string.max': 'name must be 100 characters or less',
      'any.required': 'name is required',
      'string.empty': 'name must be at least 1 character long'
    }),
  databaseProvider: Joi.string().valid('postgresql', 'mysql').required()
    .messages({
      'any.only': 'databaseProvider must be either "postgresql" or "mysql"',
      'any.required': 'databaseProvider is required'
    }),
  connectionString: Joi.string().min(1).trim().required()
    .messages({
      'string.min': 'connectionString cannot be empty',
      'any.required': 'connectionString is required',
      'string.empty': 'connectionString cannot be empty'
    }),
  description: Joi.string().max(500).optional().allow('').trim()
    .messages({
      'string.max': 'description must be 500 characters or less'
    })
});

const workspaceIdParamSchema = Joi.object({
  id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'workspaceId must be a valid UUID',
      'any.required': 'workspaceId is required',
      'string.base': 'workspaceId must be a valid UUID'
    })
});

// Query history schemas
const queryHistoryGetSchema = Joi.object({
  workspaceId: Joi.string().uuid().optional()
    .messages({
      'string.guid': 'workspaceId must be a valid UUID'
    }),
  limit: Joi.number().integer().min(1).max(100).optional()
    .messages({
      'number.base': 'limit must be a number',
      'number.integer': 'limit must be an integer',
      'number.min': 'limit must be at least 1',
      'number.max': 'limit must be 100 or less'
    }),
  offset: Joi.number().integer().min(0).optional()
    .messages({
      'number.base': 'offset must be a number',
      'number.integer': 'offset must be an integer',
      'number.min': 'offset must be 0 or greater'
    }),
  favoritesOnly: Joi.string().valid('true', 'false').optional()
    .messages({
      'any.only': 'favoritesOnly must be either "true" or "false"'
    })
});

const queryHistoryIdParamSchema = Joi.object({
  id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'queryId must be a valid UUID',
      'any.required': 'queryId is required',
      'string.base': 'queryId must be a valid UUID'
    })
});

const queryHistoryStatsSchema = Joi.object({
  workspaceId: Joi.string().uuid().optional()
    .messages({
      'string.guid': 'workspaceId must be a valid UUID'
    }),
  days: Joi.number().integer().min(1).max(365).optional()
    .messages({
      'number.base': 'days must be a number',
      'number.integer': 'days must be an integer',
      'number.min': 'days must be at least 1',
      'number.max': 'days must be 365 or less'
    })
});

module.exports = {
  queryExecuteSchema,
  workspaceCreateSchema,
  workspaceIdParamSchema,
  queryHistoryGetSchema,
  queryHistoryIdParamSchema,
  queryHistoryStatsSchema
};

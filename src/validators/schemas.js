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

module.exports = {
  queryExecuteSchema,
  workspaceCreateSchema,
  workspaceIdParamSchema
};

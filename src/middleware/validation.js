const Joi = require('joi');

/**
 * Validation middleware factory
 * @param {Object} schema - Joi schema object
 * @param {string} property - Property to validate ('body', 'params', 'query')
 * @returns {Function} Express middleware function
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Return all validation errors
      stripUnknown: true, // Remove unknown properties
      allowUnknown: false // Don't allow unknown properties
    });

    if (error) {
      const errorDetails = error.details.map(detail => detail.message);
      
      return res.status(400).json({
        error: 'Validation Error',
        details: errorDetails
      });
    }

    // Replace the original property with the validated and sanitized value
    req[property] = value;
    next();
  };
};

module.exports = {
  validate
};

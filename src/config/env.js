require('dotenv').config();

/**
 * Environment configuration with validation
 * Validates required environment variables and provides typed access
 */

const requiredEnvVars = {
  NODE_ENV: 'string',
  ALLOWED_ORIGINS: 'string',
  SUPABASE_URL: 'string',
  SUPABASE_SERVICE_ROLE_KEY: 'string'
};

const optionalEnvVars = {
  PORT: 'number',
  OPENAI_API_KEY: 'string',
  ANTHROPIC_API_KEY: 'string'
};

/**
 * Validates that a required environment variable exists
 * @param {string} varName - The environment variable name
 * @param {string} type - Expected type ('string' or 'number')
 */
function validateRequiredVar(varName, type) {
  const value = process.env[varName];
  
  if (!value) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
  
  if (type === 'number') {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) {
      throw new Error(`Environment variable ${varName} must be a valid number, got: ${value}`);
    }
    return numValue;
  }
  
  return value;
}

/**
 * Validates an optional environment variable
 * @param {string} varName - The environment variable name
 * @param {string} type - Expected type ('string' or 'number')
 * @param {any} defaultValue - Default value if not provided
 */
function validateOptionalVar(varName, type, defaultValue = undefined) {
  const value = process.env[varName];
  
  if (!value) {
    return defaultValue;
  }
  
  if (type === 'number') {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) {
      throw new Error(`Environment variable ${varName} must be a valid number, got: ${value}`);
    }
    return numValue;
  }
  
  return value;
}

/**
 * Validates that at least one AI API key is provided
 */
function validateAIApiKeys() {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  
  if (!openaiKey && !anthropicKey) {
    throw new Error('At least one AI API key is required: OPENAI_API_KEY or ANTHROPIC_API_KEY');
  }
}

// Validate all required environment variables
const config = {};

// Validate required variables
for (const [varName, type] of Object.entries(requiredEnvVars)) {
  config[varName] = validateRequiredVar(varName, type);
}

// Validate optional variables
for (const [varName, type] of Object.entries(optionalEnvVars)) {
  if (varName === 'PORT') {
    config[varName] = validateOptionalVar(varName, type, 3001);
  } else {
    config[varName] = validateOptionalVar(varName, type);
  }
}

// Validate AI API keys
validateAIApiKeys();

// Parse ALLOWED_ORIGINS into an array
config.ALLOWED_ORIGINS_ARRAY = config.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());

// Add validation status
config.isValid = true;

module.exports = config;

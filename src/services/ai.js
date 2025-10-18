const OpenAI = require('openai');
const config = require('../config/env');

/**
 * AI Service for SQL Generation
 * Uses OpenAI's GPT-4o-mini to generate SQL queries from natural language
 */

class AIService {
  constructor() {
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY
    });
  }

  /**
   * Format database schema object into readable text format
   * @param {Object} schema - Schema object from database.js format
   * @returns {string} Formatted schema text
   */
  formatSchema(schema) {
    if (!schema || typeof schema !== 'object') {
      throw new Error('Schema must be a valid object');
    }

    let formattedSchema = '';
    
    for (const [tableName, columns] of Object.entries(schema)) {
      if (!Array.isArray(columns)) {
        throw new Error(`Invalid schema format: table ${tableName} columns must be an array`);
      }

      formattedSchema += `Table: ${tableName}\n`;
      
      columns.forEach(column => {
        if (!column.name || !column.type) {
          throw new Error(`Invalid column format in table ${tableName}: missing name or type`);
        }
        
        const nullable = column.nullable ? 'nullable' : 'not null';
        formattedSchema += `  - ${column.name} (${column.type}) ${nullable}\n`;
      });
      
      formattedSchema += '\n';
    }

    return formattedSchema.trim();
  }

  /**
   * Validate SQL query for security threats
   * @param {string} sql - SQL query to validate
   * @throws {Error} If dangerous SQL is detected
   */
  validateSQL(sql) {
    if (!sql || typeof sql !== 'string') {
      throw new Error('SQL query must be a non-empty string');
    }

    const trimmedSQL = sql.trim().toLowerCase();
    
    // Check if query starts with SELECT
    if (!trimmedSQL.startsWith('select')) {
      throw new Error('Only SELECT queries are allowed');
    }

    // Define dangerous SQL keywords to block
    const dangerousKeywords = [
      'drop', 'delete', 'insert', 'update', 'alter', 'truncate',
      'create', 'grant', 'revoke', 'exec', 'execute', 'sp_',
      'xp_', 'backup', 'restore', 'shutdown', 'kill', 'dbcc',
      'bulk', 'openrowset', 'opendatasource', 'union all'
    ];

    // Check for dangerous keywords (case-insensitive)
    for (const keyword of dangerousKeywords) {
      // Use word boundary regex to avoid false positives
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(sql)) {
        throw new Error(`Dangerous SQL keyword detected: ${keyword.toUpperCase()}. Only SELECT queries are allowed.`);
      }
    }

    // Check for SQL injection patterns
    const injectionPatterns = [
      /;\s*drop/i,
      /;\s*delete/i,
      /;\s*insert/i,
      /;\s*update/i,
      /union\s+select/i,
      /or\s+1\s*=\s*1/i,
      /and\s+1\s*=\s*1/i,
      /'\s*or\s*'\s*x\s*'\s*=\s*'\s*x/i,
      /'\s*or\s*1\s*=\s*1\s*--/i,
      /'\s*or\s*1\s*=\s*1\s*#/i,
      /'\s*or\s*1\s*=\s*1\s*\/\*/i
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(sql)) {
        throw new Error('Potential SQL injection detected. Query blocked for security.');
      }
    }

    console.log('✅ SQL validation passed - query is safe');
  }

  /**
   * Generate SQL query from natural language question and database schema
   * @param {string} question - Natural language question
   * @param {Object} schema - Database schema object
   * @param {string} databaseType - Database type (default: 'postgresql')
   * @returns {Promise<Object>} Object with sql and explanation
   */
  async generateSQL(question, schema, databaseType = 'postgresql') {
    try {
      // Validate inputs
      if (!question || typeof question !== 'string') {
        throw new Error('Question must be a non-empty string');
      }

      if (!schema || typeof schema !== 'object') {
        throw new Error('Schema must be a valid object');
      }

      if (!config.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required but not configured');
      }

      // Format schema for prompt
      const formattedSchema = this.formatSchema(schema);

      // Construct system prompt
      const systemPrompt = `You are a SQL expert. Generate a ${databaseType} SQL query based on the user's question and the provided database schema.

Database Schema:
${formattedSchema}

Rules:
1. Generate ONLY SELECT queries (no INSERT, UPDATE, DELETE, DROP, etc.)
2. Use exact table and column names from the schema provided
3. Use proper ${databaseType} syntax
4. Include appropriate WHERE clauses when filtering is needed
5. Use proper JOIN syntax when querying multiple tables
6. Add comments to explain complex logic
7. Do not include any dangerous SQL keywords or injection patterns
8. Keep queries simple and focused on data retrieval

Respond with a JSON object in this exact format:
{
  "sql": "SELECT * FROM table_name WHERE condition;",
  "explanation": "Brief explanation of what this query does"
}`;

      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: question
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      // Parse response
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content received from OpenAI');
      }

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(content);
      } catch (parseError) {
        throw new Error(`Failed to parse OpenAI response as JSON: ${parseError.message}`);
      }

      // Validate response format
      if (!parsedResponse.sql || !parsedResponse.explanation) {
        throw new Error('OpenAI response missing required fields: sql and explanation');
      }

      // Validate SQL for security threats
      this.validateSQL(parsedResponse.sql);

      const sql = parsedResponse.sql.trim();

      console.log(`🤖 Generated SQL for question: "${question}"`);
      console.log(`📝 SQL: ${sql}`);
      console.log(`💡 Explanation: ${parsedResponse.explanation}`);

      return {
        sql,
        explanation: parsedResponse.explanation
      };

    } catch (error) {
      console.error('❌ AI service error:', error.message);
      
      // Provide descriptive error messages
      if (error.code === 'insufficient_quota') {
        throw new Error('OpenAI API quota exceeded - check your billing');
      } else if (error.code === 'invalid_api_key') {
        throw new Error('Invalid OpenAI API key - check your configuration');
      } else if (error.code === 'rate_limit_exceeded') {
        throw new Error('OpenAI API rate limit exceeded - please try again later');
      } else if (error.message.includes('timeout')) {
        throw new Error('OpenAI API request timed out - please try again');
      } else {
        throw new Error(`AI service error: ${error.message}`);
      }
    }
  }
}

// Export singleton instance
module.exports = new AIService();

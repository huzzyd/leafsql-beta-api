# Query Execution Endpoint

## Overview

The query execution endpoint (`POST /api/query/execute`) is the main API endpoint that allows users to execute natural language queries against their workspace databases. It combines AI-powered SQL generation with database execution to provide a seamless query experience.

## Endpoint Details

- **URL**: `POST /api/query/execute`
- **Authentication**: Required (Bearer token)
- **Content-Type**: `application/json`

## Request Format

```json
{
  "workspaceId": "string",
  "question": "string"
}
```

### Parameters

- `workspaceId` (required): The ID of the workspace containing the target database
- `question` (required): Natural language question describing what data to retrieve

## Response Format

```json
{
  "sql": "SELECT * FROM users WHERE is_active = true;",
  "explanation": "This query retrieves all active users from the users table",
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "is_active": true
    }
  ],
  "rowCount": 1,
  "executionTime": "125ms"
}
```

### Response Fields

- `sql`: The generated SQL query
- `explanation`: Human-readable explanation of what the query does
- `data`: Array of result rows from the database
- `rowCount`: Number of rows returned
- `executionTime`: Time taken to execute the query (in milliseconds)

## How It Works

1. **Authentication**: Verifies the user's JWT token
2. **Input Validation**: Validates required parameters
3. **Workspace Retrieval**: Fetches workspace details from Supabase
4. **Schema Discovery**: Retrieves database schema using `databaseService.getSchema()`
5. **AI SQL Generation**: Uses OpenAI to generate SQL from natural language
6. **Query Execution**: Executes the generated SQL using `databaseService.executeQuery()`
7. **Response Formatting**: Returns structured response with results and metadata
8. **Workspace Update**: Updates workspace last used timestamp (async)

## Error Handling

The endpoint handles various error scenarios:

### 400 Bad Request
- Missing or invalid `workspaceId`
- Missing or empty `question`
- Invalid parameter types

### 401 Unauthorized
- Missing authentication token
- Invalid authentication token
- Malformed authorization header

### 404 Not Found
- Workspace doesn't exist
- User doesn't have access to workspace

### 500 Internal Server Error
- Database connection issues
- AI service errors
- Unexpected server errors

## Example Usage

### cURL Example

```bash
curl -X POST http://localhost:3001/api/query/execute \
  -H "Authorization: Bearer your-supabase-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "workspace-123",
    "question": "Show me all active users"
  }'
```

### JavaScript Example

```javascript
const response = await fetch('http://localhost:3001/api/query/execute', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-supabase-jwt-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    workspaceId: 'workspace-123',
    question: 'Show me all active users'
  })
});

const data = await response.json();
console.log('Generated SQL:', data.sql);
console.log('Results:', data.data);
```

## Testing

### Test Scripts

1. **Basic Structure Test**: `tests/test-query-endpoint-simple.js`
   - Tests authentication and basic error handling
   - No database connection required

2. **Complete Functionality Test**: `tests/test-query-endpoint-complete.js`
   - Tests full query execution flow
   - Requires valid workspace and database connection

### Running Tests

```bash
# Start the server
npm start

# Run basic tests (in another terminal)
node tests/test-query-endpoint-simple.js

# Run complete tests (requires setup)
node tests/test-query-endpoint-complete.js
```

## Dependencies

The endpoint relies on several services:

- **Authentication Middleware**: Verifies Supabase JWT tokens
- **Workspace Service**: Manages workspace metadata
- **Database Service**: Handles database connections and queries
- **AI Service**: Generates SQL from natural language

## Security Considerations

- All requests require valid authentication
- Users can only access their own workspaces
- Only SELECT queries are generated (no data modification)
- Database connections are pooled and managed securely
- Input validation prevents injection attacks

## Performance

- Database connection pooling for efficient resource usage
- Async workspace updates don't block response
- Query execution timeouts prevent long-running queries
- AI service uses efficient GPT-4o-mini model

## Monitoring

The endpoint logs important events:
- Query processing start/completion
- Database connection status
- AI service interactions
- Error conditions and stack traces

## Future Enhancements

- Query result caching
- Query history tracking
- Advanced query optimization
- Real-time query monitoring
- Query performance analytics

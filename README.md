# LeafSQL Beta API

A Node.js Express API server that provides natural language to SQL query functionality with AI-powered query generation and secure database connectivity.

## Features

- 🤖 **AI-Powered SQL Generation** - Convert natural language to SQL using OpenAI
- 🔒 **Secure Authentication** - JWT token-based authentication via Supabase
- 🛡️ **Security Features** - SQL injection protection, connection string masking, query size limits
- 🗄️ **Multi-Database Support** - Connect to various database providers (PostgreSQL, MySQL, etc.)
- 📊 **Real-time Schema Analysis** - Automatic database schema detection and validation
- 🚀 **Production Ready** - Comprehensive error handling, logging, and monitoring

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm
- OpenAI API key
- Supabase project

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your configuration

### Running the Server

#### Development
```bash
npm run dev
```

#### Production
```bash
npm start
```

The server will start on port 3001 (or the port specified in your `.env` file).

## API Endpoints

### Health Check
- `GET /health` - Health check endpoint that returns `{ status: 'ok' }`

### Authentication
All API endpoints (except `/health`) require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Query Execution

#### `POST /api/query/execute`
Execute natural language queries against workspace databases.

**Request Body:**
```json
{
  "workspaceId": "string (UUID)",
  "question": "string"
}
```

**Response:**
```json
{
  "sql": "SELECT COUNT(*) FROM users",
  "explanation": "This query counts all users in the database",
  "data": [{"count": 42}],
  "rowCount": 1,
  "executionTime": "45ms"
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/query/execute \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "dcdcdee9-d7b8-43a2-bd80-cfb93f8cabe1",
    "question": "How many users are in the database?"
  }'
```

### Workspace Management

#### `GET /api/workspaces`
Get all workspaces for authenticated user.

**Response:**
```json
{
  "workspaces": [
    {
      "id": "dcdcdee9-d7b8-43a2-bd80-cfb93f8cabe1",
      "name": "My Database",
      "database_provider": "postgresql",
      "description": "Production database",
      "status": "active",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### `POST /api/workspaces`
Create new workspace.

**Request Body:**
```json
{
  "name": "string",
  "databaseProvider": "postgresql|mysql|sqlite",
  "connectionString": "string",
  "description": "string (optional)"
}
```

**Response:**
```json
{
  "workspace": {
    "id": "dcdcdee9-d7b8-43a2-bd80-cfb93f8cabe1",
    "name": "My Database",
    "database_provider": "postgresql",
    "description": "Production database",
    "status": "active",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

#### `GET /api/workspaces/:id/schema`
Get workspace database schema.

**Response:**
```json
{
  "schema": {
    "users": [
      {"name": "id", "type": "integer", "nullable": false},
      {"name": "email", "type": "varchar", "nullable": false},
      {"name": "created_at", "type": "timestamp", "nullable": true}
    ],
    "orders": [
      {"name": "id", "type": "integer", "nullable": false},
      {"name": "user_id", "type": "integer", "nullable": false},
      {"name": "total", "type": "decimal", "nullable": false}
    ]
  }
}
```

## Error Handling

All API endpoints return structured error responses:

```json
{
  "error": "Error Type",
  "message": "Detailed error message"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing JWT token)
- `404` - Not Found (workspace not found)
- `500` - Internal Server Error

## Security Features

### SQL Injection Protection
- ✅ **Query Validation** - All generated SQL is validated for dangerous keywords
- ✅ **SELECT Only** - Only SELECT queries are allowed (no DDL/DML operations)
- ✅ **Pattern Detection** - Common SQL injection patterns are blocked

### Connection String Security
- ✅ **Never Logged** - Connection strings are never logged in plain text
- ✅ **Masked in Errors** - Connection strings are masked in error messages
- ✅ **Never in Responses** - Connection strings are never included in API responses

### Query Limits
- ✅ **Row Limits** - Maximum 10,000 rows per query result
- ✅ **Pagination Suggested** - Errors suggest pagination for large result sets

## Environment Variables

Required environment variables:

```bash
# Server Configuration
PORT=3001
NODE_ENV=production

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Supabase Configuration
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# CORS Configuration
ALLOWED_ORIGINS=https://your-frontend-domain.com,http://localhost:3000
```

### Project Structure

```
leafsql-beta-api/
├── src/
│   ├── index.js              # Main server file
│   ├── config/
│   │   ├── env.js            # Environment configuration
│   │   └── supabase.js       # Supabase client configuration
│   ├── middleware/
│   │   ├── auth.js           # JWT authentication middleware
│   │   ├── errorHandler.js   # Global error handling
│   │   └── validation.js     # Request validation middleware
│   ├── routes/
│   │   ├── query.js          # Query execution endpoints
│   │   └── workspace.js      # Workspace management endpoints
│   ├── services/
│   │   ├── ai.js             # OpenAI integration service
│   │   ├── database.js       # Database connection service
│   │   └── workspace.js      # Workspace management service
│   └── validators/
│       └── schemas.js        # Joi validation schemas
├── tests/
│   ├── test-real-end-to-end.js  # Real end-to-end tests
│   └── env.test.template       # Test environment template
├── .env.example               # Environment variables template
├── package.json              # Project dependencies and scripts
└── README.md                 # This file
```

## Testing

Run the real end-to-end test with actual data:

```bash
# Set up test environment
cp tests/env.test.template .env.test
# Edit .env.test with your real values

# Run the test
node tests/test-real-end-to-end.js
```

## License

ISC

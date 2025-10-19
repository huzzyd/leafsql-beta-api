# LeafSQL Beta API - Frontend Integration Guide

## 🚀 API Base URL
```
https://leafsql-beta-api.onrender.com
```

## 📋 Table of Contents
1. [Authentication](#authentication)
2. [API Endpoints](#api-endpoints)
3. [Request/Response Examples](#requestresponse-examples)
4. [Error Handling](#error-handling)
5. [TypeScript Types](#typescript-types)
6. [Integration Checklist](#integration-checklist)

---

## 🔐 Authentication

All API endpoints (except `/health`) require JWT authentication via Supabase.

### Headers Required:
```javascript
{
  "Authorization": "Bearer YOUR_SUPABASE_JWT_TOKEN",
  "Content-Type": "application/json"
}
```

### Getting the JWT Token:
```javascript
// From Supabase Auth
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

---

## 📡 API Endpoints

### 1. Health Check
**No authentication required**

```http
GET /health
```

**Response:**
```json
{
  "status": "ok"
}
```

---

### 2. Query Execution (Regular)

```http
POST /api/query/execute
```

**Request Body:**
```json
{
  "workspaceId": "uuid-string",
  "question": "How many users are in the database?"
}
```

**Response:**
```json
{
  "sql": "SELECT COUNT(*) FROM users;",
  "explanation": "This query counts all rows in the users table",
  "data": [{ "count": 42 }],
  "rowCount": 1,
  "executionTime": "45ms"
}
```

---

### 3. Query Execution (Streaming)

```http
POST /api/query/execute/stream
```

**Request Body:**
```json
{
  "workspaceId": "uuid-string",
  "question": "Show me all active users"
}
```

**Response:** Server-Sent Events (SSE) stream

**Event Types:**
```javascript
// Schema event
{
  "type": "schema",
  "message": "Found 7 tables in database",
  "tableCount": 7
}

// SQL event (partial and final)
{
  "type": "sql",
  "content": "SELECT * FROM users WHERE active = true;",
  "partial": false
}

// Explanation event
{
  "type": "explanation",
  "content": "This query retrieves all active users",
  "partial": false
}

// Status event
{
  "type": "status",
  "message": "Executing query..."
}

// Results event
{
  "type": "results",
  "data": [...],
  "rowCount": 10,
  "executionTime": "23ms"
}

// Complete event
{
  "type": "complete"
}

// Error event
{
  "type": "error",
  "message": "Error message here"
}
```

---

### 4. Workspace Management

#### Get All Workspaces
```http
GET /api/workspaces
```

**Response:**
```json
{
  "workspaces": [
    {
      "id": "uuid",
      "name": "Production DB",
      "database_provider": "postgresql",
      "description": "Main production database",
      "status": "active",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### Create Workspace
```http
POST /api/workspaces
```

**Request Body:**
```json
{
  "name": "My Database",
  "databaseProvider": "postgresql",
  "connectionString": "postgresql://user:pass@host:5432/dbname",
  "description": "Optional description"
}
```

**Response:**
```json
{
  "workspace": {
    "id": "uuid",
    "name": "My Database",
    "database_provider": "postgresql",
    "description": "Optional description",
    "status": "active",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

#### Get Workspace Schema
```http
GET /api/workspaces/:id/schema
```

**Response:**
```json
{
  "schema": {
    "users": [
      {
        "name": "id",
        "type": "uuid",
        "nullable": false
      },
      {
        "name": "email",
        "type": "varchar",
        "nullable": false
      }
    ],
    "orders": [...]
  }
}
```

---

### 5. Query History

#### Get Query History
```http
GET /api/query/history?limit=50&offset=0&workspaceId=uuid&favoritesOnly=false
```

**Query Parameters:**
- `limit` (optional, default: 50, max: 100) - Number of results
- `offset` (optional, default: 0) - Pagination offset
- `workspaceId` (optional) - Filter by workspace
- `favoritesOnly` (optional) - Only return favorites

**Response:**
```json
{
  "queries": [
    {
      "id": "uuid",
      "workspace_id": "uuid",
      "question": "How many users?",
      "sql_query": "SELECT COUNT(*) FROM users;",
      "explanation": "Counts all users",
      "database_provider": "postgresql",
      "execution_time_ms": 45,
      "row_count": 1,
      "success": true,
      "error_message": null,
      "is_favorite": false,
      "created_at": "2025-01-01T00:00:00Z",
      "workspaces": {
        "name": "Production DB",
        "database_provider": "postgresql"
      }
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

#### Get Single Query
```http
GET /api/query/history/:id
```

**Response:**
```json
{
  "query": {
    "id": "uuid",
    "workspace_id": "uuid",
    "question": "How many users?",
    "sql_query": "SELECT COUNT(*) FROM users;",
    "explanation": "Counts all users",
    "database_provider": "postgresql",
    "execution_time_ms": 45,
    "row_count": 1,
    "success": true,
    "error_message": null,
    "is_favorite": false,
    "created_at": "2025-01-01T00:00:00Z",
    "workspaces": {
      "name": "Production DB",
      "database_provider": "postgresql"
    }
  }
}
```

#### Toggle Favorite
```http
PUT /api/query/history/:id/favorite
```

**Request Body:**
```json
{
  "isFavorite": true
}
```

**Response:**
```json
{
  "query": {
    "id": "uuid",
    "is_favorite": true,
    ...
  }
}
```

#### Delete Query
```http
DELETE /api/query/history/:id
```

**Response:**
```json
{
  "message": "Query deleted successfully",
  "deleted": true
}
```

#### Get Query Statistics
```http
GET /api/query/history/stats?workspaceId=uuid&days=30
```

**Query Parameters:**
- `workspaceId` (optional) - Filter by workspace
- `days` (optional, default: 30, max: 365) - Days to look back

**Response:**
```json
{
  "statistics": {
    "totalQueries": 150,
    "successfulQueries": 145,
    "failedQueries": 5,
    "successRate": 97,
    "averageExecutionTime": 125,
    "totalRowsReturned": 5432,
    "providerStats": {
      "postgresql": 120,
      "mysql": 30
    },
    "periodDays": 30
  }
}
```

---

## 🚨 Error Handling

### Error Response Format:
```json
{
  "error": "Error Type",
  "message": "Detailed error message"
}
```

### Common HTTP Status Codes:
- `200` - Success
- `201` - Created (workspace creation)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

### Example Error Responses:

**401 Unauthorized:**
```json
{
  "error": "Authentication required",
  "message": "No authorization header provided"
}
```

**400 Bad Request:**
```json
{
  "error": "Validation error",
  "message": "workspaceId must be a valid UUID"
}
```

**404 Not Found:**
```json
{
  "error": "Workspace not found",
  "message": "The specified workspace does not exist or you do not have access to it"
}
```

---

## 📝 TypeScript Types

```typescript
// Query Execution
interface QueryExecuteRequest {
  workspaceId: string;
  question: string;
}

interface QueryExecuteResponse {
  sql: string;
  explanation: string;
  data: any[];
  rowCount: number;
  executionTime: string;
}

// Streaming Events
type StreamEventType = 'schema' | 'sql' | 'explanation' | 'status' | 'results' | 'complete' | 'error';

interface StreamEvent {
  type: StreamEventType;
  message?: string;
  content?: string;
  partial?: boolean;
  data?: any[];
  rowCount?: number;
  executionTime?: string;
  tableCount?: number;
}

// Workspace
interface Workspace {
  id: string;
  name: string;
  database_provider: 'postgresql' | 'mysql';
  description: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

interface CreateWorkspaceRequest {
  name: string;
  databaseProvider: 'postgresql' | 'mysql';
  connectionString: string;
  description?: string;
}

interface WorkspaceSchema {
  [tableName: string]: {
    name: string;
    type: string;
    nullable: boolean;
  }[];
}

// Query History
interface QueryHistory {
  id: string;
  workspace_id: string;
  question: string;
  sql_query: string | null;
  explanation: string | null;
  database_provider: string;
  execution_time_ms: number;
  row_count: number;
  success: boolean;
  error_message: string | null;
  is_favorite: boolean;
  created_at: string;
  workspaces?: {
    name: string;
    database_provider: string;
  };
}

interface QueryHistoryParams {
  limit?: number;
  offset?: number;
  workspaceId?: string;
  favoritesOnly?: boolean;
}

interface QueryStatistics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  successRate: number;
  averageExecutionTime: number;
  totalRowsReturned: number;
  providerStats: Record<string, number>;
  periodDays: number;
}

// API Client
interface ApiError {
  error: string;
  message: string;
}
```

---

## 🔧 Example API Client Implementation

```typescript
import { createClient } from '@supabase/supabase-js';

const API_BASE_URL = 'https://leafsql-beta-api.onrender.com';

class LeafSQLApiClient {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  private async getAuthHeaders() {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No active session');
    }
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }

  // Query Execution
  async executeQuery(workspaceId: string, question: string): Promise<QueryExecuteResponse> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/query/execute`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ workspaceId, question }),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.message);
    }

    return response.json();
  }

  // Streaming Query Execution
  async executeQueryStream(
    workspaceId: string,
    question: string,
    onEvent: (event: StreamEvent) => void
  ): Promise<void> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/query/execute/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ workspaceId, question }),
    });

    if (!response.ok) {
      throw new Error('Stream request failed');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('No reader available');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const event: StreamEvent = JSON.parse(data);
            onEvent(event);
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
      }
    }
  }

  // Workspace Management
  async getWorkspaces(): Promise<Workspace[]> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/workspaces`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    return data.workspaces;
  }

  async createWorkspace(workspace: CreateWorkspaceRequest): Promise<Workspace> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/workspaces`, {
      method: 'POST',
      headers,
      body: JSON.stringify(workspace),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    return data.workspace;
  }

  async getWorkspaceSchema(workspaceId: string): Promise<WorkspaceSchema> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/schema`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    return data.schema;
  }

  // Query History
  async getQueryHistory(params?: QueryHistoryParams): Promise<QueryHistory[]> {
    const headers = await this.getAuthHeaders();
    const queryParams = new URLSearchParams();
    
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.workspaceId) queryParams.append('workspaceId', params.workspaceId);
    if (params?.favoritesOnly) queryParams.append('favoritesOnly', 'true');

    const url = `${API_BASE_URL}/api/query/history${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    return data.queries;
  }

  async getQuery(queryId: string): Promise<QueryHistory> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/query/history/${queryId}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    return data.query;
  }

  async toggleFavorite(queryId: string, isFavorite: boolean): Promise<QueryHistory> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/query/history/${queryId}/favorite`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ isFavorite }),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    return data.query;
  }

  async deleteQuery(queryId: string): Promise<boolean> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/query/history/${queryId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    return data.deleted;
  }

  async getQueryStatistics(workspaceId?: string, days?: number): Promise<QueryStatistics> {
    const headers = await this.getAuthHeaders();
    const queryParams = new URLSearchParams();
    
    if (workspaceId) queryParams.append('workspaceId', workspaceId);
    if (days) queryParams.append('days', days.toString());

    const url = `${API_BASE_URL}/api/query/history/stats${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    return data.statistics;
  }
}

export default LeafSQLApiClient;
```

---

## ✅ Integration Checklist

### Setup
- [ ] Add API base URL to environment variables
- [ ] Ensure Supabase authentication is working
- [ ] Test health endpoint connectivity

### Authentication
- [ ] Implement JWT token retrieval from Supabase session
- [ ] Add Authorization header to all API requests
- [ ] Handle 401 errors and redirect to login

### Query Execution
- [ ] Implement regular query execution
- [ ] Implement streaming query execution with SSE
- [ ] Handle all stream event types
- [ ] Display SQL, explanation, and results
- [ ] Show execution time and row count

### Workspace Management
- [ ] List all user workspaces
- [ ] Create new workspace with connection string
- [ ] Fetch and display workspace schema
- [ ] Handle workspace selection

### Query History
- [ ] Display query history list with pagination
- [ ] Implement favorites toggle
- [ ] Show query details on click
- [ ] Delete query functionality
- [ ] Display query statistics dashboard
- [ ] Filter by workspace
- [ ] Filter favorites only

### Error Handling
- [ ] Display user-friendly error messages
- [ ] Handle network errors
- [ ] Handle authentication errors
- [ ] Handle validation errors
- [ ] Show loading states

### Testing
- [ ] Test with real Supabase authentication
- [ ] Test all CRUD operations
- [ ] Test streaming functionality
- [ ] Test error scenarios
- [ ] Test pagination

---

## 🆘 Support & Troubleshooting

### Common Issues:

**CORS Errors:**
- Ensure your frontend domain is added to `ALLOWED_ORIGINS` in the API environment variables
- Current allowed origin: `https://preview--leaf-ai-desk.lovable.app`

**401 Unauthorized:**
- Check that JWT token is valid and not expired
- Verify Authorization header format: `Bearer <token>`
- Ensure Supabase session is active

**Connection Timeouts:**
- Render free tier may have cold starts (first request takes longer)
- Implement retry logic for failed requests

**Streaming Issues:**
- Ensure proper SSE handling in frontend
- Check browser console for connection errors
- Verify Content-Type is `text/event-stream`

### Contact:
For issues or questions, check the API logs in Render dashboard or contact the backend team.

---

## 📚 Additional Resources

- API Repository: https://github.com/huzzyd/leafsql-beta-api
- Supabase Docs: https://supabase.com/docs
- Server-Sent Events: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events

---

**Last Updated:** January 2025
**API Version:** 1.0.0
**Status:** ✅ Production Ready


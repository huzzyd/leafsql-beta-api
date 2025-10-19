# Database Migrations

This directory contains SQL migration scripts for the LeafSQL Beta API database schema.

## How to Apply Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the contents of the migration file (e.g., `001_create_query_history_table.sql`)
5. Paste into the SQL editor
6. Click **Run** to execute

### Option 2: Supabase CLI

If you have the Supabase CLI installed:

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Run the migration
supabase db push
```

### Option 3: Direct psql Connection

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" -f 001_create_query_history_table.sql
```

## Available Migrations

### 001_create_query_history_table.sql

**Purpose:** Creates the `query_history` table to store all user query execution history.

**What it creates:**
- `query_history` table with all necessary columns
- Indexes for performance optimization
- Row Level Security (RLS) policies for data isolation
- Triggers for automatic `updated_at` management
- Proper foreign key relationships

**Schema:**
```sql
CREATE TABLE public.query_history (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  question TEXT NOT NULL,
  sql_query TEXT,
  explanation TEXT,
  database_provider VARCHAR(50),
  execution_time_ms INTEGER,
  row_count INTEGER,
  success BOOLEAN,
  error_message TEXT,
  is_favorite BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**To apply:**
```bash
# Copy the SQL from 001_create_query_history_table.sql and run it in Supabase SQL Editor
```

**To rollback:**
```bash
# Copy the SQL from 001_rollback_query_history_table.sql and run it in Supabase SQL Editor
```

## Migration Checklist

When applying `001_create_query_history_table.sql`:

- [ ] Ensure the `workspaces` table exists (required for foreign key)
- [ ] Ensure the `auth.users` table exists (Supabase default)
- [ ] Run the migration SQL in Supabase SQL Editor
- [ ] Verify the table was created: `SELECT * FROM public.query_history LIMIT 1;`
- [ ] Verify RLS policies are active: Check in Supabase dashboard → Authentication → Policies
- [ ] Test the API endpoints to ensure query history is saving correctly

## Verification Queries

After applying the migration, verify everything is set up correctly:

```sql
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'query_history'
);

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'query_history';

-- Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename = 'query_history';

-- Check table structure
\d public.query_history
```

## Troubleshooting

### Error: "relation public.workspaces does not exist"
**Solution:** You need to create the `workspaces` table first. This migration depends on it.

### Error: "permission denied"
**Solution:** Make sure you're using the service role key or running as a superuser.

### RLS policies not working
**Solution:** Verify that `auth.uid()` is available. This is a Supabase function that returns the authenticated user's ID.

## Notes

- All migrations use `IF NOT EXISTS` clauses to be idempotent
- RLS is enabled by default for security
- Indexes are optimized for common query patterns
- The `updated_at` column is automatically updated via trigger

## Support

If you encounter issues:
1. Check the Supabase logs in the dashboard
2. Verify your database schema matches the requirements
3. Ensure your API environment variables are correct
4. Check the API logs on Render for detailed error messages


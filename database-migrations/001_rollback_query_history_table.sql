-- Rollback Migration: Drop query_history table
-- Description: Removes the query_history table and all related objects
-- Created: 2025-01-19

-- Drop triggers
DROP TRIGGER IF EXISTS update_query_history_updated_at_trigger ON public.query_history;

-- Drop functions
DROP FUNCTION IF EXISTS public.update_query_history_updated_at();

-- Drop RLS policies
DROP POLICY IF EXISTS "Users can view their own query history" ON public.query_history;
DROP POLICY IF EXISTS "Users can insert their own query history" ON public.query_history;
DROP POLICY IF EXISTS "Users can update their own query history" ON public.query_history;
DROP POLICY IF EXISTS "Users can delete their own query history" ON public.query_history;

-- Drop indexes (will be automatically dropped with table, but being explicit)
DROP INDEX IF EXISTS public.idx_query_history_user_id;
DROP INDEX IF EXISTS public.idx_query_history_workspace_id;
DROP INDEX IF EXISTS public.idx_query_history_created_at;
DROP INDEX IF EXISTS public.idx_query_history_favorites;
DROP INDEX IF EXISTS public.idx_query_history_success;

-- Drop table
DROP TABLE IF EXISTS public.query_history CASCADE;


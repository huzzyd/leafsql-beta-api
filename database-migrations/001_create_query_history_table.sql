-- Migration: Create query_history table
-- Description: Stores all user query history with execution details, favorites, and analytics
-- Created: 2025-01-19

-- Create query_history table
CREATE TABLE IF NOT EXISTS public.query_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  sql_query TEXT,
  explanation TEXT,
  database_provider VARCHAR(50),
  execution_time_ms INTEGER DEFAULT 0,
  row_count INTEGER DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE public.query_history IS 'Stores all user query history with execution details and analytics';
COMMENT ON COLUMN public.query_history.user_id IS 'Reference to the user who executed the query';
COMMENT ON COLUMN public.query_history.workspace_id IS 'Reference to the workspace where the query was executed';
COMMENT ON COLUMN public.query_history.question IS 'Natural language question asked by the user';
COMMENT ON COLUMN public.query_history.sql_query IS 'Generated SQL query (null if query failed before generation)';
COMMENT ON COLUMN public.query_history.explanation IS 'AI-generated explanation of the query';
COMMENT ON COLUMN public.query_history.database_provider IS 'Database provider (postgresql, mysql, etc.)';
COMMENT ON COLUMN public.query_history.execution_time_ms IS 'Query execution time in milliseconds';
COMMENT ON COLUMN public.query_history.row_count IS 'Number of rows returned by the query';
COMMENT ON COLUMN public.query_history.success IS 'Whether the query executed successfully';
COMMENT ON COLUMN public.query_history.error_message IS 'Error message if query failed';
COMMENT ON COLUMN public.query_history.is_favorite IS 'Whether the query is marked as favorite by the user';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_query_history_user_id ON public.query_history(user_id);
CREATE INDEX IF NOT EXISTS idx_query_history_workspace_id ON public.query_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_query_history_created_at ON public.query_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_history_favorites ON public.query_history(user_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_query_history_success ON public.query_history(user_id, success);

-- Enable Row Level Security (RLS)
ALTER TABLE public.query_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy: Users can view their own query history
CREATE POLICY "Users can view their own query history"
  ON public.query_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own query history
CREATE POLICY "Users can insert their own query history"
  ON public.query_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own query history (for favorites)
CREATE POLICY "Users can update their own query history"
  ON public.query_history
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own query history
CREATE POLICY "Users can delete their own query history"
  ON public.query_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_query_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_query_history_updated_at_trigger
  BEFORE UPDATE ON public.query_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_query_history_updated_at();

-- Grant permissions (service role already has access, but being explicit)
GRANT ALL ON public.query_history TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.query_history TO authenticated;


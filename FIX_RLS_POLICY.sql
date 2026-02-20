-- Fix RLS Policy for crawler_schedules table
-- Run this in Supabase SQL Editor

-- Option 1: Disable RLS (for development/testing)
-- ALTER TABLE crawler_schedules DISABLE ROW LEVEL SECURITY;

-- Option 2: Add proper RLS policies (recommended for production)

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated users to insert schedules" ON crawler_schedules;
DROP POLICY IF EXISTS "Allow authenticated users to update schedules" ON crawler_schedules;
DROP POLICY IF EXISTS "Allow authenticated users to delete schedules" ON crawler_schedules;
DROP POLICY IF EXISTS "Allow authenticated users to select schedules" ON crawler_schedules;

-- Create new policies for authenticated users
CREATE POLICY "Allow authenticated users to insert schedules"
ON crawler_schedules FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update schedules"
ON crawler_schedules FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete schedules"
ON crawler_schedules FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to select schedules"
ON crawler_schedules FOR SELECT
TO authenticated
USING (true);

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'crawler_schedules';

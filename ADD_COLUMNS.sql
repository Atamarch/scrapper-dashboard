-- Add file_id and file_name columns to crawler_schedules table
-- Run this in Supabase SQL Editor

ALTER TABLE crawler_schedules 
ADD COLUMN IF NOT EXISTS file_id UUID,
ADD COLUMN IF NOT EXISTS file_name TEXT;

-- Add foreign key constraint (optional)
ALTER TABLE crawler_schedules 
ADD CONSTRAINT fk_crawler_jobs 
FOREIGN KEY (file_id) 
REFERENCES crawler_jobs(id) 
ON DELETE SET NULL;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'crawler_schedules';

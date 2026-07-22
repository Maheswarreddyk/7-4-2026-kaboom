-- Add client metadata columns to visitor_sessions
ALTER TABLE visitor_sessions 
ADD COLUMN IF NOT EXISTS browser VARCHAR(100),
ADD COLUMN IF NOT EXISTS device VARCHAR(50),
ADD COLUMN IF NOT EXISTS platform VARCHAR(50);

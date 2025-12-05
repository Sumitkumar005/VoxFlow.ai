-- Check what columns exist in agent_runs table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'agent_runs'
ORDER BY ordinal_position;

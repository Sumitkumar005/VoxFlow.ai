-- Check all triggers and functions that might reference dograh_tokens
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'agent_runs';

-- Check all functions
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_type = 'FUNCTION'
AND routine_definition LIKE '%dograh%';

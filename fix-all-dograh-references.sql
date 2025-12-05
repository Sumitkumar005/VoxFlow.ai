-- Complete fix for all dograh_tokens references
-- This updates ALL functions and triggers to use groq_tokens

-- 1. Fix the update_user_usage_tracking function
CREATE OR REPLACE FUNCTION update_user_usage_tracking()
RETURNS TRIGGER AS $$
DECLARE
  agent_user_id UUID;
  usage_date DATE;
BEGIN
  -- Only process completed runs
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Get the user_id from the agent
    SELECT user_id INTO agent_user_id
    FROM agents
    WHERE id = NEW.agent_id;
    
    -- Get today's date
    usage_date := CURRENT_DATE;
    
    -- Update or insert usage tracking record
    INSERT INTO user_usage_tracking (
      user_id,
      date,
      total_calls,
      total_duration_seconds,
      total_tokens
    ) VALUES (
      agent_user_id,
      usage_date,
      1,
      COALESCE(NEW.duration_seconds, 0),
      COALESCE(NEW.groq_tokens, 0)
    )
    ON CONFLICT (user_id, date)
    DO UPDATE SET
      total_calls = user_usage_tracking.total_calls + 1,
      total_duration_seconds = user_usage_tracking.total_duration_seconds + COALESCE(NEW.duration_seconds, 0),
      total_tokens = user_usage_tracking.total_tokens + COALESCE(NEW.groq_tokens, 0),
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Drop and recreate the calculate tokens function
DROP TRIGGER IF EXISTS trigger_calculate_dograh_tokens ON agent_runs;
DROP FUNCTION IF EXISTS calculate_dograh_tokens();

CREATE OR REPLACE FUNCTION calculate_groq_tokens()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.duration_seconds > 0 THEN
    NEW.groq_tokens = ROUND((NEW.duration_seconds * 0.013)::numeric, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_groq_tokens
BEFORE UPDATE OF status ON agent_runs
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION calculate_groq_tokens();

-- 3. Verify all functions are updated
SELECT 
    routine_name,
    CASE 
        WHEN routine_definition LIKE '%dograh%' THEN 'STILL HAS TYPO!'
        ELSE 'Fixed'
    END as status
FROM information_schema.routines
WHERE routine_type = 'FUNCTION'
AND (routine_definition LIKE '%groq%' OR routine_definition LIKE '%dograh%');

SELECT 'All dograh_tokens references fixed!' as result;

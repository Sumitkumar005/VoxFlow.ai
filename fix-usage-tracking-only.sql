-- Fix only the update_user_usage_tracking function
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

SELECT 'Usage tracking function fixed!' as result;

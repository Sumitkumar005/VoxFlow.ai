-- Apply migration 004 to fix column name typo
-- Run this in your Supabase SQL editor or via psql

-- Rename dograh_tokens to groq_tokens
ALTER TABLE agent_runs RENAME COLUMN dograh_tokens TO groq_tokens;

-- Update the trigger function name and logic
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

-- Update the usage tracking trigger to use correct column name
CREATE OR REPLACE FUNCTION update_user_usage_on_run_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO user_usage_tracking (
      user_id,
      date,
      total_calls,
      total_duration_seconds,
      total_tokens
    )
    VALUES (
      (SELECT user_id FROM agents WHERE id = NEW.agent_id),
      CURRENT_DATE,
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

-- Add comment
COMMENT ON COLUMN agent_runs.groq_tokens IS 'Number of tokens used by Groq AI for this run';

SELECT 'Migration 004 applied successfully!' as status;

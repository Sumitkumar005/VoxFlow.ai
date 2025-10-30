-- =====================================================
-- Fix Column Name Typos
-- =====================================================

-- Rename dograh_tokens to groq_tokens for clarity
ALTER TABLE agent_runs RENAME COLUMN dograh_tokens TO groq_tokens;

-- Add comment to clarify what this column stores
COMMENT ON COLUMN agent_runs.groq_tokens IS 'Number of tokens used by Groq AI for this run';
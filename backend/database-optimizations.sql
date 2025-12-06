-- ============================================
-- VOXFLOW DATABASE PERFORMANCE OPTIMIZATIONS
-- ============================================
-- Run these in your Supabase SQL Editor

-- 1. ADD INDEXES FOR FASTER QUERIES
-- ============================================

-- Agents table indexes
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
CREATE INDEX IF NOT EXISTS idx_agents_user_type ON agents(user_id, type);

-- Full-text search index for agent names
CREATE INDEX IF NOT EXISTS idx_agents_name_trgm ON agents USING gin(name gin_trgm_ops);

-- Runs table indexes
CREATE INDEX IF NOT EXISTS idx_runs_agent_id ON runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_runs_user_id ON runs(user_id);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_agent_status ON runs(agent_id, status);

-- Campaigns table indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_agent_id ON campaigns(agent_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_state ON campaigns(state);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);

-- Usage tracking indexes
CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_user_date ON usage_tracking(user_id, created_at DESC);

-- API keys indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON user_api_keys(provider);

-- 2. ENABLE TRIGRAM EXTENSION FOR FAST TEXT SEARCH
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 3. CREATE MATERIALIZED VIEW FOR AGENT STATS
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS agent_stats AS
SELECT 
  a.id as agent_id,
  a.user_id,
  a.name,
  a.type,
  a.use_case,
  a.description,
  a.created_at,
  a.updated_at,
  COUNT(r.id) as total_runs,
  COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as successful_runs,
  COUNT(CASE WHEN r.status = 'failed' THEN 1 END) as failed_runs,
  MAX(r.created_at) as last_run_at
FROM agents a
LEFT JOIN runs r ON a.id = r.agent_id
GROUP BY a.id, a.user_id, a.name, a.type, a.use_case, a.description, a.created_at, a.updated_at;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_agent_stats_user_id ON agent_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_stats_created_at ON agent_stats(created_at DESC);

-- 4. CREATE FUNCTION TO REFRESH STATS (Call this periodically)
-- ============================================
CREATE OR REPLACE FUNCTION refresh_agent_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY agent_stats;
END;
$$ LANGUAGE plpgsql;

-- 5. OPTIMIZE EXISTING TABLES
-- ============================================

-- Analyze tables for better query planning
ANALYZE agents;
ANALYZE runs;
ANALYZE campaigns;
ANALYZE users;
ANALYZE usage_tracking;

-- 6. CREATE COMPOSITE INDEXES FOR COMMON QUERIES
-- ============================================

-- For agent list with stats
CREATE INDEX IF NOT EXISTS idx_agents_user_created ON agents(user_id, created_at DESC);

-- For run history queries
CREATE INDEX IF NOT EXISTS idx_runs_agent_created ON runs(agent_id, created_at DESC);

-- For usage queries
CREATE INDEX IF NOT EXISTS idx_usage_user_created ON usage_tracking(user_id, created_at DESC);

-- 7. ADD PARTIAL INDEXES FOR ACTIVE RECORDS
-- ============================================

-- Only index active campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns(user_id, state) 
WHERE state IN ('running', 'paused');

-- Only index recent runs (last 30 days)
CREATE INDEX IF NOT EXISTS idx_runs_recent ON runs(agent_id, created_at DESC)
WHERE created_at > NOW() - INTERVAL '30 days';

-- ============================================
-- PERFORMANCE MONITORING QUERIES
-- ============================================

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check slow queries (if pg_stat_statements is enabled)
-- SELECT query, calls, total_time, mean_time
-- FROM pg_stat_statements
-- ORDER BY mean_time DESC
-- LIMIT 10;

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

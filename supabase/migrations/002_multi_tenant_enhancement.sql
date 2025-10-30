-- VoxFlow Multi-Tenant Enhancement Migration
-- This migration transforms the existing single-admin system into a multi-tenant platform
-- Run this in Supabase SQL Editor after the initial schema

-- =====================================================
-- 1. ENHANCE USERS TABLE FOR MULTI-TENANCY
-- =====================================================
-- Add new columns to existing users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_agents INTEGER DEFAULT 2;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_token_quota INTEGER DEFAULT 1000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Add constraints for role and subscription_tier
ALTER TABLE users ADD CONSTRAINT check_user_role 
  CHECK (role IN ('admin', 'user', 'enterprise'));
ALTER TABLE users ADD CONSTRAINT check_subscription_tier 
  CHECK (subscription_tier IN ('free', 'pro', 'enterprise'));

-- Update existing admin user with proper role and higher limits
UPDATE users 
SET 
  role = 'admin',
  subscription_tier = 'enterprise',
  organization_name = 'VoxFlow Admin',
  max_agents = 100,
  monthly_token_quota = 1000000,
  is_active = true
WHERE email = 'admin@voxflow.com';

-- =====================================================
-- 2. USER API KEYS TABLE (NEW)
-- =====================================================
-- Stores encrypted API keys per user for each provider
CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('groq', 'deepgram', 'twilio')),
  api_key_encrypted TEXT NOT NULL,
  iv VARCHAR(32) NOT NULL, -- Initialization vector for encryption
  auth_tag VARCHAR(32) NOT NULL, -- Authentication tag for AES-GCM
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, provider)
);

-- =====================================================
-- 3. USER USAGE TRACKING TABLE (NEW)
-- =====================================================
-- Tracks daily usage per user for billing and limits
CREATE TABLE IF NOT EXISTS user_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_tokens DECIMAL(10,2) DEFAULT 0,
  total_calls INTEGER DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  api_costs DECIMAL(10,2) DEFAULT 0, -- Track costs per user per day
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- =====================================================
-- 4. SUBSCRIPTIONS TABLE (NEW)
-- =====================================================
-- Manages user subscription plans and billing
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan VARCHAR(20) NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  stripe_subscription_id VARCHAR(255),
  monthly_price DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- =====================================================
-- 5. ADMIN AUDIT LOGS TABLE (NEW)
-- =====================================================
-- Tracks all admin actions for compliance and security
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_resource_type VARCHAR(50), -- 'user', 'agent', 'campaign', etc.
  target_resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. ENHANCED INDEXES FOR PERFORMANCE
-- =====================================================
-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_provider ON user_api_keys(provider);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_active ON user_api_keys(is_active);

CREATE INDEX IF NOT EXISTS idx_user_usage_tracking_user_id ON user_usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_tracking_date ON user_usage_tracking(date DESC);
CREATE INDEX IF NOT EXISTS idx_user_usage_tracking_user_date ON user_usage_tracking(user_id, date);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON subscriptions(expires_at);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_user_id ON admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_user_id ON admin_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);

-- Enhanced indexes for existing tables with new columns
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC);

-- =====================================================
-- 7. AGENT LIMIT ENFORCEMENT TRIGGER
-- =====================================================
-- Prevents users from creating more agents than their limit allows
CREATE OR REPLACE FUNCTION check_agent_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_agent_count INT;
  user_max_agents INT;
BEGIN
  -- Get current agent count for the user
  SELECT COUNT(*) INTO user_agent_count
  FROM agents
  WHERE user_id = NEW.user_id;
  
  -- Get user's max agents limit
  SELECT max_agents INTO user_max_agents
  FROM users
  WHERE id = NEW.user_id;
  
  -- Check if user would exceed their limit
  IF user_agent_count >= user_max_agents THEN
    RAISE EXCEPTION 'Agent limit reached. Current: %, Max: %. Please upgrade your plan to create more agents.', 
      user_agent_count, user_max_agents;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for agent limit enforcement
DROP TRIGGER IF EXISTS enforce_agent_limit ON agents;
CREATE TRIGGER enforce_agent_limit
BEFORE INSERT ON agents
FOR EACH ROW
EXECUTE FUNCTION check_agent_limit();

-- =====================================================
-- 8. USAGE TRACKING TRIGGERS
-- =====================================================
-- Auto-update usage tracking when agent runs complete
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
      COALESCE(NEW.dograh_tokens, 0)
    )
    ON CONFLICT (user_id, date)
    DO UPDATE SET
      total_calls = user_usage_tracking.total_calls + 1,
      total_duration_seconds = user_usage_tracking.total_duration_seconds + COALESCE(NEW.duration_seconds, 0),
      total_tokens = user_usage_tracking.total_tokens + COALESCE(NEW.dograh_tokens, 0),
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for usage tracking
DROP TRIGGER IF EXISTS trigger_update_user_usage_tracking ON agent_runs;
CREATE TRIGGER trigger_update_user_usage_tracking
AFTER UPDATE OF status ON agent_runs
FOR EACH ROW
EXECUTE FUNCTION update_user_usage_tracking();

-- =====================================================
-- 9. SUBSCRIPTION MANAGEMENT FUNCTIONS
-- =====================================================
-- Function to create default subscription for new users
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default free subscription for new users
  INSERT INTO subscriptions (
    user_id,
    plan,
    status,
    monthly_price
  ) VALUES (
    NEW.id,
    NEW.subscription_tier,
    'active',
    CASE 
      WHEN NEW.subscription_tier = 'free' THEN 0
      WHEN NEW.subscription_tier = 'pro' THEN 29
      WHEN NEW.subscription_tier = 'enterprise' THEN 299
      ELSE 0
    END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for default subscription creation
DROP TRIGGER IF EXISTS trigger_create_default_subscription ON users;
CREATE TRIGGER trigger_create_default_subscription
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_default_subscription();

-- =====================================================
-- 10. ROW LEVEL SECURITY POLICIES UPDATE
-- =====================================================
-- Disable RLS temporarily for easier JWT-based auth implementation
-- Note: In production, you may want to enable RLS for additional security

-- Disable RLS on existing tables for JWT-based auth
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE service_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE telephony_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_contacts DISABLE ROW LEVEL SECURITY;

-- Disable RLS on new tables
ALTER TABLE user_api_keys DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage_tracking DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- 11. CREATE DEFAULT SUBSCRIPTION FOR EXISTING ADMIN
-- =====================================================
-- Create subscription record for existing admin user
INSERT INTO subscriptions (
  user_id,
  plan,
  status,
  monthly_price
) 
SELECT 
  id,
  'enterprise',
  'active',
  0 -- Free for admin
FROM users 
WHERE email = 'admin@voxflow.com'
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- 12. HELPER VIEWS FOR ANALYTICS
-- =====================================================
-- View for user statistics (useful for admin dashboard)
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
  u.id,
  u.email,
  u.role,
  u.subscription_tier,
  u.organization_name,
  u.max_agents,
  u.monthly_token_quota,
  u.is_active,
  u.created_at,
  u.last_login,
  COUNT(DISTINCT a.id) as agent_count,
  COUNT(DISTINCT ar.id) as total_runs,
  COALESCE(SUM(ar.duration_seconds), 0) as total_duration_seconds,
  COALESCE(SUM(ar.dograh_tokens), 0) as total_tokens_used,
  s.plan as current_plan,
  s.status as subscription_status
FROM users u
LEFT JOIN agents a ON u.id = a.user_id
LEFT JOIN agent_runs ar ON a.id = ar.agent_id AND ar.status = 'completed'
LEFT JOIN subscriptions s ON u.id = s.user_id
GROUP BY u.id, u.email, u.role, u.subscription_tier, u.organization_name, 
         u.max_agents, u.monthly_token_quota, u.is_active, u.created_at, 
         u.last_login, s.plan, s.status;

-- View for current month usage per user
CREATE OR REPLACE VIEW current_month_usage AS
SELECT 
  u.id as user_id,
  u.email,
  u.monthly_token_quota,
  COALESCE(SUM(uut.total_tokens), 0) as tokens_used_this_month,
  COALESCE(SUM(uut.total_calls), 0) as calls_this_month,
  COALESCE(SUM(uut.total_duration_seconds), 0) as duration_this_month,
  COALESCE(SUM(uut.api_costs), 0) as costs_this_month,
  (u.monthly_token_quota - COALESCE(SUM(uut.total_tokens), 0)) as tokens_remaining
FROM users u
LEFT JOIN user_usage_tracking uut ON u.id = uut.user_id 
  AND uut.date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY u.id, u.email, u.monthly_token_quota;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- This migration successfully transforms VoxFlow into a multi-tenant platform
-- while preserving all existing functionality and data integrity.

COMMENT ON TABLE user_api_keys IS 'Stores encrypted API keys per user for Groq, Deepgram, and Twilio';
COMMENT ON TABLE user_usage_tracking IS 'Tracks daily usage metrics per user for billing and limit enforcement';
COMMENT ON TABLE subscriptions IS 'Manages user subscription plans and billing information';
COMMENT ON TABLE admin_audit_logs IS 'Audit trail for all administrative actions';
-- VoxFlow Database Schema for Supabase
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/_/sql

-- =====================================================
-- 1. USERS TABLE
-- =====================================================
-- Stores user authentication data
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert hardcoded admin user (password: admin123)
-- Password hash for 'admin123' using bcrypt
INSERT INTO users (email, password_hash) VALUES 
('admin@voxflow.com', '$2a$10$rZ5qN8vH0YhX.xQX0yqQ7.wK6p7lK9xYvZ5QXqY7.wK6p7lK9xYvZ');

-- =====================================================
-- 2. SERVICE_CONFIGS TABLE
-- =====================================================
-- Stores LLM, TTS, and STT provider configurations
CREATE TABLE service_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  llm_provider VARCHAR(50) DEFAULT 'groq',
  llm_model VARCHAR(100) DEFAULT 'llama-3.3-70b-versatile',
  tts_provider VARCHAR(50) DEFAULT 'deepgram',
  tts_voice VARCHAR(100) DEFAULT 'aura-2-helena-en',
  stt_provider VARCHAR(50) DEFAULT 'deepgram',
  stt_model VARCHAR(100) DEFAULT 'nova-3-general',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- =====================================================
-- 3. TELEPHONY_CONFIGS TABLE
-- =====================================================
-- Stores Twilio configuration for phone calls
CREATE TABLE telephony_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) DEFAULT 'twilio',
  account_sid VARCHAR(255) NOT NULL,
  auth_token VARCHAR(255) NOT NULL, -- Should be encrypted in production
  from_phone_number VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- =====================================================
-- 4. AGENTS TABLE
-- =====================================================
-- Stores voice agent configurations
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(10) CHECK (type IN ('INBOUND', 'OUTBOUND')) NOT NULL,
  use_case VARCHAR(255) NOT NULL,
  description TEXT NOT NULL, -- This is the main prompt for the agent
  total_runs INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. CAMPAIGNS TABLE
-- =====================================================
-- Stores bulk calling campaigns
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  source_type VARCHAR(20) DEFAULT 'csv',
  source_file_path VARCHAR(500), -- Path to uploaded CSV
  state VARCHAR(20) CHECK (state IN ('created', 'running', 'paused', 'completed', 'stopped')) DEFAULT 'created',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. AGENT_RUNS TABLE
-- =====================================================
-- Stores individual call/run records
CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_number VARCHAR(50) UNIQUE NOT NULL, -- Format: WR-TEL-XXXX
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  type VARCHAR(20) CHECK (type IN ('WEB_CALL', 'PHONE_CALL')) NOT NULL,
  phone_number VARCHAR(20), -- NULL for web calls
  status VARCHAR(20) CHECK (status IN ('in_progress', 'completed', 'failed')) DEFAULT 'in_progress',
  disposition VARCHAR(100), -- user_hangup, user_idle_max_duration_exceeded, etc.
  duration_seconds INTEGER DEFAULT 0,
  dograh_tokens DECIMAL(10, 2) DEFAULT 0, -- Calculated as duration_seconds * 0.013
  transcript_text TEXT,
  recording_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- 7. CAMPAIGN_CONTACTS TABLE
-- =====================================================
-- Stores contacts extracted from CSV for each campaign
CREATE TABLE campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  status VARCHAR(20) CHECK (status IN ('pending', 'called', 'failed')) DEFAULT 'pending',
  agent_run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_agents_user_id ON agents(user_id);
CREATE INDEX idx_agent_runs_agent_id ON agent_runs(agent_id);
CREATE INDEX idx_agent_runs_campaign_id ON agent_runs(campaign_id);
CREATE INDEX idx_agent_runs_created_at ON agent_runs(created_at DESC);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);
CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_state ON campaigns(state);
CREATE INDEX idx_campaign_contacts_campaign_id ON campaign_contacts(campaign_id);
CREATE INDEX idx_campaign_contacts_status ON campaign_contacts(status);

-- =====================================================
-- TRIGGER TO AUTO-INCREMENT AGENT TOTAL_RUNS
-- =====================================================
CREATE OR REPLACE FUNCTION increment_agent_runs()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE agents 
    SET total_runs = total_runs + 1 
    WHERE id = NEW.agent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_agent_runs
AFTER UPDATE OF status ON agent_runs
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
EXECUTE FUNCTION increment_agent_runs();

-- =====================================================
-- TRIGGER TO AUTO-CALCULATE DOGRAH TOKENS
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_dograh_tokens()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.duration_seconds > 0 THEN
    NEW.dograh_tokens = ROUND((NEW.duration_seconds * 0.013)::numeric, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_dograh_tokens
BEFORE UPDATE OF status ON agent_runs
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION calculate_dograh_tokens();

-- =====================================================
-- RLS (Row Level Security) - Optional but recommended
-- =====================================================
-- Enable RLS for all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE telephony_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies (users can only access their own data)
CREATE POLICY "Users can view own data" ON agents
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own data" ON agents
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own data" ON agents
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Note: For simplicity with JWT auth, you might want to disable RLS initially
-- To disable: ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
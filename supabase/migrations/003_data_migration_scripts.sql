-- VoxFlow Data Migration Scripts
-- This migration handles data migration and backward compatibility for multi-tenant transformation
-- Run this after 002_multi_tenant_enhancement.sql

-- =====================================================
-- 1. ADMIN USER DATA MIGRATION
-- =====================================================
-- Update existing admin user with complete multi-tenant fields
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Get admin user ID
  SELECT id INTO admin_user_id 
  FROM users 
  WHERE email = 'admin@voxflow.com';
  
  IF admin_user_id IS NOT NULL THEN
    -- Update admin user with all required fields
    UPDATE users 
    SET 
      role = 'admin',
      subscription_tier = 'enterprise',
      organization_name = 'VoxFlow Administration',
      max_agents = 1000, -- High limit for admin
      monthly_token_quota = 10000000, -- 10M tokens for admin
      is_active = true,
      last_login = NOW()
    WHERE id = admin_user_id;
    
    RAISE NOTICE 'Admin user updated successfully with ID: %', admin_user_id;
  ELSE
    RAISE EXCEPTION 'Admin user not found. Please ensure admin@voxflow.com exists in users table.';
  END IF;
END;
$$;

-- =====================================================
-- 2. EXISTING AGENTS MIGRATION TO ADMIN OWNERSHIP
-- =====================================================
-- Migrate all existing agents to admin user ownership
DO $$
DECLARE
  admin_user_id UUID;
  agent_count INTEGER;
BEGIN
  -- Get admin user ID
  SELECT id INTO admin_user_id 
  FROM users 
  WHERE email = 'admin@voxflow.com';
  
  IF admin_user_id IS NOT NULL THEN
    -- Count existing agents without user_id
    SELECT COUNT(*) INTO agent_count
    FROM agents 
    WHERE user_id IS NULL OR user_id != admin_user_id;
    
    -- Update all existing agents to belong to admin
    UPDATE agents 
    SET user_id = admin_user_id
    WHERE user_id IS NULL OR user_id != admin_user_id;
    
    RAISE NOTICE 'Migrated % agents to admin user ownership', agent_count;
  END IF;
END;
$$;

-- =====================================================
-- 3. EXISTING CAMPAIGNS MIGRATION TO ADMIN OWNERSHIP
-- =====================================================
-- Migrate all existing campaigns to admin user ownership
DO $$
DECLARE
  admin_user_id UUID;
  campaign_count INTEGER;
BEGIN
  -- Get admin user ID
  SELECT id INTO admin_user_id 
  FROM users 
  WHERE email = 'admin@voxflow.com';
  
  IF admin_user_id IS NOT NULL THEN
    -- Count existing campaigns without user_id
    SELECT COUNT(*) INTO campaign_count
    FROM campaigns 
    WHERE user_id IS NULL OR user_id != admin_user_id;
    
    -- Update all existing campaigns to belong to admin
    UPDATE campaigns 
    SET user_id = admin_user_id
    WHERE user_id IS NULL OR user_id != admin_user_id;
    
    RAISE NOTICE 'Migrated % campaigns to admin user ownership', campaign_count;
  END IF;
END;
$$;

-- =====================================================
-- 4. EXISTING SERVICE CONFIGS MIGRATION
-- =====================================================
-- Migrate existing service configs to admin user
DO $$
DECLARE
  admin_user_id UUID;
  config_count INTEGER;
BEGIN
  -- Get admin user ID
  SELECT id INTO admin_user_id 
  FROM users 
  WHERE email = 'admin@voxflow.com';
  
  IF admin_user_id IS NOT NULL THEN
    -- Count existing service configs without user_id
    SELECT COUNT(*) INTO config_count
    FROM service_configs 
    WHERE user_id IS NULL OR user_id != admin_user_id;
    
    -- Update all existing service configs to belong to admin
    UPDATE service_configs 
    SET user_id = admin_user_id
    WHERE user_id IS NULL OR user_id != admin_user_id;
    
    RAISE NOTICE 'Migrated % service configs to admin user ownership', config_count;
  END IF;
END;
$$;

-- =====================================================
-- 5. EXISTING TELEPHONY CONFIGS MIGRATION
-- =====================================================
-- Migrate existing telephony configs to admin user
DO $$
DECLARE
  admin_user_id UUID;
  telephony_count INTEGER;
BEGIN
  -- Get admin user ID
  SELECT id INTO admin_user_id 
  FROM users 
  WHERE email = 'admin@voxflow.com';
  
  IF admin_user_id IS NOT NULL THEN
    -- Count existing telephony configs without user_id
    SELECT COUNT(*) INTO telephony_count
    FROM telephony_configs 
    WHERE user_id IS NULL OR user_id != admin_user_id;
    
    -- Update all existing telephony configs to belong to admin
    UPDATE telephony_configs 
    SET user_id = admin_user_id
    WHERE user_id IS NULL OR user_id != admin_user_id;
    
    RAISE NOTICE 'Migrated % telephony configs to admin user ownership', telephony_count;
  END IF;
END;
$$;

-- =====================================================
-- 6. INITIALIZE USAGE TRACKING FOR EXISTING DATA
-- =====================================================
-- Create usage tracking records for existing agent runs
DO $$
DECLARE
  admin_user_id UUID;
  run_record RECORD;
  usage_date DATE;
BEGIN
  -- Get admin user ID
  SELECT id INTO admin_user_id 
  FROM users 
  WHERE email = 'admin@voxflow.com';
  
  IF admin_user_id IS NOT NULL THEN
    -- Process existing completed agent runs
    FOR run_record IN 
      SELECT 
        DATE(ar.created_at) as run_date,
        COUNT(*) as call_count,
        SUM(COALESCE(ar.duration_seconds, 0)) as total_duration,
        SUM(COALESCE(ar.dograh_tokens, 0)) as total_tokens
      FROM agent_runs ar
      JOIN agents a ON ar.agent_id = a.id
      WHERE ar.status = 'completed'
        AND a.user_id = admin_user_id
      GROUP BY DATE(ar.created_at)
    LOOP
      -- Insert or update usage tracking for each date
      INSERT INTO user_usage_tracking (
        user_id,
        date,
        total_calls,
        total_duration_seconds,
        total_tokens,
        api_costs
      ) VALUES (
        admin_user_id,
        run_record.run_date,
        run_record.call_count,
        run_record.total_duration,
        run_record.total_tokens,
        -- Estimate costs based on tokens and duration
        (run_record.total_tokens * 0.0000001) + (run_record.total_duration * 0.0025)
      )
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        total_calls = EXCLUDED.total_calls,
        total_duration_seconds = EXCLUDED.total_duration_seconds,
        total_tokens = EXCLUDED.total_tokens,
        api_costs = EXCLUDED.api_costs,
        updated_at = NOW();
    END LOOP;
    
    RAISE NOTICE 'Initialized usage tracking for existing agent runs';
  END IF;
END;
$$;

-- =====================================================
-- 7. CREATE ADMIN SUBSCRIPTION RECORD
-- =====================================================
-- Ensure admin has proper subscription record
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Get admin user ID
  SELECT id INTO admin_user_id 
  FROM users 
  WHERE email = 'admin@voxflow.com';
  
  IF admin_user_id IS NOT NULL THEN
    -- Create or update admin subscription
    INSERT INTO subscriptions (
      user_id,
      plan,
      status,
      monthly_price,
      started_at
    ) VALUES (
      admin_user_id,
      'enterprise',
      'active',
      0, -- Free for admin
      NOW()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      plan = 'enterprise',
      status = 'active',
      monthly_price = 0,
      updated_at = NOW();
    
    RAISE NOTICE 'Admin subscription record created/updated';
  END IF;
END;
$$;

-- =====================================================
-- 8. DATA INTEGRITY VERIFICATION
-- =====================================================
-- Verify all data has been migrated correctly
DO $$
DECLARE
  admin_user_id UUID;
  orphaned_agents INTEGER;
  orphaned_campaigns INTEGER;
  orphaned_configs INTEGER;
  orphaned_telephony INTEGER;
BEGIN
  -- Get admin user ID
  SELECT id INTO admin_user_id 
  FROM users 
  WHERE email = 'admin@voxflow.com';
  
  -- Check for orphaned records
  SELECT COUNT(*) INTO orphaned_agents FROM agents WHERE user_id IS NULL;
  SELECT COUNT(*) INTO orphaned_campaigns FROM campaigns WHERE user_id IS NULL;
  SELECT COUNT(*) INTO orphaned_configs FROM service_configs WHERE user_id IS NULL;
  SELECT COUNT(*) INTO orphaned_telephony FROM telephony_configs WHERE user_id IS NULL;
  
  -- Report results
  RAISE NOTICE 'Data Migration Verification:';
  RAISE NOTICE '- Admin User ID: %', admin_user_id;
  RAISE NOTICE '- Orphaned Agents: %', orphaned_agents;
  RAISE NOTICE '- Orphaned Campaigns: %', orphaned_campaigns;
  RAISE NOTICE '- Orphaned Service Configs: %', orphaned_configs;
  RAISE NOTICE '- Orphaned Telephony Configs: %', orphaned_telephony;
  
  -- Raise error if any orphaned records found
  IF orphaned_agents > 0 OR orphaned_campaigns > 0 OR orphaned_configs > 0 OR orphaned_telephony > 0 THEN
    RAISE EXCEPTION 'Data migration incomplete. Found orphaned records.';
  END IF;
  
  RAISE NOTICE 'Data migration completed successfully!';
END;
$$;

-- =====================================================
-- 9. CREATE MIGRATION ROLLBACK PROCEDURES
-- =====================================================
-- Function to rollback data migration if needed
CREATE OR REPLACE FUNCTION rollback_data_migration()
RETURNS TEXT AS $$
DECLARE
  admin_user_id UUID;
  result_message TEXT;
BEGIN
  -- Get admin user ID
  SELECT id INTO admin_user_id 
  FROM users 
  WHERE email = 'admin@voxflow.com';
  
  -- Start transaction for rollback
  BEGIN
    -- Remove usage tracking records
    DELETE FROM user_usage_tracking WHERE user_id = admin_user_id;
    
    -- Remove subscription records
    DELETE FROM subscriptions WHERE user_id = admin_user_id;
    
    -- Reset admin user fields to original state
    UPDATE users 
    SET 
      role = NULL,
      subscription_tier = NULL,
      organization_name = NULL,
      max_agents = NULL,
      monthly_token_quota = NULL,
      is_active = NULL,
      last_login = NULL
    WHERE id = admin_user_id;
    
    -- Note: We don't reset agent/campaign ownership as it would break referential integrity
    -- Instead, we just reset the user fields
    
    result_message := 'Data migration rollback completed successfully';
    
  EXCEPTION WHEN OTHERS THEN
    result_message := 'Rollback failed: ' || SQLERRM;
  END;
  
  RETURN result_message;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. MIGRATION COMPLETION LOG
-- =====================================================
-- Log the completion of data migration
INSERT INTO admin_audit_logs (
  admin_user_id,
  action,
  details,
  created_at
) 
SELECT 
  id,
  'data_migration_completed',
  jsonb_build_object(
    'migration_version', '003_data_migration_scripts',
    'timestamp', NOW(),
    'description', 'Completed data migration for multi-tenant transformation'
  ),
  NOW()
FROM users 
WHERE email = 'admin@voxflow.com';

-- =====================================================
-- MIGRATION SCRIPT COMPLETE
-- =====================================================
COMMENT ON FUNCTION rollback_data_migration() IS 'Rollback function for data migration in case of issues';
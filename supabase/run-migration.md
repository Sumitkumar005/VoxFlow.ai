# Database Migration Instructions

## Running the Multi-Tenant Migration

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard: https://app.supabase.com/project/ryeiykjgiormmylhqitw
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of `002_multi_tenant_enhancement.sql`
5. Click **Run** to execute the migration

### Option 2: Command Line (Alternative)
```bash
# If you have psql installed and configured
psql -h db.ryeiykjgiormmylhqitw.supabase.co -U postgres -d postgres -f supabase/migrations/002_multi_tenant_enhancement.sql
```

## What This Migration Does

### ✅ Enhanced Users Table
- Adds `role` (admin, user, enterprise)
- Adds `subscription_tier` (free, pro, enterprise) 
- Adds `organization_name`
- Adds `max_agents` and `monthly_token_quota` limits
- Adds `is_active` and `last_login` tracking
- Updates existing admin user with proper permissions

### ✅ New Tables Created
- **user_api_keys**: Encrypted storage for user's API keys (Groq, Deepgram, Twilio)
- **user_usage_tracking**: Daily usage metrics per user
- **subscriptions**: Subscription plan management
- **admin_audit_logs**: Audit trail for admin actions

### ✅ Triggers and Functions
- **Agent limit enforcement**: Prevents users from exceeding their agent limits
- **Usage tracking**: Automatically tracks API usage per user
- **Default subscriptions**: Creates subscription records for new users

### ✅ Performance Indexes
- Optimized indexes for all new tables and columns
- Enhanced queries for admin dashboard and analytics

### ✅ Helper Views
- **user_statistics**: Complete user overview for admin dashboard
- **current_month_usage**: Real-time usage tracking per user

## Verification Steps

After running the migration, verify it worked correctly:

```sql
-- Check if new columns were added to users table
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- Check if new tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_api_keys', 'user_usage_tracking', 'subscriptions', 'admin_audit_logs');

-- Verify admin user was updated correctly
SELECT id, email, role, subscription_tier, max_agents, monthly_token_quota 
FROM users 
WHERE email = 'admin@voxflow.com';

-- Check if triggers were created
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';
```

## Rollback Instructions (If Needed)

If you need to rollback this migration:

```sql
-- Remove new columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS role;
ALTER TABLE users DROP COLUMN IF EXISTS subscription_tier;
ALTER TABLE users DROP COLUMN IF EXISTS organization_name;
ALTER TABLE users DROP COLUMN IF EXISTS max_agents;
ALTER TABLE users DROP COLUMN IF EXISTS monthly_token_quota;
ALTER TABLE users DROP COLUMN IF EXISTS is_active;
ALTER TABLE users DROP COLUMN IF EXISTS last_login;

-- Drop new tables
DROP TABLE IF EXISTS admin_audit_logs;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS user_usage_tracking;
DROP TABLE IF EXISTS user_api_keys;

-- Drop new triggers
DROP TRIGGER IF EXISTS enforce_agent_limit ON agents;
DROP TRIGGER IF EXISTS trigger_update_user_usage_tracking ON agent_runs;
DROP TRIGGER IF EXISTS trigger_create_default_subscription ON users;

-- Drop new functions
DROP FUNCTION IF EXISTS check_agent_limit();
DROP FUNCTION IF EXISTS update_user_usage_tracking();
DROP FUNCTION IF EXISTS create_default_subscription();

-- Drop views
DROP VIEW IF EXISTS user_statistics;
DROP VIEW IF EXISTS current_month_usage;
```

## Next Steps

After successfully running this migration:

1. ✅ **Database Schema Migration** - COMPLETED
2. 🔄 **Enhanced Authentication System** - Ready to implement
3. 🔄 **API Key Management System** - Ready to implement
4. 🔄 **Usage Tracking Service** - Ready to implement
5. 🔄 **Admin Panel Backend** - Ready to implement

The database foundation is now ready for the multi-tenant VoxFlow platform!
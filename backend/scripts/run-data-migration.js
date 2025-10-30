#!/usr/bin/env node

/**
 * VoxFlow Data Migration Script
 * 
 * This script handles the migration of existing data to the new multi-tenant structure.
 * It includes proper error handling, logging, and rollback capabilities.
 * 
 * Usage:
 *   node scripts/run-data-migration.js [--dry-run] [--rollback]
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Log message with timestamp
 */
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📋',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  }[type] || '📋';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
}

/**
 * Check if migration has already been run
 */
async function checkMigrationStatus() {
  try {
    // Check if admin user has been updated with new fields
    const { data: adminUser, error } = await supabase
      .from('users')
      .select('id, email, role, subscription_tier, organization_name')
      .eq('email', 'admin@voxflow.com')
      .single();

    if (error) {
      throw error;
    }

    const hasNewFields = adminUser.role && adminUser.subscription_tier && adminUser.organization_name;
    
    return {
      adminExists: !!adminUser,
      migrationComplete: hasNewFields,
      adminUser
    };
  } catch (error) {
    log(`Error checking migration status: ${error.message}`, 'error');
    return { adminExists: false, migrationComplete: false };
  }
}

/**
 * Get current data statistics before migration
 */
async function getPreMigrationStats() {
  try {
    const stats = {};
    
    // Count existing records
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    const { count: agentCount } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true });
    
    const { count: campaignCount } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true });
    
    const { count: runCount } = await supabase
      .from('agent_runs')
      .select('*', { count: 'exact', head: true });

    stats.users = userCount || 0;
    stats.agents = agentCount || 0;
    stats.campaigns = campaignCount || 0;
    stats.runs = runCount || 0;
    
    return stats;
  } catch (error) {
    log(`Error getting pre-migration stats: ${error.message}`, 'error');
    return {};
  }
}

/**
 * Run the data migration SQL script
 */
async function runMigration() {
  try {
    log('Starting data migration...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../../supabase/migrations/003_data_migration_scripts.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      throw error;
    }
    
    log('Data migration SQL executed successfully', 'success');
    return true;
  } catch (error) {
    log(`Migration execution failed: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Verify migration results
 */
async function verifyMigration() {
  try {
    log('Verifying migration results...');
    
    // Check admin user update
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@voxflow.com')
      .single();
    
    if (adminError) {
      throw adminError;
    }
    
    // Verify admin user fields
    const requiredFields = ['role', 'subscription_tier', 'organization_name', 'max_agents', 'monthly_token_quota'];
    const missingFields = requiredFields.filter(field => !adminUser[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Admin user missing fields: ${missingFields.join(', ')}`);
    }
    
    // Check agent ownership
    const { count: orphanedAgents } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .is('user_id', null);
    
    if (orphanedAgents > 0) {
      throw new Error(`Found ${orphanedAgents} agents without user ownership`);
    }
    
    // Check campaign ownership
    const { count: orphanedCampaigns } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .is('user_id', null);
    
    if (orphanedCampaigns > 0) {
      throw new Error(`Found ${orphanedCampaigns} campaigns without user ownership`);
    }
    
    // Check usage tracking initialization
    const { count: usageRecords } = await supabase
      .from('user_usage_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', adminUser.id);
    
    // Check subscription creation
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', adminUser.id)
      .single();
    
    if (!subscription) {
      throw new Error('Admin subscription not created');
    }
    
    log('Migration verification completed successfully', 'success');
    log(`✅ Admin user updated: ${adminUser.email} (${adminUser.role})`);
    log(`✅ Usage tracking records: ${usageRecords || 0}`);
    log(`✅ Subscription plan: ${subscription.plan}`);
    
    return true;
  } catch (error) {
    log(`Migration verification failed: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Run migration rollback
 */
async function runRollback() {
  try {
    log('Starting migration rollback...');
    
    const { data, error } = await supabase.rpc('rollback_data_migration');
    
    if (error) {
      throw error;
    }
    
    log(`Rollback result: ${data}`, 'success');
    return true;
  } catch (error) {
    log(`Rollback failed: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Dry run - show what would be migrated without making changes
 */
async function dryRun() {
  try {
    log('Running dry-run analysis...');
    
    const stats = await getPreMigrationStats();
    const status = await checkMigrationStatus();
    
    log('Current System State:');
    log(`  👥 Users: ${stats.users}`);
    log(`  🤖 Agents: ${stats.agents}`);
    log(`  📞 Campaigns: ${stats.campaigns}`);
    log(`  📊 Agent Runs: ${stats.runs}`);
    log(`  🔐 Admin User Exists: ${status.adminExists ? 'Yes' : 'No'}`);
    log(`  ✨ Migration Complete: ${status.migrationComplete ? 'Yes' : 'No'}`);
    
    if (status.migrationComplete) {
      log('Migration appears to already be complete', 'warning');
      return;
    }
    
    log('Migration would perform the following actions:');
    log('  1. Update admin user with multi-tenant fields');
    log(`  2. Assign ownership of ${stats.agents} agents to admin user`);
    log(`  3. Assign ownership of ${stats.campaigns} campaigns to admin user`);
    log('  4. Initialize usage tracking for existing data');
    log('  5. Create admin subscription record');
    log('  6. Verify data integrity');
    
    log('To run the actual migration, use: node scripts/run-data-migration.js');
  } catch (error) {
    log(`Dry run failed: ${error.message}`, 'error');
  }
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isRollback = args.includes('--rollback');
  
  log('VoxFlow Data Migration Script');
  log('==============================');
  
  if (isDryRun) {
    await dryRun();
    return;
  }
  
  if (isRollback) {
    const success = await runRollback();
    process.exit(success ? 0 : 1);
    return;
  }
  
  // Check current status
  const status = await checkMigrationStatus();
  
  if (!status.adminExists) {
    log('Admin user not found. Please run the initial schema migration first.', 'error');
    process.exit(1);
  }
  
  if (status.migrationComplete) {
    log('Migration appears to already be complete. Use --dry-run to verify.', 'warning');
    process.exit(0);
  }
  
  // Get pre-migration statistics
  const preStats = await getPreMigrationStats();
  log(`Pre-migration stats: ${preStats.users} users, ${preStats.agents} agents, ${preStats.campaigns} campaigns`);
  
  // Run the migration
  const migrationSuccess = await runMigration();
  
  if (!migrationSuccess) {
    log('Migration failed. Check the logs above for details.', 'error');
    process.exit(1);
  }
  
  // Verify the migration
  const verificationSuccess = await verifyMigration();
  
  if (!verificationSuccess) {
    log('Migration verification failed. Consider running rollback.', 'error');
    process.exit(1);
  }
  
  log('🎉 Data migration completed successfully!', 'success');
  log('Your VoxFlow system is now ready for multi-tenant operation.');
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  log(`Unhandled error: ${error.message}`, 'error');
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main().catch((error) => {
    log(`Script failed: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = {
  checkMigrationStatus,
  getPreMigrationStats,
  runMigration,
  verifyMigration,
  runRollback
};
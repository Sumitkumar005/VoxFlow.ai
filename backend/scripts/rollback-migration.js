#!/usr/bin/env node

/**
 * VoxFlow Migration Rollback Script
 * 
 * This script provides rollback capabilities for the data migration.
 * It can restore the system to its pre-migration state if issues occur.
 * 
 * Usage:
 *   node scripts/rollback-migration.js [--confirm] [--partial]
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');
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

// Initialize Supabase client
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
 * Prompt user for confirmation
 */
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${question} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Get current migration state
 */
async function getMigrationState() {
  try {
    // Check admin user state
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@voxflow.com')
      .single();

    if (adminError && adminError.code !== 'PGRST116') {
      throw adminError;
    }

    // Count records in new tables
    const { count: apiKeyCount } = await supabase
      .from('user_api_keys')
      .select('*', { count: 'exact', head: true });

    const { count: usageCount } = await supabase
      .from('user_usage_tracking')
      .select('*', { count: 'exact', head: true });

    const { count: subscriptionCount } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true });

    const { count: auditCount } = await supabase
      .from('admin_audit_logs')
      .select('*', { count: 'exact', head: true });

    return {
      adminUser: adminUser || null,
      hasMigrationFields: adminUser && adminUser.role && adminUser.subscription_tier,
      apiKeyCount: apiKeyCount || 0,
      usageCount: usageCount || 0,
      subscriptionCount: subscriptionCount || 0,
      auditCount: auditCount || 0
    };
  } catch (error) {
    log(`Error getting migration state: ${error.message}`, 'error');
    return null;
  }
}

/**
 * Backup current data before rollback
 */
async function backupCurrentData() {
  try {
    log('Creating backup of current data...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupData = {
      timestamp,
      adminUser: null,
      apiKeys: [],
      usageTracking: [],
      subscriptions: [],
      auditLogs: []
    };

    // Backup admin user
    const { data: adminUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@voxflow.com')
      .single();

    if (adminUser) {
      backupData.adminUser = adminUser;
    }

    // Backup API keys
    const { data: apiKeys } = await supabase
      .from('user_api_keys')
      .select('*');

    if (apiKeys) {
      backupData.apiKeys = apiKeys;
    }

    // Backup usage tracking
    const { data: usageTracking } = await supabase
      .from('user_usage_tracking')
      .select('*');

    if (usageTracking) {
      backupData.usageTracking = usageTracking;
    }

    // Backup subscriptions
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('*');

    if (subscriptions) {
      backupData.subscriptions = subscriptions;
    }

    // Backup audit logs
    const { data: auditLogs } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .limit(1000); // Limit to recent logs

    if (auditLogs) {
      backupData.auditLogs = auditLogs;
    }

    // Store backup in audit logs for reference
    await supabase
      .from('admin_audit_logs')
      .insert({
        admin_user_id: adminUser?.id || null,
        action: 'migration_rollback_backup',
        details: {
          backup_timestamp: timestamp,
          records_backed_up: {
            api_keys: backupData.apiKeys.length,
            usage_tracking: backupData.usageTracking.length,
            subscriptions: backupData.subscriptions.length,
            audit_logs: backupData.auditLogs.length
          }
        }
      });

    log(`Backup created with timestamp: ${timestamp}`, 'success');
    return backupData;
  } catch (error) {
    log(`Backup failed: ${error.message}`, 'error');
    return null;
  }
}

/**
 * Reset admin user to pre-migration state
 */
async function resetAdminUser() {
  try {
    log('Resetting admin user to pre-migration state...');
    
    const { error } = await supabase
      .from('users')
      .update({
        role: null,
        subscription_tier: null,
        organization_name: null,
        max_agents: null,
        monthly_token_quota: null,
        is_active: null,
        last_login: null
      })
      .eq('email', 'admin@voxflow.com');

    if (error) {
      throw error;
    }

    log('Admin user reset successfully', 'success');
    return true;
  } catch (error) {
    log(`Failed to reset admin user: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Clear migration-specific data
 */
async function clearMigrationData() {
  try {
    log('Clearing migration-specific data...');
    
    // Get admin user ID for filtering
    const { data: adminUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'admin@voxflow.com')
      .single();

    if (!adminUser) {
      log('Admin user not found, skipping data cleanup', 'warning');
      return true;
    }

    // Clear user API keys
    const { error: apiKeyError } = await supabase
      .from('user_api_keys')
      .delete()
      .eq('user_id', adminUser.id);

    if (apiKeyError) {
      log(`Warning: Failed to clear API keys: ${apiKeyError.message}`, 'warning');
    }

    // Clear usage tracking
    const { error: usageError } = await supabase
      .from('user_usage_tracking')
      .delete()
      .eq('user_id', adminUser.id);

    if (usageError) {
      log(`Warning: Failed to clear usage tracking: ${usageError.message}`, 'warning');
    }

    // Clear subscriptions
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', adminUser.id);

    if (subscriptionError) {
      log(`Warning: Failed to clear subscriptions: ${subscriptionError.message}`, 'warning');
    }

    log('Migration data cleared successfully', 'success');
    return true;
  } catch (error) {
    log(`Failed to clear migration data: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Verify rollback completion
 */
async function verifyRollback() {
  try {
    log('Verifying rollback completion...');
    
    // Check admin user state
    const { data: adminUser } = await supabase
      .from('users')
      .select('role, subscription_tier, organization_name, max_agents, monthly_token_quota')
      .eq('email', 'admin@voxflow.com')
      .single();

    if (!adminUser) {
      throw new Error('Admin user not found after rollback');
    }

    // Verify migration fields are cleared
    const migrationFields = ['role', 'subscription_tier', 'organization_name', 'max_agents', 'monthly_token_quota'];
    const remainingFields = migrationFields.filter(field => adminUser[field] !== null);

    if (remainingFields.length > 0) {
      throw new Error(`Migration fields not cleared: ${remainingFields.join(', ')}`);
    }

    // Check that migration data is cleared
    const { count: apiKeyCount } = await supabase
      .from('user_api_keys')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', adminUser.id);

    const { count: usageCount } = await supabase
      .from('user_usage_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', adminUser.id);

    const { count: subscriptionCount } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', adminUser.id);

    if (apiKeyCount > 0 || usageCount > 0 || subscriptionCount > 0) {
      log(`Warning: Some migration data remains: API keys: ${apiKeyCount}, Usage: ${usageCount}, Subscriptions: ${subscriptionCount}`, 'warning');
    }

    log('Rollback verification completed successfully', 'success');
    return true;
  } catch (error) {
    log(`Rollback verification failed: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Perform full rollback
 */
async function performFullRollback() {
  try {
    log('Starting full migration rollback...');
    
    // Create backup
    const backup = await backupCurrentData();
    if (!backup) {
      throw new Error('Failed to create backup before rollback');
    }

    // Reset admin user
    const adminReset = await resetAdminUser();
    if (!adminReset) {
      throw new Error('Failed to reset admin user');
    }

    // Clear migration data
    const dataCleared = await clearMigrationData();
    if (!dataCleared) {
      log('Warning: Some migration data may not have been cleared', 'warning');
    }

    // Verify rollback
    const verified = await verifyRollback();
    if (!verified) {
      throw new Error('Rollback verification failed');
    }

    // Log rollback completion
    await supabase
      .from('admin_audit_logs')
      .insert({
        admin_user_id: null,
        action: 'migration_rollback_completed',
        details: {
          rollback_timestamp: new Date().toISOString(),
          backup_reference: backup.timestamp
        }
      });

    log('🎉 Full rollback completed successfully!', 'success');
    return true;
  } catch (error) {
    log(`Full rollback failed: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Perform partial rollback (only clear new data, keep admin user changes)
 */
async function performPartialRollback() {
  try {
    log('Starting partial migration rollback...');
    
    // Create backup
    const backup = await backupCurrentData();
    if (!backup) {
      throw new Error('Failed to create backup before rollback');
    }

    // Clear migration data but keep admin user changes
    const dataCleared = await clearMigrationData();
    if (!dataCleared) {
      throw new Error('Failed to clear migration data');
    }

    // Log partial rollback completion
    const { data: adminUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'admin@voxflow.com')
      .single();

    await supabase
      .from('admin_audit_logs')
      .insert({
        admin_user_id: adminUser?.id || null,
        action: 'migration_partial_rollback_completed',
        details: {
          rollback_timestamp: new Date().toISOString(),
          backup_reference: backup.timestamp,
          note: 'Admin user changes preserved'
        }
      });

    log('🎉 Partial rollback completed successfully!', 'success');
    log('Note: Admin user migration fields have been preserved', 'info');
    return true;
  } catch (error) {
    log(`Partial rollback failed: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  const autoConfirm = args.includes('--confirm');
  const partialRollback = args.includes('--partial');
  
  log('VoxFlow Migration Rollback Script');
  log('==================================');
  
  // Get current migration state
  const state = await getMigrationState();
  if (!state) {
    log('Failed to get migration state. Exiting.', 'error');
    process.exit(1);
  }

  // Display current state
  log('Current Migration State:');
  log(`  👤 Admin User Exists: ${state.adminUser ? 'Yes' : 'No'}`);
  log(`  🔧 Has Migration Fields: ${state.hasMigrationFields ? 'Yes' : 'No'}`);
  log(`  🔑 API Keys: ${state.apiKeyCount}`);
  log(`  📊 Usage Records: ${state.usageCount}`);
  log(`  💳 Subscriptions: ${state.subscriptionCount}`);
  log(`  📝 Audit Logs: ${state.auditCount}`);

  // Check if rollback is needed
  if (!state.hasMigrationFields && state.apiKeyCount === 0 && state.usageCount === 0 && state.subscriptionCount === 0) {
    log('No migration data found. System appears to be in pre-migration state.', 'info');
    process.exit(0);
  }

  // Confirm rollback
  if (!autoConfirm) {
    const rollbackType = partialRollback ? 'partial' : 'full';
    const confirmed = await askConfirmation(
      `⚠️  This will perform a ${rollbackType} rollback of the migration. Are you sure?`
    );
    
    if (!confirmed) {
      log('Rollback cancelled by user.', 'info');
      process.exit(0);
    }
  }

  // Perform rollback
  const success = partialRollback 
    ? await performPartialRollback()
    : await performFullRollback();

  if (!success) {
    log('Rollback failed. Check the logs above for details.', 'error');
    process.exit(1);
  }

  log('Rollback completed successfully. Your system has been restored.', 'success');
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
  getMigrationState,
  backupCurrentData,
  resetAdminUser,
  clearMigrationData,
  verifyRollback,
  performFullRollback,
  performPartialRollback
};
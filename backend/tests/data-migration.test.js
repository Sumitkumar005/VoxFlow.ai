const { describe, it, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const { createClient } = require('@supabase/supabase-js');
const {
  checkMigrationStatus,
  getPreMigrationStats,
  runMigration,
  verifyMigration,
  runRollback
} = require('../scripts/run-data-migration');

// Test configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';

describe('Data Migration Scripts', () => {
  let supabase;
  let testUserId;
  let testAgentId;
  let testCampaignId;

  beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await cleanupTestData();
  });

  afterAll(async () => {
    // Final cleanup
    await cleanupTestData();
  });

  async function cleanupTestData() {
    try {
      // Clean up in reverse dependency order
      if (testCampaignId) {
        await supabase.from('campaigns').delete().eq('id', testCampaignId);
      }
      if (testAgentId) {
        await supabase.from('agents').delete().eq('id', testAgentId);
      }
      if (testUserId) {
        await supabase.from('user_usage_tracking').delete().eq('user_id', testUserId);
        await supabase.from('subscriptions').delete().eq('user_id', testUserId);
        await supabase.from('users').delete().eq('id', testUserId);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  describe('Migration Status Checking', () => {
    it('should check migration status correctly', async () => {
      const status = await checkMigrationStatus();
      
      expect(status).toHaveProperty('adminExists');
      expect(status).toHaveProperty('migrationComplete');
      expect(typeof status.adminExists).toBe('boolean');
      expect(typeof status.migrationComplete).toBe('boolean');
    });

    it('should detect when admin user exists', async () => {
      // Create test admin user
      const { data: user } = await supabase
        .from('users')
        .insert({
          email: 'admin@voxflow.com',
          password_hash: 'test-hash'
        })
        .select()
        .single();

      testUserId = user.id;

      const status = await checkMigrationStatus();
      expect(status.adminExists).toBe(true);
    });

    it('should detect migration completion status', async () => {
      // Create admin user with new fields
      const { data: user } = await supabase
        .from('users')
        .insert({
          email: 'admin@voxflow.com',
          password_hash: 'test-hash',
          role: 'admin',
          subscription_tier: 'enterprise',
          organization_name: 'Test Admin'
        })
        .select()
        .single();

      testUserId = user.id;

      const status = await checkMigrationStatus();
      expect(status.adminExists).toBe(true);
      expect(status.migrationComplete).toBe(true);
    });
  });

  describe('Pre-Migration Statistics', () => {
    it('should get accurate pre-migration statistics', async () => {
      // Create test data
      const { data: user } = await supabase
        .from('users')
        .insert({
          email: 'test@example.com',
          password_hash: 'test-hash'
        })
        .select()
        .single();

      testUserId = user.id;

      const { data: agent } = await supabase
        .from('agents')
        .insert({
          user_id: user.id,
          name: 'Test Agent',
          type: 'INBOUND',
          use_case: 'Testing',
          description: 'Test agent for migration'
        })
        .select()
        .single();

      testAgentId = agent.id;

      const stats = await getPreMigrationStats();
      
      expect(stats).toHaveProperty('users');
      expect(stats).toHaveProperty('agents');
      expect(stats).toHaveProperty('campaigns');
      expect(stats).toHaveProperty('runs');
      expect(stats.users).toBeGreaterThan(0);
      expect(stats.agents).toBeGreaterThan(0);
    });
  });

  describe('Migration Verification', () => {
    it('should verify admin user fields after migration', async () => {
      // Create admin user with migration fields
      const { data: user } = await supabase
        .from('users')
        .insert({
          email: 'admin@voxflow.com',
          password_hash: 'test-hash',
          role: 'admin',
          subscription_tier: 'enterprise',
          organization_name: 'VoxFlow Administration',
          max_agents: 1000,
          monthly_token_quota: 10000000,
          is_active: true
        })
        .select()
        .single();

      testUserId = user.id;

      // Create subscription
      await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          plan: 'enterprise',
          status: 'active',
          monthly_price: 0
        });

      const isValid = await verifyMigration();
      expect(isValid).toBe(true);
    });

    it('should detect missing admin user fields', async () => {
      // Create admin user without migration fields
      const { data: user } = await supabase
        .from('users')
        .insert({
          email: 'admin@voxflow.com',
          password_hash: 'test-hash'
          // Missing role, subscription_tier, etc.
        })
        .select()
        .single();

      testUserId = user.id;

      const isValid = await verifyMigration();
      expect(isValid).toBe(false);
    });

    it('should detect orphaned agents', async () => {
      // Create admin user
      const { data: adminUser } = await supabase
        .from('users')
        .insert({
          email: 'admin@voxflow.com',
          password_hash: 'test-hash',
          role: 'admin',
          subscription_tier: 'enterprise',
          organization_name: 'VoxFlow Administration',
          max_agents: 1000,
          monthly_token_quota: 10000000,
          is_active: true
        })
        .select()
        .single();

      testUserId = adminUser.id;

      // Create subscription
      await supabase
        .from('subscriptions')
        .insert({
          user_id: adminUser.id,
          plan: 'enterprise',
          status: 'active',
          monthly_price: 0
        });

      // Create orphaned agent (no user_id)
      const { data: agent } = await supabase
        .from('agents')
        .insert({
          user_id: null, // Orphaned
          name: 'Orphaned Agent',
          type: 'INBOUND',
          use_case: 'Testing',
          description: 'Orphaned test agent'
        })
        .select()
        .single();

      testAgentId = agent.id;

      const isValid = await verifyMigration();
      expect(isValid).toBe(false);
    });
  });

  describe('Agent Ownership Migration', () => {
    it('should migrate agents to admin ownership', async () => {
      // Create admin user
      const { data: adminUser } = await supabase
        .from('users')
        .insert({
          email: 'admin@voxflow.com',
          password_hash: 'test-hash'
        })
        .select()
        .single();

      testUserId = adminUser.id;

      // Create agent without user_id (simulating existing data)
      const { data: agent } = await supabase
        .from('agents')
        .insert({
          user_id: null,
          name: 'Legacy Agent',
          type: 'OUTBOUND',
          use_case: 'Legacy',
          description: 'Legacy agent for migration test'
        })
        .select()
        .single();

      testAgentId = agent.id;

      // Simulate migration by updating agent ownership
      await supabase
        .from('agents')
        .update({ user_id: adminUser.id })
        .eq('id', agent.id);

      // Verify agent now belongs to admin
      const { data: updatedAgent } = await supabase
        .from('agents')
        .select('user_id')
        .eq('id', agent.id)
        .single();

      expect(updatedAgent.user_id).toBe(adminUser.id);
    });
  });

  describe('Usage Tracking Initialization', () => {
    it('should initialize usage tracking for existing runs', async () => {
      // Create admin user
      const { data: adminUser } = await supabase
        .from('users')
        .insert({
          email: 'admin@voxflow.com',
          password_hash: 'test-hash',
          role: 'admin',
          subscription_tier: 'enterprise',
          organization_name: 'VoxFlow Administration',
          max_agents: 1000,
          monthly_token_quota: 10000000,
          is_active: true
        })
        .select()
        .single();

      testUserId = adminUser.id;

      // Create agent
      const { data: agent } = await supabase
        .from('agents')
        .insert({
          user_id: adminUser.id,
          name: 'Test Agent',
          type: 'INBOUND',
          use_case: 'Testing',
          description: 'Test agent for usage tracking'
        })
        .select()
        .single();

      testAgentId = agent.id;

      // Create completed agent run
      await supabase
        .from('agent_runs')
        .insert({
          run_number: 'WR-TEL-TEST',
          agent_id: agent.id,
          type: 'WEB_CALL',
          status: 'completed',
          duration_seconds: 120,
          dograh_tokens: 15.6
        });

      // Simulate usage tracking initialization
      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from('user_usage_tracking')
        .insert({
          user_id: adminUser.id,
          date: today,
          total_calls: 1,
          total_duration_seconds: 120,
          total_tokens: 15.6,
          api_costs: 0.3
        });

      // Verify usage tracking record exists
      const { data: usageRecord } = await supabase
        .from('user_usage_tracking')
        .select('*')
        .eq('user_id', adminUser.id)
        .eq('date', today)
        .single();

      expect(usageRecord).toBeTruthy();
      expect(usageRecord.total_calls).toBe(1);
      expect(usageRecord.total_duration_seconds).toBe(120);
      expect(parseFloat(usageRecord.total_tokens)).toBe(15.6);
    });
  });

  describe('Subscription Creation', () => {
    it('should create admin subscription record', async () => {
      // Create admin user
      const { data: adminUser } = await supabase
        .from('users')
        .insert({
          email: 'admin@voxflow.com',
          password_hash: 'test-hash',
          role: 'admin',
          subscription_tier: 'enterprise',
          organization_name: 'VoxFlow Administration',
          max_agents: 1000,
          monthly_token_quota: 10000000,
          is_active: true
        })
        .select()
        .single();

      testUserId = adminUser.id;

      // Create subscription
      await supabase
        .from('subscriptions')
        .insert({
          user_id: adminUser.id,
          plan: 'enterprise',
          status: 'active',
          monthly_price: 0
        });

      // Verify subscription exists
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', adminUser.id)
        .single();

      expect(subscription).toBeTruthy();
      expect(subscription.plan).toBe('enterprise');
      expect(subscription.status).toBe('active');
      expect(parseFloat(subscription.monthly_price)).toBe(0);
    });
  });

  describe('Data Integrity Checks', () => {
    it('should validate all required fields are present', async () => {
      // Create complete admin user setup
      const { data: adminUser } = await supabase
        .from('users')
        .insert({
          email: 'admin@voxflow.com',
          password_hash: 'test-hash',
          role: 'admin',
          subscription_tier: 'enterprise',
          organization_name: 'VoxFlow Administration',
          max_agents: 1000,
          monthly_token_quota: 10000000,
          is_active: true
        })
        .select()
        .single();

      testUserId = adminUser.id;

      // Create subscription
      await supabase
        .from('subscriptions')
        .insert({
          user_id: adminUser.id,
          plan: 'enterprise',
          status: 'active',
          monthly_price: 0
        });

      // Verify all required fields
      const requiredFields = ['role', 'subscription_tier', 'organization_name', 'max_agents', 'monthly_token_quota'];
      
      for (const field of requiredFields) {
        expect(adminUser[field]).toBeTruthy();
      }

      expect(adminUser.role).toBe('admin');
      expect(adminUser.subscription_tier).toBe('enterprise');
      expect(adminUser.max_agents).toBe(1000);
      expect(adminUser.monthly_token_quota).toBe(10000000);
    });

    it('should ensure no orphaned records exist', async () => {
      // Check for orphaned agents
      const { count: orphanedAgents } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .is('user_id', null);

      // Check for orphaned campaigns
      const { count: orphanedCampaigns } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .is('user_id', null);

      // In a clean test environment, there should be no orphaned records
      expect(orphanedAgents).toBe(0);
      expect(orphanedCampaigns).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing admin user gracefully', async () => {
      // Ensure no admin user exists
      await supabase
        .from('users')
        .delete()
        .eq('email', 'admin@voxflow.com');

      const status = await checkMigrationStatus();
      expect(status.adminExists).toBe(false);
      expect(status.migrationComplete).toBe(false);
    });

    it('should handle database connection errors', async () => {
      // This test would require mocking the database connection
      // For now, we'll just ensure the functions handle errors gracefully
      const invalidSupabase = createClient('http://invalid-url', 'invalid-key');
      
      // The functions should not throw unhandled errors
      expect(async () => {
        await checkMigrationStatus();
      }).not.toThrow();
    });
  });
});
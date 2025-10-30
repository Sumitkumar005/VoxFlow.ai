import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  saveUserAPIKey,
  getUserAPIKey,
  getUserAPIKeyStatus,
  deleteUserAPIKey,
  validateUserAPIKeys,
  saveUserAPIKeys,
  testAPIKey,
  getAPIKeyUsageStats,
  SUPPORTED_PROVIDERS,
} from '../src/services/user-keys.service.js';
import { query } from '../src/utils/supabase.js';
import { generateTestAPIKey } from '../src/utils/encryption.js';

// Mock the supabase utility
jest.mock('../src/utils/supabase.js');

describe('User API Keys Service', () => {
  const testUserId = 'user-123';
  const testAPIKeys = {
    groq: generateTestAPIKey('groq'),
    deepgram: generateTestAPIKey('deepgram'),
    twilio: generateTestAPIKey('twilio'),
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('saveUserAPIKey', () => {
    it('should save API key successfully', async () => {
      const mockResponse = {
        data: [{
          id: 'key-123',
          user_id: testUserId,
          provider: 'groq',
          created_at: new Date().toISOString(),
        }],
        error: null,
      };

      query.mockResolvedValueOnce(mockResponse);

      const result = await saveUserAPIKey(testUserId, 'groq', testAPIKeys.groq);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('groq');
      expect(result.message).toContain('saved successfully');
      expect(query).toHaveBeenCalledWith('user_api_keys', 'upsert', expect.objectContaining({
        data: expect.objectContaining({
          user_id: testUserId,
          provider: 'groq',
          is_active: true,
        }),
      }));
    });

    it('should throw error for invalid user ID', async () => {
      await expect(saveUserAPIKey('', 'groq', testAPIKeys.groq))
        .rejects.toThrow('Invalid user ID');
      
      await expect(saveUserAPIKey(null, 'groq', testAPIKeys.groq))
        .rejects.toThrow('Invalid user ID');
    });

    it('should throw error for unsupported provider', async () => {
      await expect(saveUserAPIKey(testUserId, 'unsupported', 'test-key'))
        .rejects.toThrow('Unsupported provider');
    });

    it('should throw error for invalid API key format', async () => {
      await expect(saveUserAPIKey(testUserId, 'groq', 'invalid-key'))
        .rejects.toThrow('Invalid API key format');
    });

    it('should handle database errors', async () => {
      query.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      await expect(saveUserAPIKey(testUserId, 'groq', testAPIKeys.groq))
        .rejects.toThrow('Database error');
    });
  });

  describe('getUserAPIKey', () => {
    it('should retrieve and decrypt API key successfully', async () => {
      const mockEncryptedData = {
        api_key_encrypted: 'encrypted-data',
        iv: '1234567890abcdef1234567890abcdef',
        auth_tag: 'fedcba0987654321fedcba0987654321',
        created_at: new Date().toISOString(),
        last_used_at: null,
      };

      query.mockResolvedValueOnce({
        data: [mockEncryptedData],
        error: null,
      });

      // Mock the update call for last_used_at
      query.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Since we're mocking, we need to mock the decryption as well
      // In a real test, this would use the actual encryption/decryption
      const result = await getUserAPIKey(testUserId, 'groq');

      expect(query).toHaveBeenCalledWith('user_api_keys', 'select', expect.objectContaining({
        filter: {
          user_id: testUserId,
          provider: 'groq',
          is_active: true,
        },
      }));
    });

    it('should throw error when API key not found', async () => {
      query.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await expect(getUserAPIKey(testUserId, 'groq'))
        .rejects.toThrow('No groq API key configured');
    });

    it('should throw error for invalid user ID', async () => {
      await expect(getUserAPIKey('', 'groq'))
        .rejects.toThrow('Invalid user ID');
    });

    it('should throw error for unsupported provider', async () => {
      await expect(getUserAPIKey(testUserId, 'unsupported'))
        .rejects.toThrow('Unsupported provider');
    });
  });

  describe('getUserAPIKeyStatus', () => {
    it('should return status for all providers', async () => {
      const mockData = [
        {
          provider: 'groq',
          created_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        },
        {
          provider: 'deepgram',
          created_at: new Date().toISOString(),
          last_used_at: null,
        },
      ];

      query.mockResolvedValueOnce({
        data: mockData,
        error: null,
      });

      const status = await getUserAPIKeyStatus(testUserId);

      expect(status.groq.configured).toBe(true);
      expect(status.deepgram.configured).toBe(true);
      expect(status.twilio.configured).toBe(false);
      expect(status.groq.last_used_at).toBeTruthy();
      expect(status.deepgram.last_used_at).toBeNull();
    });

    it('should handle empty results', async () => {
      query.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const status = await getUserAPIKeyStatus(testUserId);

      SUPPORTED_PROVIDERS.forEach(provider => {
        expect(status[provider].configured).toBe(false);
        expect(status[provider].created_at).toBeNull();
        expect(status[provider].last_used_at).toBeNull();
      });
    });
  });

  describe('deleteUserAPIKey', () => {
    it('should soft delete API key successfully', async () => {
      query.mockResolvedValueOnce({
        data: [{ id: 'key-123' }],
        error: null,
      });

      const result = await deleteUserAPIKey(testUserId, 'groq');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('groq');
      expect(query).toHaveBeenCalledWith('user_api_keys', 'update', expect.objectContaining({
        filter: { user_id: testUserId, provider: 'groq' },
        data: { is_active: false },
      }));
    });

    it('should throw error when API key not found', async () => {
      query.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await expect(deleteUserAPIKey(testUserId, 'groq'))
        .rejects.toThrow('No groq API key found');
    });
  });

  describe('validateUserAPIKeys', () => {
    it('should validate all required keys are configured', async () => {
      const mockStatus = {
        groq: { configured: true },
        deepgram: { configured: true },
        twilio: { configured: true },
      };

      // Mock getUserAPIKeyStatus
      query.mockResolvedValueOnce({
        data: [
          { provider: 'groq', created_at: new Date().toISOString() },
          { provider: 'deepgram', created_at: new Date().toISOString() },
          { provider: 'twilio', created_at: new Date().toISOString() },
        ],
        error: null,
      });

      const result = await validateUserAPIKeys(testUserId);

      expect(result.valid).toBe(true);
      expect(result.configured).toEqual(SUPPORTED_PROVIDERS);
      expect(result.missing).toEqual([]);
    });

    it('should identify missing API keys', async () => {
      query.mockResolvedValueOnce({
        data: [
          { provider: 'groq', created_at: new Date().toISOString() },
        ],
        error: null,
      });

      const result = await validateUserAPIKeys(testUserId);

      expect(result.valid).toBe(false);
      expect(result.configured).toEqual(['groq']);
      expect(result.missing).toEqual(['deepgram', 'twilio']);
      expect(result.message).toContain('Missing API keys for: deepgram, twilio');
    });
  });

  describe('saveUserAPIKeys', () => {
    it('should save multiple API keys successfully', async () => {
      // Mock successful saves for all keys
      query.mockResolvedValue({
        data: [{ id: 'key-123' }],
        error: null,
      });

      const result = await saveUserAPIKeys(testUserId, testAPIKeys);

      expect(result.success).toBe(true);
      expect(result.results.success).toEqual(['groq', 'deepgram', 'twilio']);
      expect(result.results.failed).toEqual([]);
    });

    it('should handle partial failures', async () => {
      // Mock success for groq, failure for deepgram, success for twilio
      query
        .mockResolvedValueOnce({ data: [{ id: 'key-1' }], error: null }) // groq success
        .mockResolvedValueOnce({ data: null, error: { message: 'DB error' } }) // deepgram failure
        .mockResolvedValueOnce({ data: [{ id: 'key-3' }], error: null }); // twilio success

      const result = await saveUserAPIKeys(testUserId, testAPIKeys);

      expect(result.success).toBe(false);
      expect(result.results.success).toEqual(['groq', 'twilio']);
      expect(result.results.failed).toHaveLength(1);
      expect(result.results.failed[0].provider).toBe('deepgram');
    });

    it('should skip empty API keys', async () => {
      const partialKeys = {
        groq: testAPIKeys.groq,
        deepgram: '',
        twilio: null,
      };

      query.mockResolvedValueOnce({
        data: [{ id: 'key-1' }],
        error: null,
      });

      const result = await saveUserAPIKeys(testUserId, partialKeys);

      expect(result.success).toBe(true);
      expect(result.results.success).toEqual(['groq']);
      expect(query).toHaveBeenCalledTimes(1); // Only called for groq
    });
  });

  describe('testAPIKey', () => {
    it('should validate API key format', async () => {
      const result = await testAPIKey('groq', testAPIKeys.groq);

      expect(result.valid).toBe(true);
      expect(result.provider).toBe('groq');
      expect(result.message).toContain('format is valid');
    });

    it('should reject invalid API key format', async () => {
      const result = await testAPIKey('groq', 'invalid-key');

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Invalid API key format');
    });

    it('should reject unsupported provider', async () => {
      const result = await testAPIKey('unsupported', 'test-key');

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Unsupported provider');
    });
  });

  describe('getAPIKeyUsageStats', () => {
    it('should return usage statistics', async () => {
      const mockKeyData = [
        {
          provider: 'groq',
          created_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        },
      ];

      const mockUsageData = [
        {
          date: '2024-01-01',
          total_tokens: 100,
          total_calls: 5,
          api_costs: 0.01,
        },
        {
          date: '2024-01-02',
          total_tokens: 200,
          total_calls: 10,
          api_costs: 0.02,
        },
      ];

      query
        .mockResolvedValueOnce({ data: mockKeyData, error: null })
        .mockResolvedValueOnce({ data: mockUsageData, error: null });

      const stats = await getAPIKeyUsageStats(testUserId);

      expect(stats.configured_keys).toBe(1);
      expect(stats.key_details).toEqual(mockKeyData);
      expect(stats.usage_summary.total_tokens).toBe(300);
      expect(stats.usage_summary.total_calls).toBe(15);
      expect(stats.usage_summary.total_costs).toBe(0.03);
      expect(stats.daily_usage).toEqual(mockUsageData);
    });

    it('should handle no usage data', async () => {
      query
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const stats = await getAPIKeyUsageStats(testUserId);

      expect(stats.configured_keys).toBe(0);
      expect(stats.usage_summary.total_tokens).toBe(0);
      expect(stats.usage_summary.total_calls).toBe(0);
      expect(stats.usage_summary.total_costs).toBe(0);
    });
  });

  describe('SUPPORTED_PROVIDERS', () => {
    it('should export correct supported providers', () => {
      expect(SUPPORTED_PROVIDERS).toEqual(['groq', 'deepgram', 'twilio']);
    });
  });
});
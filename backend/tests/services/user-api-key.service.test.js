const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const { createClient } = require('@supabase/supabase-js');
const {
  saveUserAPIKey,
  getUserAPIKey,
  deleteUserAPIKey,
  getUserAPIKeyStatus,
  validateUserAPIKeys,
  SUPPORTED_PROVIDERS
} = require('../../src/services/user-api-key.service.js');

// Mock Supabase
jest.mock('@supabase/supabase-js');
jest.mock('../../src/services/encryption.service.js');

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  single: jest.fn(),
  upsert: jest.fn(() => mockSupabase)
};

const mockEncryption = require('../../src/services/encryption.service.js');

describe('User API Key Service', () => {
  const testUserId = 'test-user-123';
  const testProvider = 'groq';
  const testAPIKey = 'gsk_test-api-key-12345';
  const testEncryptedData = {
    encrypted: 'encrypted-data',
    iv: 'test-iv',
    authTag: 'test-auth-tag'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    createClient.mockReturnValue(mockSupabase);
    
    // Mock encryption functions
    mockEncryption.encryptAPIKey.mockResolvedValue(testEncryptedData);
    mockEncryption.decryptAPIKey.mockResolvedValue(testAPIKey);
    mockEncryption.isValidEncryptionKey.mockReturnValue(true);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('SUPPORTED_PROVIDERS', () => {
    it('should include all required providers', () => {
      expect(SUPPORTED_PROVIDERS).toContain('groq');
      expect(SUPPORTED_PROVIDERS).toContain('deepgram');
      expect(SUPPORTED_PROVIDERS).toContain('twilio');
      expect(SUPPORTED_PROVIDERS.length).toBe(3);
    });
  });

  describe('saveUserAPIKey', () => {
    it('should save API key successfully', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });
      mockSupabase.upsert.mockResolvedValue({ data: { id: 'test-id' }, error: null });

      const result = await saveUserAPIKey(testUserId, testProvider, testAPIKey);

      expect(result).toBe(true);
      expect(mockEncryption.encryptAPIKey).toHaveBeenCalledWith(testAPIKey, expect.any(String));
      expect(mockSupabase.upsert).toHaveBeenCalledWith({
        user_id: testUserId,
        provider: testProvider,
        api_key_encrypted: testEncryptedData.encrypted,
        iv: testEncryptedData.iv,
        auth_tag: testEncryptedData.authTag,
        is_active: true,
        last_used_at: null
      });
    });

    it('should validate provider', async () => {
      await expect(saveUserAPIKey(testUserId, 'invalid-provider', testAPIKey))
        .rejects.toThrow('Unsupported provider');
    });

    it('should validate user ID', async () => {
      await expect(saveUserAPIKey('', testProvider, testAPIKey))
        .rejects.toThrow('User ID is required');
      
      await expect(saveUserAPIKey(null, testProvider, testAPIKey))
        .rejects.toThrow('User ID is required');
    });

    it('should validate API key', async () => {
      await expect(saveUserAPIKey(testUserId, testProvider, ''))
        .rejects.toThrow('API key is required');
      
      await expect(saveUserAPIKey(testUserId, testProvider, null))
        .rejects.toThrow('API key is required');
    });

    it('should handle encryption errors', async () => {
      mockEncryption.encryptAPIKey.mockRejectedValue(new Error('Encryption failed'));

      await expect(saveUserAPIKey(testUserId, testProvider, testAPIKey))
        .rejects.toThrow('Encryption failed');
    });

    it('should handle database errors', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });
      mockSupabase.upsert.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });

      await expect(saveUserAPIKey(testUserId, testProvider, testAPIKey))
        .rejects.toThrow('Database error');
    });

    it('should update existing API key', async () => {
      mockSupabase.single.mockResolvedValue({ 
        data: { id: 'existing-id' }, 
        error: null 
      });
      mockSupabase.upsert.mockResolvedValue({ data: { id: 'existing-id' }, error: null });

      const result = await saveUserAPIKey(testUserId, testProvider, testAPIKey);

      expect(result).toBe(true);
      expect(mockSupabase.upsert).toHaveBeenCalled();
    });
  });

  describe('getUserAPIKey', () => {
    it('should retrieve and decrypt API key successfully', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          api_key_encrypted: testEncryptedData.encrypted,
          iv: testEncryptedData.iv,
          auth_tag: testEncryptedData.authTag
        },
        error: null
      });

      const result = await getUserAPIKey(testUserId, testProvider);

      expect(result).toBe(testAPIKey);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_api_keys');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', testUserId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('provider', testProvider);
      expect(mockEncryption.decryptAPIKey).toHaveBeenCalledWith(
        testEncryptedData.encrypted,
        expect.any(String),
        testEncryptedData.iv,
        testEncryptedData.authTag
      );
    });

    it('should validate provider', async () => {
      await expect(getUserAPIKey(testUserId, 'invalid-provider'))
        .rejects.toThrow('Unsupported provider');
    });

    it('should validate user ID', async () => {
      await expect(getUserAPIKey('', testProvider))
        .rejects.toThrow('User ID is required');
    });

    it('should handle API key not found', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      await expect(getUserAPIKey(testUserId, testProvider))
        .rejects.toThrow('API key not found');
    });

    it('should handle database errors', async () => {
      mockSupabase.single.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });

      await expect(getUserAPIKey(testUserId, testProvider))
        .rejects.toThrow('Database error');
    });

    it('should handle decryption errors', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          api_key_encrypted: testEncryptedData.encrypted,
          iv: testEncryptedData.iv,
          auth_tag: testEncryptedData.authTag
        },
        error: null
      });
      mockEncryption.decryptAPIKey.mockRejectedValue(new Error('Decryption failed'));

      await expect(getUserAPIKey(testUserId, testProvider))
        .rejects.toThrow('Decryption failed');
    });

    it('should update last_used_at timestamp', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'test-id',
          api_key_encrypted: testEncryptedData.encrypted,
          iv: testEncryptedData.iv,
          auth_tag: testEncryptedData.authTag
        },
        error: null
      });
      mockSupabase.update.mockResolvedValue({ data: {}, error: null });

      await getUserAPIKey(testUserId, testProvider);

      expect(mockSupabase.update).toHaveBeenCalledWith({
        last_used_at: expect.any(String)
      });
    });
  });

  describe('deleteUserAPIKey', () => {
    it('should delete API key successfully', async () => {
      mockSupabase.delete.mockResolvedValue({ data: {}, error: null });

      const result = await deleteUserAPIKey(testUserId, testProvider);

      expect(result).toBe(true);
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', testUserId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('provider', testProvider);
    });

    it('should validate provider', async () => {
      await expect(deleteUserAPIKey(testUserId, 'invalid-provider'))
        .rejects.toThrow('Unsupported provider');
    });

    it('should validate user ID', async () => {
      await expect(deleteUserAPIKey('', testProvider))
        .rejects.toThrow('User ID is required');
    });

    it('should handle database errors', async () => {
      mockSupabase.delete.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });

      await expect(deleteUserAPIKey(testUserId, testProvider))
        .rejects.toThrow('Database error');
    });
  });

  describe('getUserAPIKeyStatus', () => {
    it('should return status for all providers', async () => {
      mockSupabase.select.mockResolvedValue({
        data: [
          { provider: 'groq', is_active: true, last_used_at: '2024-01-01T00:00:00Z' },
          { provider: 'deepgram', is_active: true, last_used_at: null }
        ],
        error: null
      });

      const result = await getUserAPIKeyStatus(testUserId);

      expect(result).toHaveLength(3); // All supported providers
      expect(result.find(r => r.provider === 'groq')).toEqual({
        provider: 'groq',
        configured: true,
        active: true,
        last_used: '2024-01-01T00:00:00Z'
      });
      expect(result.find(r => r.provider === 'deepgram')).toEqual({
        provider: 'deepgram',
        configured: true,
        active: true,
        last_used: null
      });
      expect(result.find(r => r.provider === 'twilio')).toEqual({
        provider: 'twilio',
        configured: false,
        active: false,
        last_used: null
      });
    });

    it('should validate user ID', async () => {
      await expect(getUserAPIKeyStatus(''))
        .rejects.toThrow('User ID is required');
    });

    it('should handle database errors', async () => {
      mockSupabase.select.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });

      await expect(getUserAPIKeyStatus(testUserId))
        .rejects.toThrow('Database error');
    });

    it('should handle empty results', async () => {
      mockSupabase.select.mockResolvedValue({ data: [], error: null });

      const result = await getUserAPIKeyStatus(testUserId);

      expect(result).toHaveLength(3);
      result.forEach(status => {
        expect(status.configured).toBe(false);
        expect(status.active).toBe(false);
        expect(status.last_used).toBe(null);
      });
    });
  });

  describe('validateUserAPIKeys', () => {
    it('should validate all providers by default', async () => {
      mockSupabase.select.mockResolvedValue({
        data: [
          { provider: 'groq', is_active: true },
          { provider: 'deepgram', is_active: true }
        ],
        error: null
      });

      const result = await validateUserAPIKeys(testUserId);

      expect(result.missing).toEqual(['twilio']);
      expect(result.configured).toEqual(['groq', 'deepgram']);
      expect(result.all_configured).toBe(false);
    });

    it('should validate specific providers', async () => {
      mockSupabase.select.mockResolvedValue({
        data: [{ provider: 'groq', is_active: true }],
        error: null
      });

      const result = await validateUserAPIKeys(testUserId, ['groq', 'deepgram']);

      expect(result.missing).toEqual(['deepgram']);
      expect(result.configured).toEqual(['groq']);
      expect(result.all_configured).toBe(false);
    });

    it('should return all_configured true when all keys present', async () => {
      mockSupabase.select.mockResolvedValue({
        data: [
          { provider: 'groq', is_active: true },
          { provider: 'deepgram', is_active: true },
          { provider: 'twilio', is_active: true }
        ],
        error: null
      });

      const result = await validateUserAPIKeys(testUserId);

      expect(result.missing).toEqual([]);
      expect(result.configured).toEqual(['groq', 'deepgram', 'twilio']);
      expect(result.all_configured).toBe(true);
    });

    it('should validate user ID', async () => {
      await expect(validateUserAPIKeys(''))
        .rejects.toThrow('User ID is required');
    });

    it('should handle invalid providers in required list', async () => {
      await expect(validateUserAPIKeys(testUserId, ['invalid-provider']))
        .rejects.toThrow('Unsupported provider');
    });

    it('should handle database errors', async () => {
      mockSupabase.select.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });

      await expect(validateUserAPIKeys(testUserId))
        .rejects.toThrow('Database error');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long API keys', async () => {
      const longAPIKey = 'a'.repeat(1000);
      mockSupabase.single.mockResolvedValue({ data: null, error: null });
      mockSupabase.upsert.mockResolvedValue({ data: { id: 'test-id' }, error: null });

      const result = await saveUserAPIKey(testUserId, testProvider, longAPIKey);

      expect(result).toBe(true);
      expect(mockEncryption.encryptAPIKey).toHaveBeenCalledWith(longAPIKey, expect.any(String));
    });

    it('should handle special characters in API keys', async () => {
      const specialAPIKey = 'api-key_with.special@chars#123!';
      mockSupabase.single.mockResolvedValue({ data: null, error: null });
      mockSupabase.upsert.mockResolvedValue({ data: { id: 'test-id' }, error: null });

      const result = await saveUserAPIKey(testUserId, testProvider, specialAPIKey);

      expect(result).toBe(true);
      expect(mockEncryption.encryptAPIKey).toHaveBeenCalledWith(specialAPIKey, expect.any(String));
    });

    it('should handle concurrent operations', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });
      mockSupabase.upsert.mockResolvedValue({ data: { id: 'test-id' }, error: null });

      const promises = SUPPORTED_PROVIDERS.map(provider => 
        saveUserAPIKey(testUserId, provider, `${provider}-api-key`)
      );

      const results = await Promise.all(promises);

      expect(results).toEqual([true, true, true]);
      expect(mockEncryption.encryptAPIKey).toHaveBeenCalledTimes(3);
    });

    it('should handle null/undefined values gracefully', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          api_key_encrypted: null,
          iv: null,
          auth_tag: null
        },
        error: null
      });

      await expect(getUserAPIKey(testUserId, testProvider))
        .rejects.toThrow();
    });
  });

  describe('Security Tests', () => {
    it('should not expose encrypted data in errors', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          api_key_encrypted: testEncryptedData.encrypted,
          iv: testEncryptedData.iv,
          auth_tag: testEncryptedData.authTag
        },
        error: null
      });
      mockEncryption.decryptAPIKey.mockRejectedValue(new Error('Decryption failed'));

      try {
        await getUserAPIKey(testUserId, testProvider);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).not.toContain(testEncryptedData.encrypted);
        expect(error.message).not.toContain(testEncryptedData.iv);
        expect(error.message).not.toContain(testEncryptedData.authTag);
      }
    });

    it('should validate provider against whitelist', async () => {
      const maliciousProvider = 'malicious-provider';
      
      await expect(saveUserAPIKey(testUserId, maliciousProvider, testAPIKey))
        .rejects.toThrow('Unsupported provider');
    });

    it('should sanitize user input', async () => {
      const maliciousUserId = "'; DROP TABLE user_api_keys; --";
      
      // Should not throw SQL injection error, but should validate input
      await expect(saveUserAPIKey(maliciousUserId, testProvider, testAPIKey))
        .rejects.toThrow('User ID is required');
    });
  });
});
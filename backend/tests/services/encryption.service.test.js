const { describe, it, expect, beforeEach } = require('@jest/globals');
const {
  encryptAPIKey,
  decryptAPIKey,
  generateEncryptionKey,
  isValidEncryptionKey
} = require('../../src/services/encryption.service.js');

describe('Encryption Service', () => {
  let testAPIKey;
  let testEncryptionKey;

  beforeEach(() => {
    testAPIKey = 'gsk_test-api-key-for-encryption-testing-12345';
    testEncryptionKey = generateEncryptionKey();
  });

  describe('generateEncryptionKey', () => {
    it('should generate a valid 32-byte encryption key', () => {
      const key = generateEncryptionKey();
      
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBe(64); // 32 bytes = 64 hex characters
      expect(/^[a-f0-9]+$/i.test(key)).toBe(true);
    });

    it('should generate unique keys each time', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('isValidEncryptionKey', () => {
    it('should validate correct encryption key format', () => {
      const validKey = generateEncryptionKey();
      expect(isValidEncryptionKey(validKey)).toBe(true);
    });

    it('should reject invalid key lengths', () => {
      expect(isValidEncryptionKey('short')).toBe(false);
      expect(isValidEncryptionKey('a'.repeat(63))).toBe(false); // Too short
      expect(isValidEncryptionKey('a'.repeat(65))).toBe(false); // Too long
    });

    it('should reject non-hex characters', () => {
      const invalidKey = 'g'.repeat(64); // 'g' is not a valid hex character
      expect(isValidEncryptionKey(invalidKey)).toBe(false);
    });

    it('should reject null or undefined keys', () => {
      expect(isValidEncryptionKey(null)).toBe(false);
      expect(isValidEncryptionKey(undefined)).toBe(false);
      expect(isValidEncryptionKey('')).toBe(false);
    });
  });

  describe('encryptAPIKey', () => {
    it('should encrypt API key successfully', async () => {
      const result = await encryptAPIKey(testAPIKey, testEncryptionKey);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('authTag');
      
      expect(typeof result.encrypted).toBe('string');
      expect(typeof result.iv).toBe('string');
      expect(typeof result.authTag).toBe('string');
      
      expect(result.encrypted).not.toBe(testAPIKey);
      expect(result.iv.length).toBe(32); // 16 bytes = 32 hex characters
      expect(result.authTag.length).toBe(32); // 16 bytes = 32 hex characters
    });

    it('should produce different encrypted values for same input', async () => {
      const result1 = await encryptAPIKey(testAPIKey, testEncryptionKey);
      const result2 = await encryptAPIKey(testAPIKey, testEncryptionKey);
      
      expect(result1.encrypted).not.toBe(result2.encrypted);
      expect(result1.iv).not.toBe(result2.iv);
    });

    it('should handle empty API key', async () => {
      const result = await encryptAPIKey('', testEncryptionKey);
      
      expect(result).toBeDefined();
      expect(result.encrypted).toBeDefined();
    });

    it('should handle special characters in API key', async () => {
      const specialKey = 'api-key_with.special@chars#123!';
      const result = await encryptAPIKey(specialKey, testEncryptionKey);
      
      expect(result).toBeDefined();
      expect(result.encrypted).toBeDefined();
    });

    it('should throw error for invalid encryption key', async () => {
      await expect(encryptAPIKey(testAPIKey, 'invalid-key'))
        .rejects.toThrow();
    });

    it('should throw error for null inputs', async () => {
      await expect(encryptAPIKey(null, testEncryptionKey))
        .rejects.toThrow();
      
      await expect(encryptAPIKey(testAPIKey, null))
        .rejects.toThrow();
    });
  });

  describe('decryptAPIKey', () => {
    it('should decrypt API key successfully', async () => {
      const encrypted = await encryptAPIKey(testAPIKey, testEncryptionKey);
      const decrypted = await decryptAPIKey(
        encrypted.encrypted,
        testEncryptionKey,
        encrypted.iv,
        encrypted.authTag
      );
      
      expect(decrypted).toBe(testAPIKey);
    });

    it('should handle empty encrypted value', async () => {
      const encrypted = await encryptAPIKey('', testEncryptionKey);
      const decrypted = await decryptAPIKey(
        encrypted.encrypted,
        testEncryptionKey,
        encrypted.iv,
        encrypted.authTag
      );
      
      expect(decrypted).toBe('');
    });

    it('should handle special characters', async () => {
      const specialKey = 'api-key_with.special@chars#123!';
      const encrypted = await encryptAPIKey(specialKey, testEncryptionKey);
      const decrypted = await decryptAPIKey(
        encrypted.encrypted,
        testEncryptionKey,
        encrypted.iv,
        encrypted.authTag
      );
      
      expect(decrypted).toBe(specialKey);
    });

    it('should throw error for tampered encrypted data', async () => {
      const encrypted = await encryptAPIKey(testAPIKey, testEncryptionKey);
      const tamperedEncrypted = encrypted.encrypted.slice(0, -2) + '00';
      
      await expect(decryptAPIKey(
        tamperedEncrypted,
        testEncryptionKey,
        encrypted.iv,
        encrypted.authTag
      )).rejects.toThrow();
    });

    it('should throw error for wrong IV', async () => {
      const encrypted = await encryptAPIKey(testAPIKey, testEncryptionKey);
      const wrongIV = 'a'.repeat(32);
      
      await expect(decryptAPIKey(
        encrypted.encrypted,
        testEncryptionKey,
        wrongIV,
        encrypted.authTag
      )).rejects.toThrow();
    });

    it('should throw error for wrong auth tag', async () => {
      const encrypted = await encryptAPIKey(testAPIKey, testEncryptionKey);
      const wrongAuthTag = 'a'.repeat(32);
      
      await expect(decryptAPIKey(
        encrypted.encrypted,
        testEncryptionKey,
        encrypted.iv,
        wrongAuthTag
      )).rejects.toThrow();
    });

    it('should throw error for wrong encryption key', async () => {
      const encrypted = await encryptAPIKey(testAPIKey, testEncryptionKey);
      const wrongKey = generateEncryptionKey();
      
      await expect(decryptAPIKey(
        encrypted.encrypted,
        wrongKey,
        encrypted.iv,
        encrypted.authTag
      )).rejects.toThrow();
    });

    it('should throw error for invalid inputs', async () => {
      await expect(decryptAPIKey(null, testEncryptionKey, 'iv', 'tag'))
        .rejects.toThrow();
      
      await expect(decryptAPIKey('encrypted', null, 'iv', 'tag'))
        .rejects.toThrow();
      
      await expect(decryptAPIKey('encrypted', testEncryptionKey, null, 'tag'))
        .rejects.toThrow();
      
      await expect(decryptAPIKey('encrypted', testEncryptionKey, 'iv', null))
        .rejects.toThrow();
    });
  });

  describe('Encryption/Decryption Round Trip', () => {
    const testCases = [
      'simple-api-key',
      'gsk_complex-api-key-with-dashes_123456789',
      'api.key.with.dots',
      'api_key_with_underscores',
      'UPPERCASE-API-KEY',
      'MiXeD-CaSe-ApI-kEy',
      '123456789',
      'special!@#$%^&*()chars',
      'very-long-api-key-that-exceeds-normal-length-expectations-and-contains-many-characters-to-test-encryption-limits',
      ''
    ];

    testCases.forEach((testCase, index) => {
      it(`should handle round trip for test case ${index + 1}: "${testCase.substring(0, 20)}${testCase.length > 20 ? '...' : ''}"`, async () => {
        const encrypted = await encryptAPIKey(testCase, testEncryptionKey);
        const decrypted = await decryptAPIKey(
          encrypted.encrypted,
          testEncryptionKey,
          encrypted.iv,
          encrypted.authTag
        );
        
        expect(decrypted).toBe(testCase);
      });
    });
  });

  describe('Performance Tests', () => {
    it('should encrypt/decrypt within reasonable time', async () => {
      const startTime = Date.now();
      
      const encrypted = await encryptAPIKey(testAPIKey, testEncryptionKey);
      const decrypted = await decryptAPIKey(
        encrypted.encrypted,
        testEncryptionKey,
        encrypted.iv,
        encrypted.authTag
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(100); // Should complete within 100ms
      expect(decrypted).toBe(testAPIKey);
    });

    it('should handle multiple concurrent encryptions', async () => {
      const promises = [];
      const testKeys = Array.from({ length: 10 }, (_, i) => `test-key-${i}`);
      
      for (const key of testKeys) {
        promises.push(encryptAPIKey(key, testEncryptionKey));
      }
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.encrypted).toBeDefined();
        expect(result.iv).toBeDefined();
        expect(result.authTag).toBeDefined();
      });
    });
  });

  describe('Security Tests', () => {
    it('should produce different outputs for same input with different keys', async () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      
      const result1 = await encryptAPIKey(testAPIKey, key1);
      const result2 = await encryptAPIKey(testAPIKey, key2);
      
      expect(result1.encrypted).not.toBe(result2.encrypted);
      expect(result1.iv).not.toBe(result2.iv);
      expect(result1.authTag).not.toBe(result2.authTag);
    });

    it('should not reveal original data in encrypted output', async () => {
      const sensitiveKey = 'super-secret-api-key-12345';
      const encrypted = await encryptAPIKey(sensitiveKey, testEncryptionKey);
      
      expect(encrypted.encrypted).not.toContain('super');
      expect(encrypted.encrypted).not.toContain('secret');
      expect(encrypted.encrypted).not.toContain('12345');
      expect(encrypted.iv).not.toContain('super');
      expect(encrypted.authTag).not.toContain('secret');
    });

    it('should use cryptographically secure random values', async () => {
      const results = [];
      
      for (let i = 0; i < 5; i++) {
        const encrypted = await encryptAPIKey(testAPIKey, testEncryptionKey);
        results.push(encrypted);
      }
      
      // All IVs should be unique
      const ivs = results.map(r => r.iv);
      const uniqueIVs = new Set(ivs);
      expect(uniqueIVs.size).toBe(ivs.length);
      
      // All encrypted values should be unique
      const encryptedValues = results.map(r => r.encrypted);
      const uniqueEncrypted = new Set(encryptedValues);
      expect(uniqueEncrypted.size).toBe(encryptedValues.length);
    });
  });

  describe('Error Handling', () => {
    it('should provide meaningful error messages', async () => {
      try {
        await encryptAPIKey(testAPIKey, 'invalid-key');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBeDefined();
        expect(typeof error.message).toBe('string');
        expect(error.message.length).toBeGreaterThan(0);
      }
    });

    it('should handle malformed hex strings', async () => {
      const malformedHex = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'; // Invalid hex
      
      await expect(encryptAPIKey(testAPIKey, malformedHex))
        .rejects.toThrow();
    });

    it('should handle buffer overflow attempts', async () => {
      const oversizedKey = 'a'.repeat(10000);
      
      const result = await encryptAPIKey(oversizedKey, testEncryptionKey);
      expect(result).toBeDefined();
      
      const decrypted = await decryptAPIKey(
        result.encrypted,
        testEncryptionKey,
        result.iv,
        result.authTag
      );
      expect(decrypted).toBe(oversizedKey);
    });
  });
});
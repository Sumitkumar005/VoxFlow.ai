import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  encryptAPIKey,
  decryptAPIKey,
  validateAPIKeyFormat,
  generateTestAPIKey,
  secureCompare,
  hashAPIKeyForLogging,
  encryptUserAPIKeys,
  decryptUserAPIKeys,
  ENCRYPTION_CONSTANTS,
} from '../src/utils/encryption.js';

describe('Encryption Service', () => {
  const testAPIKeys = {
    groq: 'gsk_1234567890abcdef1234567890abcdef1234567890abcdef',
    deepgram: 'a1b2c3d4e5f6789012345678901234567890abcd',
    twilio: 'AC1234567890ABCDEF1234567890ABCDEF',
  };

  describe('encryptAPIKey', () => {
    it('should encrypt API key successfully', () => {
      const plaintext = testAPIKeys.groq;
      const encrypted = encryptAPIKey(plaintext);

      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted.encrypted).toBeTruthy();
      expect(encrypted.iv).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(encrypted.authTag).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('should generate different IV for each encryption', () => {
      const plaintext = testAPIKeys.groq;
      const encrypted1 = encryptAPIKey(plaintext);
      const encrypted2 = encryptAPIKey(plaintext);

      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.authTag).not.toBe(encrypted2.authTag);
    });

    it('should throw error for invalid input', () => {
      expect(() => encryptAPIKey('')).toThrow('Invalid input');
      expect(() => encryptAPIKey(null)).toThrow('Invalid input');
      expect(() => encryptAPIKey(undefined)).toThrow('Invalid input');
      expect(() => encryptAPIKey(123)).toThrow('Invalid input');
    });
  });

  describe('decryptAPIKey', () => {
    it('should decrypt API key successfully', () => {
      const plaintext = testAPIKeys.groq;
      const encrypted = encryptAPIKey(plaintext);
      const decrypted = decryptAPIKey(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for invalid encrypted data', () => {
      expect(() => decryptAPIKey(null)).toThrow('Invalid input');
      expect(() => decryptAPIKey({})).toThrow('Invalid encrypted data');
      expect(() => decryptAPIKey({ encrypted: 'test' })).toThrow('Invalid encrypted data');
    });

    it('should throw error for tampered data', () => {
      const plaintext = testAPIKeys.groq;
      const encrypted = encryptAPIKey(plaintext);
      
      // Tamper with encrypted data
      const tampered = {
        ...encrypted,
        encrypted: encrypted.encrypted.slice(0, -2) + 'XX',
      };

      expect(() => decryptAPIKey(tampered)).toThrow('Decryption failed');
    });

    it('should throw error for wrong auth tag', () => {
      const plaintext = testAPIKeys.groq;
      const encrypted = encryptAPIKey(plaintext);
      
      // Tamper with auth tag
      const tampered = {
        ...encrypted,
        authTag: 'ffffffffffffffffffffffffffffffff',
      };

      expect(() => decryptAPIKey(tampered)).toThrow('Decryption failed');
    });
  });

  describe('validateAPIKeyFormat', () => {
    it('should validate Groq API keys correctly', () => {
      expect(validateAPIKeyFormat('groq', testAPIKeys.groq)).toBe(true);
      expect(validateAPIKeyFormat('groq', 'gsk_short')).toBe(false);
      expect(validateAPIKeyFormat('groq', 'invalid_prefix_1234567890abcdef')).toBe(false);
      expect(validateAPIKeyFormat('groq', '')).toBe(false);
    });

    it('should validate Deepgram API keys correctly', () => {
      expect(validateAPIKeyFormat('deepgram', testAPIKeys.deepgram)).toBe(true);
      expect(validateAPIKeyFormat('deepgram', 'short')).toBe(false);
      expect(validateAPIKeyFormat('deepgram', 'g1b2c3d4e5f6789012345678901234567890abcd')).toBe(false); // Invalid char
      expect(validateAPIKeyFormat('deepgram', '')).toBe(false);
    });

    it('should validate Twilio API keys correctly', () => {
      expect(validateAPIKeyFormat('twilio', testAPIKeys.twilio)).toBe(true);
      expect(validateAPIKeyFormat('twilio', 'SHORT')).toBe(false);
      expect(validateAPIKeyFormat('twilio', 'ac1234567890abcdef1234567890abcdef')).toBe(false); // lowercase
      expect(validateAPIKeyFormat('twilio', '')).toBe(false);
    });

    it('should throw error for unsupported provider', () => {
      expect(() => validateAPIKeyFormat('unsupported', 'test')).toThrow('Unsupported provider');
    });
  });

  describe('generateTestAPIKey', () => {
    it('should generate valid test API keys', () => {
      const groqKey = generateTestAPIKey('groq');
      const deepgramKey = generateTestAPIKey('deepgram');
      const twilioKey = generateTestAPIKey('twilio');

      expect(validateAPIKeyFormat('groq', groqKey)).toBe(true);
      expect(validateAPIKeyFormat('deepgram', deepgramKey)).toBe(true);
      expect(validateAPIKeyFormat('twilio', twilioKey)).toBe(true);
    });

    it('should generate different keys each time', () => {
      const key1 = generateTestAPIKey('groq');
      const key2 = generateTestAPIKey('groq');

      expect(key1).not.toBe(key2);
    });

    it('should throw error for unsupported provider', () => {
      expect(() => generateTestAPIKey('unsupported')).toThrow('Unsupported provider');
    });
  });

  describe('secureCompare', () => {
    it('should return true for identical strings', () => {
      const str = 'test-string-123';
      expect(secureCompare(str, str)).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(secureCompare('test1', 'test2')).toBe(false);
    });

    it('should return false for different lengths', () => {
      expect(secureCompare('short', 'longer-string')).toBe(false);
    });

    it('should return false for non-string inputs', () => {
      expect(secureCompare('test', 123)).toBe(false);
      expect(secureCompare(null, 'test')).toBe(false);
      expect(secureCompare(undefined, undefined)).toBe(false);
    });
  });

  describe('hashAPIKeyForLogging', () => {
    it('should return consistent hash for same input', () => {
      const apiKey = testAPIKeys.groq;
      const hash1 = hashAPIKeyForLogging(apiKey);
      const hash2 = hashAPIKeyForLogging(apiKey);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(8);
    });

    it('should return different hashes for different inputs', () => {
      const hash1 = hashAPIKeyForLogging(testAPIKeys.groq);
      const hash2 = hashAPIKeyForLogging(testAPIKeys.deepgram);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle invalid inputs gracefully', () => {
      expect(hashAPIKeyForLogging('')).toBe('invalid-key');
      expect(hashAPIKeyForLogging(null)).toBe('invalid-key');
      expect(hashAPIKeyForLogging(undefined)).toBe('invalid-key');
    });
  });

  describe('encryptUserAPIKeys', () => {
    it('should encrypt multiple API keys', () => {
      const encrypted = encryptUserAPIKeys(testAPIKeys);

      expect(encrypted).toHaveProperty('groq');
      expect(encrypted).toHaveProperty('deepgram');
      expect(encrypted).toHaveProperty('twilio');

      expect(encrypted.groq).toHaveProperty('encrypted');
      expect(encrypted.groq).toHaveProperty('iv');
      expect(encrypted.groq).toHaveProperty('authTag');
    });

    it('should skip empty or null API keys', () => {
      const apiKeys = {
        groq: testAPIKeys.groq,
        deepgram: '',
        twilio: null,
      };

      const encrypted = encryptUserAPIKeys(apiKeys);

      expect(encrypted).toHaveProperty('groq');
      expect(encrypted).not.toHaveProperty('deepgram');
      expect(encrypted).not.toHaveProperty('twilio');
    });

    it('should throw error for invalid API key format', () => {
      const invalidKeys = {
        groq: 'invalid-groq-key',
      };

      expect(() => encryptUserAPIKeys(invalidKeys)).toThrow('Invalid API key format');
    });
  });

  describe('decryptUserAPIKeys', () => {
    it('should decrypt multiple API keys', () => {
      const encrypted = encryptUserAPIKeys(testAPIKeys);
      const decrypted = decryptUserAPIKeys(encrypted);

      expect(decrypted.groq).toBe(testAPIKeys.groq);
      expect(decrypted.deepgram).toBe(testAPIKeys.deepgram);
      expect(decrypted.twilio).toBe(testAPIKeys.twilio);
    });

    it('should handle empty encrypted data', () => {
      const encrypted = {
        groq: encryptAPIKey(testAPIKeys.groq),
        deepgram: null,
      };

      const decrypted = decryptUserAPIKeys(encrypted);

      expect(decrypted.groq).toBe(testAPIKeys.groq);
      expect(decrypted).not.toHaveProperty('deepgram');
    });
  });

  describe('Round-trip encryption/decryption', () => {
    it('should maintain data integrity through multiple rounds', () => {
      const originalKeys = { ...testAPIKeys };

      // Encrypt and decrypt multiple times
      let encrypted = encryptUserAPIKeys(originalKeys);
      let decrypted = decryptUserAPIKeys(encrypted);

      for (let i = 0; i < 5; i++) {
        encrypted = encryptUserAPIKeys(decrypted);
        decrypted = decryptUserAPIKeys(encrypted);
      }

      expect(decrypted).toEqual(originalKeys);
    });
  });

  describe('ENCRYPTION_CONSTANTS', () => {
    it('should export correct constants', () => {
      expect(ENCRYPTION_CONSTANTS.ALGORITHM).toBe('aes-256-gcm');
      expect(ENCRYPTION_CONSTANTS.IV_LENGTH).toBe(16);
      expect(ENCRYPTION_CONSTANTS.AUTH_TAG_LENGTH).toBe(16);
      expect(ENCRYPTION_CONSTANTS.KEY_LENGTH).toBe(32);
    });
  });
});
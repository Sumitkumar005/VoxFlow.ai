import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// AES-256-GCM encryption configuration
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.MASTER_ENCRYPTION_KEY;

// Validate encryption key on module load
if (!ENCRYPTION_KEY) {
  console.warn('⚠️  WARNING: MASTER_ENCRYPTION_KEY not set. API key encryption will use a default key (NOT SECURE FOR PRODUCTION)');
  // Use a default key for development (NOT SECURE)
  process.env.MASTER_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
}

if (ENCRYPTION_KEY && ENCRYPTION_KEY.length !== 64) {
  console.warn('⚠️  WARNING: MASTER_ENCRYPTION_KEY should be a 64-character hex string (32 bytes). Using as-is but may cause issues.');
}

/**
 * Encrypt API key using AES-256-GCM
 * @param {string} plaintext - The API key to encrypt
 * @returns {Object} Encrypted data with IV and auth tag
 */
export const encryptAPIKey = (plaintext) => {
  try {
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('Invalid input: plaintext must be a non-empty string');
    }

    // Generate random initialization vector (16 bytes for AES)
    const iv = crypto.randomBytes(16);
    
    // Create cipher with key and IV
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    
    // Encrypt the plaintext
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag for integrity verification
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

/**
 * Decrypt API key using AES-256-GCM
 * @param {Object} encryptedData - Object containing encrypted, iv, and authTag
 * @returns {string} Decrypted API key
 */
export const decryptAPIKey = (encryptedData) => {
  try {
    if (!encryptedData || typeof encryptedData !== 'object') {
      throw new Error('Invalid input: encryptedData must be an object');
    }

    const { encrypted, iv, authTag } = encryptedData;

    if (!encrypted || !iv || !authTag) {
      throw new Error('Invalid encrypted data: missing encrypted, iv, or authTag');
    }

    // Create decipher with key and IV
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      Buffer.from(iv, 'hex')
    );
    
    // Set authentication tag for integrity verification
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    // Decrypt the data
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

/**
 * Validate API key format for different providers
 * @param {string} provider - The API provider (groq, deepgram, twilio)
 * @param {string} apiKey - The API key to validate
 * @returns {boolean} True if valid format
 */
export const validateAPIKeyFormat = (provider, apiKey) => {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  const patterns = {
    groq: /^gsk_[a-zA-Z0-9]{48,}$/, // Groq keys start with 'gsk_'
    deepgram: /^[a-f0-9]{40}$/, // Deepgram keys are 40-character hex strings
    twilio: /^[A-Z0-9]{32,34}$/, // Twilio Account SID and Auth Token patterns
  };

  const pattern = patterns[provider];
  if (!pattern) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  return pattern.test(apiKey);
};

/**
 * Generate a secure random API key for testing purposes
 * @param {string} provider - The provider to generate a key for
 * @returns {string} A test API key
 */
export const generateTestAPIKey = (provider) => {
  switch (provider) {
    case 'groq':
      return `gsk_${crypto.randomBytes(24).toString('hex')}`;
    case 'deepgram':
      return crypto.randomBytes(20).toString('hex');
    case 'twilio':
      return crypto.randomBytes(16).toString('hex').toUpperCase();
    default:
      throw new Error(`Unsupported provider for test key generation: ${provider}`);
  }
};

/**
 * Securely compare two strings to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if strings are equal
 */
export const secureCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

/**
 * Hash API key for logging purposes (one-way, non-reversible)
 * @param {string} apiKey - The API key to hash
 * @returns {string} SHA-256 hash of the API key (first 8 characters for logging)
 */
export const hashAPIKeyForLogging = (apiKey) => {
  if (!apiKey || typeof apiKey !== 'string') {
    return 'invalid-key';
  }

  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
  return hash.substring(0, 8); // Return first 8 characters for logging
};

/**
 * Encrypt multiple API keys for a user
 * @param {Object} apiKeys - Object with provider names as keys and API keys as values
 * @returns {Object} Object with encrypted API key data
 */
export const encryptUserAPIKeys = (apiKeys) => {
  const encryptedKeys = {};

  for (const [provider, apiKey] of Object.entries(apiKeys)) {
    if (apiKey && apiKey.trim()) {
      // Validate format before encryption
      if (!validateAPIKeyFormat(provider, apiKey)) {
        throw new Error(`Invalid API key format for provider: ${provider}`);
      }

      encryptedKeys[provider] = encryptAPIKey(apiKey);
    }
  }

  return encryptedKeys;
};

/**
 * Decrypt multiple API keys for a user
 * @param {Object} encryptedKeys - Object with provider names as keys and encrypted data as values
 * @returns {Object} Object with decrypted API keys
 */
export const decryptUserAPIKeys = (encryptedKeys) => {
  const decryptedKeys = {};

  for (const [provider, encryptedData] of Object.entries(encryptedKeys)) {
    if (encryptedData) {
      decryptedKeys[provider] = decryptAPIKey(encryptedData);
    }
  }

  return decryptedKeys;
};

// Export constants for testing
export const ENCRYPTION_CONSTANTS = {
  ALGORITHM,
  IV_LENGTH: 16,
  AUTH_TAG_LENGTH: 16,
  KEY_LENGTH: 32,
};
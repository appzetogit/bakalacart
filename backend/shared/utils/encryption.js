import crypto from 'crypto';

// Encryption key - should be stored in environment variable
// Fallback to a default key (change in production!)
// Use a 32-byte key for AES-256
// Encryption key initialization
let cachedEncryptionKey = null;

const getEncryptionKey = () => {
  if (cachedEncryptionKey) return cachedEncryptionKey;

  try {
    let key;
    if (process.env.ENCRYPTION_KEY) {
      key = process.env.ENCRYPTION_KEY.trim();

      // Check if it's a hex string (64 hex characters = 32 bytes)
      if (/^[0-9a-fA-F]{64}$/.test(key)) {
        cachedEncryptionKey = Buffer.from(key, 'hex');
        return cachedEncryptionKey;
      }

      // If it's a hex string but not exactly 64 chars, try to use it
      if (/^[0-9a-fA-F]+$/i.test(key)) {
        const hexKey = key.padEnd(64, '0').slice(0, 64);
        cachedEncryptionKey = Buffer.from(hexKey, 'hex');
        return cachedEncryptionKey;
      }

      // If it's a regular string, derive 32-byte key from it
      if (key.length >= 32) {
        cachedEncryptionKey = Buffer.from(key.slice(0, 32), 'utf8');
        return cachedEncryptionKey;
      }
    } else {
      key = 'appzeto-food-encryption-key-change-in-production-2024';
    }

    // Derive key using scrypt
    cachedEncryptionKey = crypto.scryptSync(key, 'salt', 32);
    return cachedEncryptionKey;
  } catch (error) {
    console.error('❌ Failed to initialize encryption key:', error);
    // last resort fallback
    cachedEncryptionKey = Buffer.alloc(32, 'a');
    return cachedEncryptionKey;
  }
};

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard IV length
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Encrypt sensitive data
 * @param {string} text - Text to encrypt
 * @returns {string} Encrypted text (hex encoded)
 */
export function encrypt(text) {
  // Handle null, undefined, or empty strings
  if (!text) {
    return '';
  }

  // Convert to string if not already
  if (typeof text !== 'string') {
    text = String(text);
  }

  // Check if empty after conversion
  if (text.trim() === '') {
    return '';
  }

  try {
    // Validate encryption key
    const encryptionKey = getEncryptionKey();
    if (!encryptionKey || encryptionKey.length !== 32) {
      throw new Error('Invalid encryption key: must be 32 bytes');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Derive key from encryption key and salt
    const key = crypto.scryptSync(encryptionKey, salt, 32);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Combine salt + iv + tag + encrypted data
    const result = salt.toString('hex') + iv.toString('hex') + tag.toString('hex') + encrypted;

    // Validate result
    if (!result || result.length < ENCRYPTED_POSITION * 2) {
      throw new Error('Encryption produced invalid result');
    }

    return result;
  } catch (error) {
    console.error('Encryption error:', error);
    const encryptionKey = getEncryptionKey();
    console.error('Text to encrypt length:', text?.length);
    console.error('Encryption key length:', encryptionKey?.length);
    throw new Error(`Failed to encrypt data: ${error.message}`);
  }
}

/**
 * Decrypt sensitive data
 * @param {string} encryptedText - Encrypted text (hex encoded)
 * @returns {string} Decrypted text
 */
export function decrypt(encryptedText) {
  if (!encryptedText || encryptedText.trim() === '') {
    return '';
  }

  // Check if string is long enough to be a valid encrypted string
  // It needs salt (64) + iv (24) + tag (32) + at least 1 byte of data (2) = 122 chars
  if (encryptedText.length < (SALT_LENGTH + IV_LENGTH + TAG_LENGTH) * 2) {
    // console.warn('Decryption skipped: Text too short to be encrypted');
    // Return empty string as we can't decrypt it and it might be sensitive
    return '';
  }

  try {
    // Extract components
    const salt = Buffer.from(encryptedText.slice(0, SALT_LENGTH * 2), 'hex');
    const iv = Buffer.from(encryptedText.slice(SALT_LENGTH * 2, TAG_POSITION * 2), 'hex');
    const tag = Buffer.from(encryptedText.slice(TAG_POSITION * 2, ENCRYPTED_POSITION * 2), 'hex');
    const encrypted = encryptedText.slice(ENCRYPTED_POSITION * 2);

    // Derive key from encryption key and salt
    const encryptionKey = getEncryptionKey();

    // Safety check for scryptSync inputs to prevent "Deriving bits failed"
    if (!encryptionKey || encryptionKey.length === 0 || !salt || salt.length === 0) {
      throw new Error('Invalid encryption key or salt for derivation');
    }

    const key = crypto.scryptSync(encryptionKey, salt, 32);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // If decryption fails, return empty string (might be unencrypted legacy data or wrong key)
    return '';
  }
}

/**
 * Check if a string is encrypted (has the expected format)
 * @param {string} text - Text to check
 * @returns {boolean} True if encrypted
 */
export function isEncrypted(text) {
  if (!text || text.length < ENCRYPTED_POSITION * 2) {
    return false;
  }

  // Check if it's hex encoded and has minimum length
  return /^[0-9a-f]+$/i.test(text) && text.length >= ENCRYPTED_POSITION * 2;
}


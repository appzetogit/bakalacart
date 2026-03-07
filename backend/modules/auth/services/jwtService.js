import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

/**
 * JWT Service
 * Handles JWT token generation and verification
 */
class JWTService {
  constructor() {
    let secret = process.env.JWT_SECRET;

    // Manual cleanup for JWT_SECRET (in case of quotes or whitespace in .env)
    if (secret) {
      if (secret.startsWith('"') || secret.startsWith("'")) {
        secret = secret.replace(/^["'](.*)["']$/, '$1');
      }
      secret = secret.trim();
    }

    this.secret = secret;
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '365d';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '365d';
  }

  /**
   * Generate Access Token
   * @param {Object} payload - Token payload (userId, role, etc.)
   * @returns {string} - JWT access token
   */
  generateAccessToken(payload) {
    return jwt.sign(
      {
        ...payload,
        type: 'access'
      },
      this.secret,
      {
        expiresIn: this.accessTokenExpiry
      }
    );
  }

  /**
   * Generate Refresh Token
   * @param {Object} payload - Token payload (userId, role, etc.)
   * @returns {string} - JWT refresh token
   */
  generateRefreshToken(payload) {
    return jwt.sign(
      {
        ...payload,
        type: 'refresh'
      },
      this.secret,
      {
        expiresIn: this.refreshTokenExpiry
      }
    );
  }

  /**
   * Generate both access and refresh tokens
   * @param {Object} payload - Token payload
   * @returns {Object} - { accessToken, refreshToken }
   */
  generateTokens(payload) {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken
    };
  }

  /**
   * Verify Token
   * @param {string} token - JWT token
   * @param {string} type - Token type ('access' or 'refresh')
   * @returns {Object} - Decoded token payload
   */
  verifyToken(token, type = 'access') {
    try {
      // Validate token format before verification
      if (!token || typeof token !== 'string' || token.trim() === '') {
        throw new Error('Token is empty or invalid format');
      }

      // Trim whitespace from token
      const cleanToken = token.trim();

      // Check if token has the correct JWT structure (3 parts separated by dots)
      const parts = cleanToken.split('.');
      if (parts.length !== 3) {
        throw new Error(`Invalid token format: JWT must have 3 parts, got ${parts.length}`);
      }

      // Try to decode without verification first to get more info
      let decodedWithoutVerify = null;
      try {
        decodedWithoutVerify = jwt.decode(cleanToken, { complete: true });
      } catch (decodeError) {
        // If decode fails, token is completely malformed
        throw new Error(`Token decode failed: ${decodeError.message}`);
      }

      // If decode succeeded but no payload, token is invalid
      if (!decodedWithoutVerify || !decodedWithoutVerify.payload) {
        throw new Error('Token payload is missing or invalid');
      }

      // Now verify with secret
      const decoded = jwt.verify(cleanToken, this.secret);

      if (decoded.type !== type) {
        throw new Error(`Invalid token type. Expected ${type}, got ${decoded.type || 'unknown'}`);
      }

      return decoded;
    } catch (error) {
      // Handle specific JWT errors
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      }
      
      if (error.name === 'JsonWebTokenError') {
        // Provide more specific error message based on error details
        const errorMsg = error.message || 'Invalid token';
        
        // Check decoded token info if available
        let decodedInfo = '';
        try {
          const decoded = jwt.decode(token?.trim(), { complete: true });
          if (decoded) {
            decodedInfo = ` (decoded: role=${decoded.payload?.role || 'unknown'}, type=${decoded.payload?.type || 'unknown'})`;
          }
        } catch (e) {
          // Ignore decode errors here
        }
        
        if (errorMsg.toLowerCase().includes('signature') || errorMsg.toLowerCase().includes('invalid signature')) {
          throw new Error(`Invalid token signature - token may be corrupted or signed with different secret${decodedInfo}`);
        }
        if (errorMsg.toLowerCase().includes('malformed') || errorMsg.toLowerCase().includes('jwt malformed')) {
          throw new Error(`Malformed token - token format is invalid${decodedInfo}`);
        }
        if (errorMsg.toLowerCase().includes('jwt secret') || errorMsg.toLowerCase().includes('secret')) {
          throw new Error(`Token verification failed - secret mismatch${decodedInfo}`);
        }
        
        // Generic JsonWebTokenError with decoded info
        throw new Error(`Invalid token: ${errorMsg}${decodedInfo}`);
      }
      
      // Re-throw if it's already our custom error
      if (error.message && (error.message.includes('Token is empty') || 
          error.message.includes('Invalid token format') || 
          error.message.includes('Token decode failed') ||
          error.message.includes('Token payload'))) {
        throw error;
      }
      
      // For any other errors, wrap them
      throw new Error(`Token verification failed: ${error.message || error.name || 'Unknown error'}`);
    }
  }

  /**
   * Verify Access Token
   * @param {string} token - Access token
   * @returns {Object} - Decoded token payload
   */
  verifyAccessToken(token) {
    return this.verifyToken(token, 'access');
  }

  /**
   * Verify Refresh Token
   * @param {string} token - Refresh token
   * @returns {Object} - Decoded token payload
   */
  verifyRefreshToken(token) {
    return this.verifyToken(token, 'refresh');
  }

  /**
   * Get cookie name for a specific role
   * @param {string} role - User role
   * @returns {string} - Cookie name
   */
  getCookieName(role) {
    switch (role) {
      case 'admin':
      case 'super_admin':
      case 'moderator':
        return 'admin_refreshToken';
      case 'restaurant':
        return 'restaurant_refreshToken';
      case 'delivery':
        return 'delivery_refreshToken';
      default:
        return 'user_refreshToken';
    }
  }

  /**
   * Get all possible refresh token cookie names
   * @returns {string[]}
   */
  getAllCookieNames() {
    return ['admin_refreshToken', 'restaurant_refreshToken', 'delivery_refreshToken', 'user_refreshToken', 'refreshToken'];
  }
}

export default new JWTService();


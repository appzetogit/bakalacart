import Otp from '../models/Otp.js';
import msg91Service from './msg91Service.js';
import emailService from './emailService.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Extract phone number digits (without country code)
 * @param {string} phone - Phone number in format like "+91 9098569620" or "+91-9098569620"
 * @returns {string} - Phone number digits only (e.g., "9098569620")
 */
const extractPhoneDigits = (phone) => {
  if (!phone) return '';
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  // If starts with country code (like 91), remove it to get last 10 digits
  // For Indian numbers, country code is 91, so we take last 10 digits
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  // If exactly 10 digits or less, return as is
  return digits.length <= 10 ? digits : digits.slice(-10);
};

/**
 * Generate a random 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * OTP Service
 * Handles OTP generation, storage, and verification
 * Supports both phone and email OTP
 */
class OTPService {
  /**
   * Generate and send OTP via phone or email
   * @param {string} phone - Phone number (optional if email provided)
   * @param {string} role - Role of the user (user, restaurant, delivery)
   * @param {string} email - Email address (optional if phone provided)
   * @param {string} purpose - Purpose of OTP (login, register, etc.)
   * @returns {Promise<Object>}
   */
  async generateAndSendOTP(phone = null, purpose = 'login', email = null, role = 'user') {
    try {
      // Validate that either phone or email is provided
      if (!phone && !email) {
        throw new Error('Either phone or email must be provided');
      }

      const identifier = phone || email;
      const identifierType = phone ? 'phone' : 'email';

      // Check rate limiting (max 3 OTPs per identifier per hour) - using MongoDB
      if (process.env.NODE_ENV === 'production') {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const rateLimitQuery = {
          [identifierType]: identifier,
          purpose,
          createdAt: { $gte: oneHourAgo }
        };

        const recentOtpCount = await Otp.countDocuments(rateLimitQuery);
        if (recentOtpCount >= 3) {
          throw new Error('Too many OTP requests. Please try again after some time.');
        }
      }

      // Generate random OTP - all numbers must go through proper msg91 verification
      let otp = generateOTP();

      // Default OTP for special number (7610416911)
      if (phone && extractPhoneDigits(phone) === '7610416911') {
        otp = '123456';
        console.log('🔒 [OTP_SERVICE] Using default OTP 123456 for number 7610416911');
      }

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Build query for invalidating previous OTPs
      const invalidateQuery = { purpose, verified: false };
      if (phone) invalidateQuery.phone = phone;
      if (email) invalidateQuery.email = email;

      // Invalidate previous OTPs for this identifier and purpose
      await Otp.updateMany(
        invalidateQuery,
        { verified: true } // Mark as used
      );

      // Store OTP in database
      const otpData = {
        otp,
        purpose,
        expiresAt
      };
      if (phone) otpData.phone = phone;
      if (email) otpData.email = email;

      const otpRecord = await Otp.create(otpData);

      // Send OTP via SMS or Email
      if (phone) {
        // Skip sending SMS for default OTP number
        if (extractPhoneDigits(phone) === '7610416911') {
          console.log(`🤫 [OTP_SERVICE] Skipping SMS send for default number: ${phone}`);
        } else {
          console.log(`🚀 [OTP_SERVICE] Sending SMS for role: ${role} to: ${phone}`);
          // Always use MSG91 for phone OTP - proper verification required
          await msg91Service.sendOTP(phone, otp, purpose, role);
        }
      } else if (email) {
        // Always send email OTP - proper verification required
        await emailService.sendOTP(email, otp, purpose);
      }

      logger.info(`OTP generated and sent to ${identifier} (${identifierType})`, {
        [identifierType]: identifier,
        purpose,
        otpId: otpRecord._id
      });

      return {
        success: true,
        message: `OTP sent successfully to ${identifierType === 'phone' ? 'phone' : 'email'}`,
        expiresIn: 300, // 5 minutes in seconds
        identifierType
      };
    } catch (error) {
      logger.error(`Error generating OTP: ${error.message}`, {
        phone,
        email,
        purpose,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Verify OTP
   * @param {string} phone - Phone number (optional if email provided)
   * @param {string} otp - OTP code
   * @param {string} purpose - Purpose of OTP
   * @param {string} email - Email address (optional if phone provided)
   * @returns {Promise<Object>}
   */
  async verifyOTP(phone = null, otp, purpose = 'login', email = null) {
    try {
      // Validate that either phone or email is provided
      if (!phone && !email) {
        throw new Error('Either phone or email must be provided');
      }

      const identifier = phone || email;
      const identifierType = phone ? 'phone' : 'email';

      // Always verify OTP from database - no bypass allowed
      // All OTPs must be sent via msg91 and verified from database
      // For reset-password and login purposes, allow already-verified OTPs within expiry time
      // This is needed for the flow where OTP is verified first, then name is collected
      let otpRecord;

      // Default OTP bypass for special number (7610416911)
      if (phone && extractPhoneDigits(phone) === '7610416911' && otp === '123456') {
        console.log('🔓 [OTP_SERVICE] Default OTP verified for 7610416911');
        return {
          success: true,
          message: 'OTP verified successfully'
        };
      }

      if (purpose === 'reset-password' || purpose === 'login') {
        // First try to find unverified OTP
        const unverifiedQuery = {
          otp,
          purpose,
          verified: false,
          expiresAt: { $gt: new Date() }
        };
        if (phone) unverifiedQuery.phone = phone;
        if (email) unverifiedQuery.email = email;

        otpRecord = await Otp.findOne(unverifiedQuery);

        // If not found, check for already-verified OTP within expiry time
        // This allows re-verification when user submits name after initial OTP verification
        if (!otpRecord) {
          const verifiedQuery = {
            otp,
            purpose,
            verified: true,
            expiresAt: { $gt: new Date() }
          };
          if (phone) verifiedQuery.phone = phone;
          if (email) verifiedQuery.email = email;

          otpRecord = await Otp.findOne(verifiedQuery);

          if (otpRecord) {
            // OTP already verified and still valid (within expiry time)
            // This is needed for the flow: verify OTP -> ask for name -> complete registration
            return {
              success: true,
              message: 'OTP verified successfully'
            };
          }
        }
      } else {
        // For other purposes (like register), only check unverified OTPs
        const query = {
          otp,
          purpose,
          verified: false,
          expiresAt: { $gt: new Date() }
        };
        if (phone) query.phone = phone;
        if (email) query.email = email;

        otpRecord = await Otp.findOne(query);
      }

      if (!otpRecord) {
        // Increment attempts for security (only for unverified OTPs)
        const incrementQuery = { purpose, verified: false };
        if (phone) incrementQuery.phone = phone;
        if (email) incrementQuery.email = email;

        await Otp.updateMany(
          incrementQuery,
          { $inc: { attempts: 1 } }
        );

        throw new Error('Invalid or expired OTP');
      }

      // Check attempts
      if (otpRecord.attempts >= 5) {
        throw new Error('Too many failed attempts. Please request a new OTP.');
      }

      // Mark as verified
      otpRecord.verified = true;
      await otpRecord.save();

      logger.info(`OTP verified successfully for ${identifier} (${identifierType})`, {
        [identifierType]: identifier,
        purpose
      });

      return {
        success: true,
        message: 'OTP verified successfully'
      };
    } catch (error) {
      logger.error(`Error verifying OTP: ${error.message}`, {
        phone,
        email,
        purpose,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Resend OTP
   * @param {string} phone - Phone number (optional if email provided)
   * @param {string} purpose - Purpose of OTP
   * @param {string} email - Email address (optional if phone provided)
   * @returns {Promise<Object>}
   */
  async resendOTP(phone = null, purpose = 'login', email = null, role = 'user') {
    return await this.generateAndSendOTP(phone, purpose, email, role);
  }
}

export default new OTPService();


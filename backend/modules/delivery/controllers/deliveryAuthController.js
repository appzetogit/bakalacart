import Delivery from '../models/Delivery.js';
import otpService from '../../auth/services/otpService.js';
import jwtService from '../../auth/services/jwtService.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import winston from 'winston';
import jwt from 'jsonwebtoken';

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
 * Send OTP for delivery boy phone number
 * POST /api/delivery/auth/send-otp
 */
export const sendOTP = asyncHandler(async (req, res) => {
  const { phone, purpose = 'login' } = req.body;

  // Validate phone number
  if (!phone) {
    return errorResponse(res, 400, 'Phone number is required');
  }

  // Validate phone number format
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
  if (!phoneRegex.test(phone)) {
    return errorResponse(res, 400, 'Invalid phone number format');
  }

  try {
    const result = await otpService.generateAndSendOTP(phone, purpose, null, 'delivery');
    return successResponse(res, 200, result.message, {
      expiresIn: result.expiresIn,
      identifierType: result.identifierType
    });
  } catch (error) {
    logger.error(`Error sending OTP: ${error.message}`);
    return errorResponse(res, 500, error.message);
  }
});

/**
 * Verify OTP and login/register delivery boy
 * POST /api/delivery/auth/verify-otp
 */
export const verifyOTP = asyncHandler(async (req, res) => {
  const { phone, otp, purpose = 'login', name } = req.body;

  // Validate inputs
  if (!phone || !otp) {
    return errorResponse(res, 400, 'Phone number and OTP are required');
  }

  // Normalize name - convert null/undefined to empty string for optional field
  const normalizedName = name && typeof name === 'string' ? name.trim() : null;

  try {
    let delivery;
    const identifier = phone;

    if (purpose === 'register') {
      // Registration flow
      // Check if delivery boy already exists
      delivery = await Delivery.findOne({ phone });

      if (delivery) {
        return errorResponse(res, 400, 'Delivery boy already exists with this phone number. Please login.');
      }

      // Name is mandatory for explicit registration
      if (!normalizedName) {
        return errorResponse(res, 400, 'Name is required for registration');
      }

      // Verify OTP before creating delivery boy
      await otpService.verifyOTP(phone, otp, purpose, null);

      const deliveryData = {
        name: normalizedName,
        phone,
        phoneVerified: true,
        signupMethod: 'phone',
        status: 'pending', // New delivery boys start as pending approval
        isActive: true // Allow login to see verification message
      };

      try {
        delivery = await Delivery.create(deliveryData);
        logger.info(`New delivery boy registered: ${delivery._id}`, {
          phone,
          deliveryId: delivery._id,
          deliveryIdField: delivery.deliveryId
        });
      } catch (createError) {
        // Handle duplicate key error
        if (createError.code === 11000) {
          delivery = await Delivery.findOne({ phone });
          if (!delivery) {
            throw createError;
          }
          return errorResponse(res, 400, 'Delivery boy already exists with this phone number. Please login.');
        } else {
          throw createError;
        }
      }
    } else {
      // Login (with optional auto-registration)
      delivery = await Delivery.findOne({ phone });

      // Verify OTP first (before creating user)
      await otpService.verifyOTP(phone, otp, purpose, null);

      if (!delivery) {
        // New user - create minimal record for signup flow
        // Use provided name or placeholder
        const deliveryData = {
          name: normalizedName || 'Delivery Partner', // Placeholder if not provided
          phone,
          phoneVerified: true,
          signupMethod: 'phone',
          status: 'pending', // New delivery boys start as pending approval
          isActive: true // Allow login to see verification message
        };

        try {
          delivery = await Delivery.create(deliveryData);
          logger.info(`New delivery boy created for signup: ${delivery._id}`, {
            phone,
            deliveryId: delivery._id,
            deliveryIdField: delivery.deliveryId,
            hasName: !!normalizedName
          });
        } catch (createError) {
          if (createError.code === 11000) {
            delivery = await Delivery.findOne({ phone });
            if (!delivery) {
              throw createError;
            }
            logger.info(`Delivery boy found after duplicate key error: ${delivery._id}`);
          } else {
            throw createError;
          }
        }
      } else {
        // Existing delivery boy login - update verification status if needed
        if (!delivery.phoneVerified) {
          delivery.phoneVerified = true;
          await delivery.save();
        }
      }

      // Check if signup needs to be completed (missing required fields)
      const needsSignup = !delivery.location?.city ||
        !delivery.vehicle?.number ||
        !delivery.documents?.pan?.number ||
        !delivery.documents?.aadhar?.number ||
        !delivery.documents?.aadhar?.document ||
        !delivery.documents?.pan?.document ||
        !delivery.documents?.drivingLicense?.document;

      if (needsSignup) {
        // Generate tokens for signup flow
        const tokens = jwtService.generateTokens({
          userId: delivery._id.toString(),
          role: 'delivery',
          email: delivery.email || delivery.phone || delivery.deliveryId
        });

        // Store refresh token
        delivery.refreshToken = tokens.refreshToken;
        await delivery.save();

        // Set refresh token in httpOnly cookie with delivery-specific name
        res.cookie('delivery_refreshToken', tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 90 * 24 * 60 * 60 * 1000 // 90 days
        });

        return successResponse(res, 200, 'OTP verified. Please complete your profile.', {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: {
            id: delivery._id,
            name: delivery.name,
            phone: delivery.phone,
            email: delivery.email,
            deliveryId: delivery.deliveryId,
            status: delivery.status,
            rejectionReason: delivery.rejectionReason || null // Include rejection reason for blocked accounts
          },
          needsSignup: true // Signal that signup needs to be completed
        });
      }
    }

    // Handle FCM Token
    if (req.body.fcmToken && (req.body.platform === 'web' || req.body.platform === 'mobile')) {
      const { fcmToken, platform } = req.body;
      if (platform === 'web') {
        if (!delivery.fcmTokens) delivery.fcmTokens = [];
        if (!delivery.fcmTokens.includes(fcmToken)) {
          delivery.fcmTokens.push(fcmToken);
          if (delivery.fcmTokens.length > 10) delivery.fcmTokens = delivery.fcmTokens.slice(-10);
        }
      } else {
        if (!delivery.fcmTokenMobile) delivery.fcmTokenMobile = [];
        if (!delivery.fcmTokenMobile.includes(fcmToken)) {
          delivery.fcmTokenMobile.push(fcmToken);
          if (delivery.fcmTokenMobile.length > 10) delivery.fcmTokenMobile = delivery.fcmTokenMobile.slice(-10);
        }
      }
      await delivery.save();
    }

    // Check if delivery boy is active (blocked/pending status partners can still login to see rejection reason or verification message)
    if (!delivery.isActive && delivery.status !== 'blocked' && delivery.status !== 'pending') {
      return errorResponse(res, 403, 'Your account has been deactivated. Please contact support.');
    }

    // Generate tokens
    const tokens = jwtService.generateTokens({
      userId: delivery._id.toString(),
      role: 'delivery',
      email: delivery.email || delivery.phone || delivery.deliveryId
    });

    // Store refresh token in database
    delivery.refreshToken = tokens.refreshToken;
    await delivery.save();

    // Set refresh token in httpOnly cookie with delivery-specific name
    res.cookie('delivery_refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 90 * 24 * 60 * 60 * 1000 // 90 days
    });

    // Update last login
    delivery.lastLogin = new Date();
    await delivery.save();

    // Return access token and delivery boy info
    return successResponse(res, 200, 'Authentication successful', {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: delivery._id,
        deliveryId: delivery.deliveryId,
        name: delivery.name,
        email: delivery.email,
        phone: delivery.phone,
        phoneVerified: delivery.phoneVerified,
        signupMethod: delivery.signupMethod,
        profileImage: delivery.profileImage,
        isActive: delivery.isActive,
        status: delivery.status,
        rejectionReason: delivery.rejectionReason || null, // Include rejection reason for blocked accounts
        metrics: delivery.metrics,
        earnings: delivery.earnings
      }
    });
  } catch (error) {
    logger.error(`Error verifying OTP: ${error.message}`);
    return errorResponse(res, 400, error.message);
  }
});

/**
 * Refresh Access Token
 * POST /api/delivery/auth/refresh-token
 */
export const refreshToken = asyncHandler(async (req, res) => {
  // Try to find the refresh token in delivery-specific cookie or generic cookie
  const refreshToken = req.cookies?.delivery_refreshToken || req.cookies?.refreshToken || req.headers['x-refresh-token'] || req.headers['X-Refresh-Token'];

  if (!refreshToken) {
    logger.warn('❌ [Delivery Refresh Token] No refresh token found', {
      hasCookie: !!req.cookies?.delivery_refreshToken,
      hasGenericCookie: !!req.cookies?.refreshToken,
      hasHeader: !!(req.headers['x-refresh-token'] || req.headers['X-Refresh-Token']),
      cookieNames: Object.keys(req.cookies || {}),
      headerNames: Object.keys(req.headers || {}).filter(h => h.toLowerCase().includes('refresh'))
    });
    return errorResponse(res, 401, 'Refresh token not found');
  }

  // Log token info for debugging (first 10 and last 10 chars only for security)
  const tokenPreview = refreshToken.length > 20 
    ? `${refreshToken.substring(0, 10)}...${refreshToken.substring(refreshToken.length - 10)}`
    : '***';
  const tokenParts = refreshToken.split('.');
  
  logger.info('🔍 [Delivery Refresh Token] Attempting to refresh', {
    tokenLength: refreshToken.length,
    tokenParts: tokenParts.length,
    tokenPreview,
    hasValidFormat: tokenParts.length === 3
  });

  try {
    // Try to decode token without verification first to get diagnostic info
    let decodedInfo = null;
    try {
      decodedInfo = jwt.decode(refreshToken, { complete: true });
      if (decodedInfo) {
        logger.info('🔍 [Delivery Refresh Token] Token decoded (without verification)', {
          hasPayload: !!decodedInfo.payload,
          role: decodedInfo.payload?.role,
          type: decodedInfo.payload?.type,
          userId: decodedInfo.payload?.userId,
          exp: decodedInfo.payload?.exp,
          iat: decodedInfo.payload?.iat,
          isExpired: decodedInfo.payload?.exp ? (Date.now() / 1000 > decodedInfo.payload.exp) : null
        });
      }
    } catch (decodeError) {
      logger.warn('⚠️ [Delivery Refresh Token] Failed to decode token (diagnostic)', {
        error: decodeError.message
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwtService.verifyRefreshToken(refreshToken);
    } catch (verifyError) {
      // Special handling for signature mismatch: If token decodes successfully but signature doesn't match,
      // it might be from a different secret (e.g., after secret rotation). 
      // In this case, if the decoded info is valid and user exists, we can regenerate tokens.
      if (verifyError.message && verifyError.message.includes('signature') && decodedInfo && decodedInfo.payload) {
        logger.warn('⚠️ [Delivery Refresh Token] Signature mismatch detected, attempting recovery', {
          userId: decodedInfo.payload.userId,
          role: decodedInfo.payload.role,
          type: decodedInfo.payload.type
        });

        // Validate decoded token structure
        if (decodedInfo.payload.role === 'delivery' && 
            decodedInfo.payload.type === 'refresh' && 
            decodedInfo.payload.userId &&
            (!decodedInfo.payload.exp || (Date.now() / 1000 < decodedInfo.payload.exp))) {
          
          // Check if delivery exists and is active
          const delivery = await Delivery.findById(decodedInfo.payload.userId).select('+refreshToken');
          
          if (delivery && delivery.isActive) {
            logger.info('✅ [Delivery Refresh Token] Signature mismatch recovery: Regenerating tokens for valid user', {
              deliveryId: delivery._id.toString(),
              deliveryName: delivery.name
            });

            // Generate new tokens with current secret
            const tokens = jwtService.generateTokens({
              userId: delivery._id.toString(),
              role: 'delivery',
              email: delivery.email || delivery.phone || delivery.deliveryId
            });

            // Update refresh token in database
            delivery.refreshToken = tokens.refreshToken;
            await delivery.save();

            // Set new refresh token in httpOnly cookie
            res.cookie('delivery_refreshToken', tokens.refreshToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 90 * 24 * 60 * 60 * 1000 // 90 days
            });

            logger.info('✅ [Delivery Refresh Token] Tokens regenerated after signature mismatch recovery', {
              deliveryId: delivery._id.toString()
            });

            return successResponse(res, 200, 'Token refreshed successfully (recovered from signature mismatch)', {
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken
            });
          }
        }
      }
      
      // If recovery failed, throw the original error
      throw verifyError;
    }

    // Ensure it's a delivery token
    if (decoded.role !== 'delivery') {
      logger.warn('❌ [Delivery Refresh Token] Invalid role in token', {
        expectedRole: 'delivery',
        actualRole: decoded.role,
        userId: decoded.userId,
        decodedInfo: decodedInfo?.payload
      });
      return errorResponse(res, 401, 'Invalid token for delivery');
    }

    // Get delivery boy from database
    const delivery = await Delivery.findById(decoded.userId).select('+refreshToken');

    if (!delivery || !delivery.isActive) {
      logger.warn('❌ [Delivery Refresh Token] Delivery boy not found or inactive', {
        userId: decoded.userId,
        found: !!delivery,
        isActive: delivery?.isActive
      });
      return errorResponse(res, 401, 'Delivery boy not found or inactive');
    }

    // For delivery partners, allow multiple devices by skipping the database token match check
    // Generate new access and refresh tokens
    const tokens = jwtService.generateTokens({
      userId: delivery._id.toString(),
      role: 'delivery',
      email: delivery.email || delivery.phone || delivery.deliveryId
    });

    // Update refresh token in database
    delivery.refreshToken = tokens.refreshToken;
    await delivery.save();

    // Set new refresh token in httpOnly cookie
    res.cookie('delivery_refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 90 * 24 * 60 * 60 * 1000 // 90 days
    });

    logger.info('✅ [Delivery Refresh Token] Token refreshed successfully', {
      deliveryId: delivery._id.toString(),
      deliveryName: delivery.name
    });

    return successResponse(res, 200, 'Token refreshed successfully', {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (error) {
    // Try to decode token to get more diagnostic info
    let decodedDiagnostic = null;
    try {
      decodedDiagnostic = jwt.decode(refreshToken, { complete: true });
    } catch (e) {
      // Ignore decode errors
    }

    // Enhanced error logging with more context
    const errorDetails = {
      error: error.message,
      errorName: error.name,
      tokenLength: refreshToken?.length,
      tokenParts: refreshToken?.split('.').length,
      tokenPreview: tokenPreview,
      hasSecret: !!process.env.JWT_SECRET,
      secretLength: process.env.JWT_SECRET?.length || 0,
      decodedRole: decodedDiagnostic?.payload?.role,
      decodedType: decodedDiagnostic?.payload?.type,
      decodedUserId: decodedDiagnostic?.payload?.userId,
      decodedExp: decodedDiagnostic?.payload?.exp,
      isExpired: decodedDiagnostic?.payload?.exp ? (Date.now() / 1000 > decodedDiagnostic.payload.exp) : null
    };

    // Don't log full stack in production to avoid exposing sensitive info
    if (process.env.NODE_ENV === 'development') {
      errorDetails.stack = error.stack;
    }

    logger.error('❌ [Delivery Refresh Token] Error refreshing token', errorDetails);

    // Return user-friendly error message
    let errorMessage = 'Invalid refresh token';
    if (error.message && error.message.toLowerCase().includes('expired')) {
      errorMessage = 'Refresh token expired. Please login again.';
    } else if (error.message && (error.message.toLowerCase().includes('signature') || error.message.toLowerCase().includes('secret'))) {
      errorMessage = 'Token signature invalid. Token may be from different server. Please login again.';
    } else if (error.message && error.message.toLowerCase().includes('format')) {
      errorMessage = 'Invalid token format. Please login again.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return errorResponse(res, 401, errorMessage);
  }
});

/**
 * Logout
 * POST /api/delivery/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
  // Get delivery boy from request (set by auth middleware)
  if (req.delivery) {
    // Clear refresh token from database
    req.delivery.refreshToken = null;
    await req.delivery.save();
  }

  // Clear all refresh token cookies
  const cookieNames = ['delivery_refreshToken', 'refreshToken'];
  cookieNames.forEach(name => {
    res.clearCookie(name, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
  });

  return successResponse(res, 200, 'Logged out successfully');
});

/**
 * Get current delivery boy
 * GET /api/delivery/auth/me
 */
export const getCurrentDelivery = asyncHandler(async (req, res) => {
  // Delivery boy is attached by authenticate middleware
  return successResponse(res, 200, 'Delivery boy retrieved successfully', {
    user: {
      id: req.delivery._id,
      deliveryId: req.delivery.deliveryId,
      name: req.delivery.name,
      email: req.delivery.email,
      phone: req.delivery.phone,
      phoneVerified: req.delivery.phoneVerified,
      signupMethod: req.delivery.signupMethod,
      profileImage: req.delivery.profileImage,
      isActive: req.delivery.isActive,
      status: req.delivery.status,
      location: req.delivery.location,
      vehicle: req.delivery.vehicle,
      documents: req.delivery.documents,
      availability: req.delivery.availability,
      metrics: req.delivery.metrics,
      earnings: req.delivery.earnings,
      wallet: req.delivery.wallet,
      level: req.delivery.level,
      lastLogin: req.delivery.lastLogin
    }
  });
});



/**
 * Save FCM Token
 * POST /api/delivery/auth/fcm-token
 */
export const saveFcmToken = asyncHandler(async (req, res) => {
  const { token, platform = 'web' } = req.body;
  const userId = req.delivery._id; // delivery middleware attaches to req.delivery

  if (!token) {
    return errorResponse(res, 400, 'Token is required');
  }

  const delivery = await Delivery.findById(userId);
  if (!delivery) {
    return errorResponse(res, 404, 'Delivery partner not found');
  }

  if (platform === 'web') {
    if (!delivery.fcmTokens) delivery.fcmTokens = [];
    if (!delivery.fcmTokens.includes(token)) {
      delivery.fcmTokens.push(token);
      if (delivery.fcmTokens.length > 10) delivery.fcmTokens = delivery.fcmTokens.slice(-10);
    }
  } else {
    if (!delivery.fcmTokenMobile) delivery.fcmTokenMobile = [];
    if (!delivery.fcmTokenMobile.includes(token)) {
      delivery.fcmTokenMobile.push(token);
      if (delivery.fcmTokenMobile.length > 10) delivery.fcmTokenMobile = delivery.fcmTokenMobile.slice(-10);
    }
  }

  await delivery.save();
  console.log(`✅ [Backend] FCM token saved for delivery partner ${userId} on platform ${platform}`);
  return successResponse(res, 200, 'FCM token saved successfully');
});

/**
 * Remove FCM Token
 * DELETE /api/delivery/auth/fcm-token
 */
export const removeFcmToken = asyncHandler(async (req, res) => {
  const { token, platform = 'web' } = req.body;
  const userId = req.delivery._id;

  const delivery = await Delivery.findById(userId);
  if (!delivery) {
    return errorResponse(res, 404, 'Delivery partner not found');
  }

  if (platform === 'web' && delivery.fcmTokens) {
    delivery.fcmTokens = delivery.fcmTokens.filter(t => t !== token);
  } else if (platform === 'mobile' && delivery.fcmTokenMobile) {
    delivery.fcmTokenMobile = delivery.fcmTokenMobile.filter(t => t !== token);
  }

  await delivery.save();
  return successResponse(res, 200, 'FCM token removed successfully');
});

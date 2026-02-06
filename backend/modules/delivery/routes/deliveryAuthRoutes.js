import express from 'express';
import {
  sendOTP,
  verifyOTP,
  refreshToken,
  logout,
  getCurrentDelivery,
  saveFcmToken,
  removeFcmToken
} from '../controllers/deliveryAuthController.js';
import { authenticate } from '../middleware/deliveryAuth.js';
import { validate } from '../../../shared/middleware/validate.js';
import Joi from 'joi';

console.log('📦 [DEBUG] Loading deliveryAuthRoutes.js');

const router = express.Router();

// Validation schemas
const sendOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .required(),
  purpose: Joi.string()
    .valid('login', 'register', 'reset-password', 'verify-phone')
    .default('login')
});

const verifyOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .required(),
  otp: Joi.string().required().length(6),
  purpose: Joi.string()
    .valid('login', 'register', 'reset-password', 'verify-phone')
    .default('login'),
  name: Joi.string().allow(null, '').optional()
});

// FCM Token Management
router.post('/fcm-token', authenticate, (req, res, next) => {
  console.log('🎯 [DEBUG] Hit POST /api/delivery/auth/fcm-token');
  next();
}, saveFcmToken);
router.delete('/fcm-token', authenticate, removeFcmToken);

// Public routes
router.post('/send-otp', validate(sendOTPSchema), sendOTP);
router.post('/verify-otp', validate(verifyOTPSchema), verifyOTP);
router.post('/refresh-token', refreshToken);

// Protected routes (require authentication)
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getCurrentDelivery);

export default router;

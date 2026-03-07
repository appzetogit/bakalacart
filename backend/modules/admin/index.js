// Admin module
import express from 'express';
import adminAuthRoutes from './routes/adminAuthRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { logoutAllUsers, getLogoutStatus } from './controllers/adminController.js';

const router = express.Router();

// Auth routes (public: signup/login, protected: me/logout)
router.use('/auth', adminAuthRoutes);

// Public logout endpoints - MUST be before protected routes
// Support all HTTP methods to avoid 405 errors
router.post('/users/logout-all', logoutAllUsers);
router.get('/users/logout-all', logoutAllUsers);
router.put('/users/logout-all', logoutAllUsers);
router.patch('/users/logout-all', logoutAllUsers);
router.all('/users/logout-all', (req, res, next) => {
  // If method not matched above, still call the handler
  if (req.method !== 'OPTIONS') {
    return logoutAllUsers(req, res, next);
  }
  next();
});

router.get('/users/logout-status', getLogoutStatus);

// Log route registration for debugging - CRITICAL for live debugging
console.log('✅ [Admin Routes] Public logout endpoints registered:', {
  'POST /users/logout-all': '✅',
  'GET /users/logout-all': '✅',
  'PUT /users/logout-all': '✅',
  'PATCH /users/logout-all': '✅',
  'GET /users/logout-status': '✅',
  'Full URL': '/api/admin/users/logout-all',
  'Environment': process.env.NODE_ENV || 'unknown',
  'Timestamp': new Date().toISOString()
});

// Add route debugging middleware for logout-all
router.use('/users/logout-all', (req, res, next) => {
  console.log('🔍 [Route Debug] Logout-all route hit:', {
    method: req.method,
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    timestamp: new Date().toISOString()
  });
  next();
});

// Admin management routes (protected)
router.use('/', adminRoutes);

export default router;


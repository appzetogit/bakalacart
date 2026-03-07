// Admin module
import express from 'express';
import adminAuthRoutes from './routes/adminAuthRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { logoutAllUsers, getLogoutStatus } from './controllers/adminController.js';

const router = express.Router();

// Auth routes (public: signup/login, protected: me/logout)
router.use('/auth', adminAuthRoutes);

// Public logout endpoints - MUST be before protected routes
router.post('/users/logout-all', logoutAllUsers);
router.get('/users/logout-all', logoutAllUsers);
router.get('/users/logout-status', getLogoutStatus);

// Admin management routes (protected)
router.use('/', adminRoutes);

export default router;


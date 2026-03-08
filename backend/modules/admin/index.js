// Admin module
import express from 'express';
import adminAuthRoutes from './routes/adminAuthRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
// COMMENTED OUT: logoutAllUsers API removed
// import { logoutAllUsers, getLogoutStatus } from './controllers/adminController.js';

const router = express.Router();

// Auth routes (public: signup/login, protected: me/logout)
router.use('/auth', adminAuthRoutes);

// COMMENTED OUT: Public logout endpoints - logoutAllUsers API removed
// Support all HTTP methods to avoid 405 errors
// router.post('/users/logout-all', logoutAllUsers);
// router.get('/users/logout-all', logoutAllUsers);
// router.put('/users/logout-all', logoutAllUsers);
// router.patch('/users/logout-all', logoutAllUsers);
// router.all('/users/logout-all', (req, res, next) => {
//   // If method not matched above, still call the handler
//   if (req.method !== 'OPTIONS') {
//     return logoutAllUsers(req, res, next);
//   }
//   next();
// });

// COMMENTED OUT: logout-status endpoint removed
// router.get('/users/logout-status', getLogoutStatus);

// Protected admin routes
router.use('/', adminRoutes);

export default router;

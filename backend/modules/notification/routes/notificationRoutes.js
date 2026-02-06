
import express from 'express';
import {
    sendAdminNotification,
    getNotifications,
    deleteNotification,
    toggleNotificationStatus
} from '../controllers/notificationController.js';
import { authenticateAdmin } from '../../admin/middleware/adminAuth.js';
import { uploadMiddleware } from '../../../shared/utils/cloudinaryService.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateAdmin);

router.post('/send', uploadMiddleware.single('image'), sendAdminNotification);
router.get('/', getNotifications);
router.delete('/:id', deleteNotification);
router.patch('/:id/status', toggleNotificationStatus);

export default router;

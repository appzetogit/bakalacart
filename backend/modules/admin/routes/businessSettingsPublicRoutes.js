import express from 'express';
import { getBusinessSettingsPublic } from '../controllers/businessSettingsController.js';

const router = express.Router();

// Public route - no authentication required
// GET /api/business-settings/public
router.get('/business-settings/public', getBusinessSettingsPublic);

// Alias for app startup / login screen: GET /api/settings (same as business-settings/public)
router.get('/settings', getBusinessSettingsPublic);

export default router;


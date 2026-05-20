import express from 'express';
import { getUpdatePageSettingsPublic } from '../controllers/updatePageSettingsController.js';

const router = express.Router();

router.get('/update-page/public', getUpdatePageSettingsPublic);

export default router;

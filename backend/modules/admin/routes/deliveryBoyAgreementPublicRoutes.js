import express from 'express';
import { getDeliveryBoyAgreementPublic } from '../controllers/deliveryBoyAgreementController.js';

const router = express.Router();

// Public route for Delivery Boy Agreement
router.get('/delivery-boy-agreement/public', getDeliveryBoyAgreementPublic);

export default router;

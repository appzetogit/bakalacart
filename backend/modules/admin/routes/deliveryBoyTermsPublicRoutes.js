import express from 'express';
import { getDeliveryBoyTermsPublic } from '../controllers/deliveryBoyTermsController.js';

const router = express.Router();

// Public route for Delivery Boy Terms & Conditions
router.get('/delivery-boy-terms/public', getDeliveryBoyTermsPublic);

export default router;

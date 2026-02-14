import DeliveryBoyAgreement from '../models/DeliveryBoyAgreement.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';

/**
 * Get Delivery Boy Agreement (Public)
 * GET /api/delivery-boy-agreement/public
 */
export const getDeliveryBoyAgreementPublic = asyncHandler(async (req, res) => {
  try {
    const agreement = await DeliveryBoyAgreement.findOne({ isActive: true })
      .select('-updatedBy -createdAt -updatedAt -__v')
      .lean();

    if (!agreement) {
      // Return default data if no agreement exists
      return successResponse(res, 200, 'Delivery boy agreement retrieved successfully', {
        title: 'Delivery Boy Agreement',
        content: '<p>No agreement available at the moment.</p>'
      });
    }

    return successResponse(res, 200, 'Delivery boy agreement retrieved successfully', agreement);
  } catch (error) {
    console.error('Error fetching delivery boy agreement:', error);
    return errorResponse(res, 500, 'Failed to fetch delivery boy agreement');
  }
});

/**
 * Get Delivery Boy Agreement (Admin)
 * GET /api/admin/delivery-boy-agreement
 */
export const getDeliveryBoyAgreement = asyncHandler(async (req, res) => {
  try {
    let agreement = await DeliveryBoyAgreement.findOne({ isActive: true }).lean();

    if (!agreement) {
      // Create default agreement if it doesn't exist
      agreement = await DeliveryBoyAgreement.create({
        title: 'Delivery Boy Agreement',
        content: '<p>This is the delivery boy agreement content. Please update this with your terms and conditions.</p>',
        updatedBy: req.admin._id
      });
    }

    return successResponse(res, 200, 'Delivery boy agreement retrieved successfully', agreement);
  } catch (error) {
    console.error('Error fetching delivery boy agreement:', error);
    return errorResponse(res, 500, 'Failed to fetch delivery boy agreement');
  }
});

/**
 * Update Delivery Boy Agreement
 * PUT /api/admin/delivery-boy-agreement
 */
export const updateDeliveryBoyAgreement = asyncHandler(async (req, res) => {
  try {
    const { title, content } = req.body;

    // Validate required fields
    if (!content) {
      return errorResponse(res, 400, 'Content is required');
    }

    // Find existing agreement or create new one
    let agreement = await DeliveryBoyAgreement.findOne({ isActive: true });

    if (!agreement) {
      agreement = new DeliveryBoyAgreement({
        title: title || 'Delivery Boy Agreement',
        content,
        updatedBy: req.admin._id
      });
    } else {
      if (title !== undefined) agreement.title = title;
      agreement.content = content;
      agreement.updatedBy = req.admin._id;
    }

    await agreement.save();

    return successResponse(res, 200, 'Delivery boy agreement updated successfully', agreement);
  } catch (error) {
    console.error('Error updating delivery boy agreement:', error);
    return errorResponse(res, 500, 'Failed to update delivery boy agreement');
  }
});

import DeliveryBoyTerms from '../models/DeliveryBoyTerms.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';

/**
 * Get Delivery Boy Terms & Conditions (Public)
 * GET /api/delivery-boy-terms/public
 */
export const getDeliveryBoyTermsPublic = asyncHandler(async (req, res) => {
  try {
    const terms = await DeliveryBoyTerms.findOne({ isActive: true })
      .select('-updatedBy -createdAt -updatedAt -__v')
      .lean();

    if (!terms) {
      // Return default data if no terms exists
      return successResponse(res, 200, 'Delivery boy terms & conditions retrieved successfully', {
        title: 'Delivery Boy Terms & Conditions',
        content: '<p>No terms & conditions available at the moment.</p>'
      });
    }

    return successResponse(res, 200, 'Delivery boy terms & conditions retrieved successfully', terms);
  } catch (error) {
    console.error('Error fetching delivery boy terms & conditions:', error);
    return errorResponse(res, 500, 'Failed to fetch delivery boy terms & conditions');
  }
});

/**
 * Get Delivery Boy Terms & Conditions (Admin)
 * GET /api/admin/delivery-boy-terms
 */
export const getDeliveryBoyTerms = asyncHandler(async (req, res) => {
  try {
    let terms = await DeliveryBoyTerms.findOne({ isActive: true }).lean();

    if (!terms) {
      // Create default terms if it doesn't exist
      terms = await DeliveryBoyTerms.create({
        title: 'Delivery Boy Terms & Conditions',
        content: '<p>This is the delivery boy terms & conditions content. Please update this with your terms and conditions.</p>',
        updatedBy: req.admin._id
      });
    }

    return successResponse(res, 200, 'Delivery boy terms & conditions retrieved successfully', terms);
  } catch (error) {
    console.error('Error fetching delivery boy terms & conditions:', error);
    return errorResponse(res, 500, 'Failed to fetch delivery boy terms & conditions');
  }
});

/**
 * Update Delivery Boy Terms & Conditions
 * PUT /api/admin/delivery-boy-terms
 */
export const updateDeliveryBoyTerms = asyncHandler(async (req, res) => {
  try {
    const { title, content } = req.body;

    // Validate required fields
    if (!content) {
      return errorResponse(res, 400, 'Content is required');
    }

    // Find existing terms or create new one
    let terms = await DeliveryBoyTerms.findOne({ isActive: true });

    if (!terms) {
      terms = new DeliveryBoyTerms({
        title: title || 'Delivery Boy Terms & Conditions',
        content,
        updatedBy: req.admin._id
      });
    } else {
      if (title !== undefined) terms.title = title;
      terms.content = content;
      terms.updatedBy = req.admin._id;
    }

    await terms.save();

    return successResponse(res, 200, 'Delivery boy terms & conditions updated successfully', terms);
  } catch (error) {
    console.error('Error updating delivery boy terms & conditions:', error);
    return errorResponse(res, 500, 'Failed to update delivery boy terms & conditions');
  }
});

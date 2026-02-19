
/**
 * Accept order on behalf of delivery boy
 * POST /api/admin/orders/:orderId/accept-delivery-boy
 */
export const acceptOrderOnBehalfOfDeliveryBoy = asyncHandler(async (req, res) => {
    try {
        const { orderId } = req.params;

        // Find order
        let order = null;
        if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
            order = await Order.findById(orderId);
        }
        if (!order) {
            order = await Order.findOne({ orderId: orderId });
        }

        if (!order) {
            return errorResponse(res, 404, 'Order not found');
        }

        // Check if delivery partner is assigned
        if (!order.deliveryPartnerId) {
            return errorResponse(res, 400, 'No delivery partner assigned to this order');
        }

        // Update delivery state
        order.deliveryState = {
            ...order.deliveryState,
            status: 'accepted',
            acceptedAt: new Date(),
            currentPhase: 'accepted'
        };

        // Also update order status if needed (e.g. if it was pending assignment)
        // usually status doesn't change just by acceptance, unless it's to confirm assignment

        await order.save();

        return successResponse(res, 200, 'Order accepted successfully on behalf of delivery boy', {
            order
        });
    } catch (error) {
        console.error('Error accepting order on behalf of delivery boy:', error);
        return errorResponse(res, 500, 'Failed to accept order on behalf of delivery boy');
    }
});

/**
 * Reject order on behalf of delivery boy
 * POST /api/admin/orders/:orderId/reject-delivery-boy
 */
export const rejectOrderOnBehalfOfDeliveryBoy = asyncHandler(async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;

        // Find order
        let order = null;
        if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
            order = await Order.findById(orderId);
        }
        if (!order) {
            order = await Order.findOne({ orderId: orderId });
        }

        if (!order) {
            return errorResponse(res, 404, 'Order not found');
        }

        if (!order.deliveryPartnerId) {
            return errorResponse(res, 400, 'No delivery partner assigned to this order to reject');
        }

        const deliveryPartnerId = order.deliveryPartnerId;

        // Add to denied list
        order.deniedDeliveryPartners = order.deniedDeliveryPartners || [];
        order.deniedDeliveryPartners.push({
            deliveryPartnerId: deliveryPartnerId,
            reason: reason || 'Rejected by admin on behalf of delivery boy',
            timestamp: new Date()
        });

        // Unassign
        order.deliveryPartnerId = null;
        order.deliveryState = {
            status: 'pending',
            currentPhase: 'searching',
            attempts: (order.deliveryState?.attempts || 0) + 1
        };

        // Clear assignment info
        order.assignmentInfo = {
            ...order.assignmentInfo,
            unassignedAt: new Date(),
            unassignedReason: 'admin_rejected_on_behalf'
        };

        await order.save();

        return successResponse(res, 200, 'Order rejected successfully on behalf of delivery boy', {
            order
        });
    } catch (error) {
        console.error('Error rejecting order on behalf of delivery boy:', error);
        return errorResponse(res, 500, 'Failed to reject order on behalf of delivery boy');
    }
});

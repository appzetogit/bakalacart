import Order from '../models/Order.js';
import { sendOrderPushNotification } from './pushNotificationService.js';
import mongoose from 'mongoose';

// Dynamic import to avoid circular dependency
let getIO = null;

async function getIOInstance() {
    if (!getIO) {
        const serverModule = await import('../../../server.js');
        getIO = serverModule.getIO;
    }
    return getIO ? getIO() : null;
}

/**
 * Notify user about order status update
 * @param {string} orderId - Order ID
 * @param {string} status - New status
 */
export async function notifyUserOrderUpdate(orderId, status) {
    console.log(`🔔 [User Notification] Processing update for Order ${orderId} Status: ${status}`);
    try {
        const io = await getIOInstance();

        // Fetch order details for notification
        const order = await Order.findById(orderId).lean();
        if (!order) {
            console.warn(`[User Notification] Order not found: ${orderId}`);
            return;
        }

        const userId = order.userId;
        if (!userId) {
            // Guest checkout or similar?
            console.warn(`[User Notification] No userId for order: ${orderId}`);
            return;
        }

        const updateData = {
            orderId: order.orderId,
            orderMongoId: order._id.toString(),
            status,
            updatedAt: new Date(),
            deliveryState: order.deliveryState,
            tracking: order.tracking
        };

        // 1. Emit to Order Room (for tracking screen)
        // Users join 'order:{orderId}' when tracking an order
        if (io) {
            io.to(`order:${order.orderId}`).emit('order_status_update', updateData);
            // Also emit to MongoId room if different (just in case)
            if (orderId.toString() !== order.orderId) {
                io.to(`order:${orderId}`).emit('order_status_update', updateData);
            }
        }

        // 2. Send Push Notification
        let title = 'Order Update';
        let body = `Your order #${order.orderId} status is now ${status}`;

        if (status === 'delivered') {
            title = 'Order Delivered! 🍽️';
            body = 'Your food has arrived! Enjoy your meal 😋';
        } else if (status === 'out_for_delivery') {
            title = 'Order Out for Delivery 🚴';
            body = 'Our delivery partner is on the way!';
        } else if (status === 'cancelled') {
            title = 'Order Cancelled ❌';
            body = 'Your order has been cancelled.';
        } else if (status === 'preparing') {
            title = 'Order Accepted 🍳';
            body = 'The restaurant is preparing your food.';
        } else if (status === 'ready') {
            title = 'Order Ready 🥡';
            body = 'Your food is ready for pickup.';
        }

        try {
            // Send to user
            await sendOrderPushNotification(userId, 'user', {
                title,
                body,
                data: {
                    orderId: order.orderId,
                    type: 'order_update',
                    status: status,
                    click_action: '/orders' // or app specific link
                }
            });
            console.log(`✅ [User Notification] Sent ${status} notification to user ${userId}`);
        } catch (pushError) {
            console.error('❌ [User Notification] Failed to send push:', pushError);
        }

    } catch (error) {
        console.error(`❌ [User Notification] Error notifying user for order ${orderId}:`, error);
    }
}

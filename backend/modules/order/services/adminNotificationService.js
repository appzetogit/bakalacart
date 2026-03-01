import Order from '../models/Order.js';
import mongoose from 'mongoose';

/**
 * Service to handle real-time notifications for Admins
 */

// Dynamic import to avoid circular dependency
let getIO = null;

async function getIOInstance() {
    if (!getIO) {
        try {
            const serverModule = await import('../../../server.js');
            getIO = serverModule.getIO;
        } catch (error) {
            console.error('❌ Failed to import socket.io instance:', error);
            return null;
        }
    }
    return getIO ? getIO() : null;
}

/**
 * Notify all admins about a new order via Socket.IO
 * @param {Object} order - The order document
 */
export async function notifyAdminNewOrder(order) {
    try {
        const io = await getIOInstance();
        if (!io) {
            console.warn('⚠️ Socket.IO not initialized, skipping admin notification');
            return;
        }

        const adminNamespace = io.of('/admin');

        // Prepare notification payload
        const adminNotification = {
            orderId: order.orderId,
            orderMongoId: order._id.toString(),
            restaurantId: order.restaurantId,
            restaurantName: order.restaurantName,
            customerName: order.userId?.name || 'Customer',
            total: order.pricing.total,
            status: order.status,
            items: order.items?.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price
            })) || [],
            customerAddress: {
                label: order.address?.label,
                street: order.address?.street,
                city: order.address?.city
            },
            createdAt: order.createdAt,
            paymentMethod: order.payment?.method || 'razorpay',
            type: 'new_order'
        };

        // Emit to all admins in the 'admin-room'
        adminNamespace.to('admin-room').emit('new_order', adminNotification);

        // Also emit a sound trigger
        adminNamespace.to('admin-room').emit('play_notification_sound', {
            type: 'new_order',
            orderId: order.orderId
        });

        console.log(`👑 [Admin Notification] Sent for order ${order.orderId} to admin-room`);

        return { success: true };
    } catch (error) {
        console.error('❌ Error notifying admins about new order:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Notify admins about order status update
 */
export async function notifyAdminOrderUpdate(orderId, status) {
    try {
        const io = await getIOInstance();
        if (!io) return;

        const adminNamespace = io.of('/admin');

        adminNamespace.to('admin-room').emit('order_status_update', {
            orderId,
            status,
            timestamp: new Date()
        });

        console.log(`👑 [Admin Notification] Status update for order ${orderId}: ${status}`);
    } catch (error) {
        console.error('❌ Error notifying admins about order update:', error);
    }
}

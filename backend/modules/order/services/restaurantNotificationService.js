import Order from '../models/Order.js';
import Payment from '../../payment/models/Payment.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import mongoose from 'mongoose';
import { sendOrderPushNotification } from './pushNotificationService.js';

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
 * Notify restaurant about new order via Socket.IO
 * @param {Object} order - Order document
 * @param {string} restaurantId - Restaurant ID
 * @param {string} [paymentMethodOverride] - Explicit payment method ('cash' | 'razorpay') so restaurant sees correct value
 */
export async function notifyRestaurantNewOrder(order, restaurantId, paymentMethodOverride) {
  try {
    const io = await getIOInstance();

    if (!io) {
      console.warn('Socket.IO not initialized, skipping restaurant notification');
      return;
    }

    // CRITICAL: Validate restaurantId matches order's restaurantId
    const orderRestaurantId = order.restaurantId?.toString() || order.restaurantId;
    const providedRestaurantId = restaurantId?.toString() || restaurantId;

    if (orderRestaurantId !== providedRestaurantId) {
      console.error('❌ CRITICAL: RestaurantId mismatch in notification!', {
        orderRestaurantId: orderRestaurantId,
        providedRestaurantId: providedRestaurantId,
        orderId: order.orderId,
        orderRestaurantName: order.restaurantName
      });
      // Use order's restaurantId instead of provided one
      restaurantId = orderRestaurantId;
    }

    // Get restaurant details
    let restaurant = null;
    if (mongoose.Types.ObjectId.isValid(restaurantId)) {
      restaurant = await Restaurant.findById(restaurantId).lean();
    }
    if (!restaurant) {
      restaurant = await Restaurant.findOne({
        $or: [
          { restaurantId: restaurantId },
          { _id: restaurantId }
        ]
      }).lean();
    }

    // Validate restaurant name matches order
    if (restaurant && order.restaurantName && restaurant.name !== order.restaurantName) {
      console.warn('⚠️ Restaurant name mismatch:', {
        orderRestaurantName: order.restaurantName,
        foundRestaurantName: restaurant.name,
        restaurantId: restaurantId
      });
      // Still proceed but log warning
    }

    // Resolve payment method: override > order.payment > Payment collection (COD fallback)
    let resolvedPaymentMethod = paymentMethodOverride ?? order.payment?.method ?? 'razorpay';
    if (resolvedPaymentMethod !== 'cash') {
      try {
        const paymentRecord = await Payment.findOne({ orderId: order._id }).select('method').lean();
        if (paymentRecord?.method === 'cash') resolvedPaymentMethod = 'cash';
      } catch (e) { /* ignore */ }
    }

    // Prepare order notification data
    const orderNotification = {
      orderId: order.orderId,
      orderMongoId: order._id.toString(),
      restaurantId: restaurantId,
      restaurantName: order.restaurantName,
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      total: order.pricing.total,
      customerAddress: {
        label: order.address.label,
        street: order.address.street,
        city: order.address.city,
        location: order.address.location
      },
      status: order.status,
      createdAt: order.createdAt,
      estimatedDeliveryTime: order.estimatedDeliveryTime || 30,
      note: order.note || '',
      sendCutlery: order.sendCutlery,
      paymentMethod: resolvedPaymentMethod
    };
    console.log('📢 Restaurant notification payload paymentMethod:', orderNotification.paymentMethod, { override: paymentMethodOverride, orderPaymentMethod: order.payment?.method });

    // Get restaurant namespace
    const restaurantNamespace = io.of('/restaurant');

    // Normalize restaurantId to string (handle both ObjectId and string)
    const normalizedRestaurantId = restaurantId?.toString() || restaurantId;
    const mongoId = restaurant?._id?.toString();
    const customId = restaurant?.restaurantId?.toString();

    // Try multiple room formats to ensure we find the restaurant
    const roomVariations = new Set([
      `restaurant:${normalizedRestaurantId}`,
      `restaurant:${restaurantId}`
    ]);

    if (mongoId) roomVariations.add(`restaurant:${mongoId}`);
    if (customId) roomVariations.add(`restaurant:${customId}`);

    // Also add ObjectId string format variants
    [mongoId, customId, normalizedRestaurantId].forEach(id => {
      if (id && mongoose.Types.ObjectId.isValid(id)) {
        roomVariations.add(`restaurant:${new mongoose.Types.ObjectId(id).toString()}`);
      }
    });

    const roomVariationsArray = Array.from(roomVariations);

    // Get all connected sockets in any of the restaurant rooms
    let socketsInRoom = [];
    for (const room of roomVariationsArray) {
      const sockets = await restaurantNamespace.in(room).fetchSockets();
      if (sockets.length > 0) {
        socketsInRoom = [...socketsInRoom, ...sockets];
        console.log(`📢 Found ${sockets.length} socket(s) in room: ${room}`);
      }
    }
    // De-duplicate sockets
    const uniqueSocketIds = new Set();
    socketsInRoom = socketsInRoom.filter(s => {
      if (uniqueSocketIds.has(s.id)) return false;
      uniqueSocketIds.add(s.id);
      return true;
    });

    const primaryRoom = roomVariationsArray[0];

    console.log(`📢 CRITICAL: Attempting to notify restaurant about new order:`);
    console.log(`📢 Order ID: ${order.orderId}`);
    console.log(`📢 Order MongoDB ID: ${order._id?.toString()}`);
    console.log(`📢 Restaurant ID (normalized): ${normalizedRestaurantId}`);
    console.log(`📢 Restaurant MongoID: ${mongoId}`);
    console.log(`📢 Restaurant CustomID: ${customId}`);
    console.log(`📢 Restaurant Name: ${order.restaurantName}`);
    console.log(`📢 Rooms attempted:`, roomVariationsArray);
    console.log(`📢 Total unique connected sockets: ${socketsInRoom.length}`);

    // CRITICAL: Only emit to the specific restaurant rooms
    if (socketsInRoom.length > 0) {
      // Found sockets - send notification to all relevant rooms
      roomVariationsArray.forEach(room => {
        restaurantNamespace.to(room).emit('new_order', orderNotification);
        restaurantNamespace.to(room).emit('play_notification_sound', {
          type: 'new_order',
          orderId: order.orderId,
          message: `New order received: ${order.orderId}`
        });
        console.log(`📤 Sent notification to room: ${room}`);
      });
      console.log(`✅ Notified restaurant ${normalizedRestaurantId} about new order ${order.orderId} (${socketsInRoom.length} unique socket(s) connected)`);
    } else {
      // No sockets found in restaurant room - log warning but DO NOT broadcast to all restaurants
      console.warn(`⚠️ No active socket connection for restaurant ${normalizedRestaurantId} (Rooms checked: ${roomVariationsArray.join(', ')})`);
      console.warn(`⚠️ Order ${order.orderId} notification will be sent via Push Notification`);

      // Still try to emit to room variations (in case socket connects later/buffered)
      roomVariationsArray.forEach(room => {
        restaurantNamespace.to(room).emit('new_order', orderNotification);
        restaurantNamespace.to(room).emit('play_notification_sound', {
          type: 'new_order',
          orderId: order.orderId,
          message: `New order received: ${order.orderId}`
        });
      });

      // We don't return early anymore, so Push Notification below will execute!
    }

    // 🔥 Send Push Notification (FCM)
    try {
      await sendOrderPushNotification(normalizedRestaurantId, 'restaurant', {
        title: '🔔 New Order Received!',
        body: `Order #${order.orderId} for ₹${order.pricing.total}`,
        data: {
          orderId: order.orderId,
          orderMongoId: order._id.toString(),
          type: 'new_order',
          click_action: '/orders'
        }
      });
      console.log(`✅ [Push Notification] Sent to restaurant ${normalizedRestaurantId} for order ${order.orderId}`);
    } catch (pushError) {
      console.error('❌ [Push Notification] Error sending to restaurant:', pushError);
    }

    return {
      success: true,
      restaurantId,
      orderId: order.orderId,
      socketConnected: socketsInRoom.length > 0
    };
  } catch (error) {
    console.error('Error notifying restaurant:', error);
    throw error;
  }
}

/**
 * Notify restaurant about order status update
 * @param {string} orderId - Order ID
 * @param {string} status - New status
 */
export async function notifyRestaurantOrderUpdate(orderId, status) {
  try {
    const io = await getIOInstance();

    if (!io) {
      console.warn('Socket.IO not initialized, skipping restaurant order update notification');
      return;
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      throw new Error('Order not found');
    }

    const restaurantId = order.restaurantId?.toString() || order.restaurantId;
    if (!restaurantId) {
      console.error('❌ Restaurant ID not found in order:', order.orderId);
      return;
    }

    // Get restaurant info to expand room variations
    let mongoId = order.restaurantId;
    let customId = null;

    try {
      const restaurant = await Restaurant.findOne({
        $or: [
          { _id: mongoose.isValidObjectId(mongoId) ? mongoId : null },
          { restaurantId: mongoId }
        ]
      }).select('_id restaurantId').lean();

      if (restaurant) {
        mongoId = restaurant._id.toString();
        customId = restaurant.restaurantId;
      }
    } catch (e) { /* ignore */ }

    // Try multiple room formats to ensure we find the restaurant
    const roomVariations = new Set([
      `restaurant:${restaurantId}`
    ]);

    if (mongoId) roomVariations.add(`restaurant:${mongoId}`);
    if (customId) roomVariations.add(`restaurant:${customId}`);

    // Add ObjectId variants
    [mongoId, customId, restaurantId].forEach(id => {
      if (id && mongoose.Types.ObjectId.isValid(id)) {
        roomVariations.add(`restaurant:${new mongoose.Types.ObjectId(id).toString()}`);
      }
    });

    const roomVariationsArray = Array.from(roomVariations);

    const updateData = {
      orderId: order.orderId,
      orderMongoId: order._id.toString(),
      status,
      updatedAt: new Date(),
      acceptedByAdmin: order.acceptedByAdmin || false
    };

    // Emit to all room variations
    roomVariationsArray.forEach(room => {
      restaurantNamespace.to(room).emit('order_status_update', updateData);
      console.log(`📤 Sent order status update to room: ${room}`);
    });

    // 🔥 Send Push Notification for delivered status
    if (status === 'delivered') {
      try {
        await sendOrderPushNotification(restaurantId, 'restaurant', {
          title: '✅ Order Delivered!',
          body: `Order #${order.orderId} has been successfully delivered by the delivery partner.`,
          data: {
            orderId: order.orderId,
            orderMongoId: order._id.toString(),
            type: 'order_delivered',
            click_action: '/orders'
          }
        });
        console.log(`✅ [Push Notification] Sent to restaurant ${restaurantId} for delivery completion`);
      } catch (pushError) {
        console.error('❌ [Push Notification] Error sending to restaurant:', pushError);
      }
    }

    console.log(`📢 Notified restaurant ${restaurantId} about order ${order.orderId} status: ${status}`);
  } catch (error) {
    console.error('Error notifying restaurant about order update:', error);
    throw error;
  }
}


import Order from '../models/Order.js';
import { notifyRestaurantOrderUpdate } from './restaurantNotificationService.js';
import { calculateCancellationRefund } from './cancellationRefundService.js';

/**
 * Automatically reject orders that haven't been accepted within the accept time limit
 * This runs as a cron job to check all pending/confirmed orders
 * Accept time limit: 240 seconds (4 minutes)
 * @returns {Promise<{processed: number, message: string}>}
 */
export async function processAutoRejectOrders() {
  try {
    const ACCEPT_TIME_LIMIT_SECONDS = 240; // 4 minutes
    const ACCEPT_TIME_LIMIT_MS = ACCEPT_TIME_LIMIT_SECONDS * 1000;

    // Find all orders with status 'pending' or 'confirmed' that haven't been accepted yet
    // These are orders waiting for restaurant to accept
    const validPendingOrders = await Order.find({
      status: { $in: ['pending', 'confirmed'] }
    }).lean();

    if (validPendingOrders.length === 0) {
      return { processed: 0, message: 'No pending orders to check' };
    }

    const now = new Date();
    let processedCount = 0;
    const rejectedOrders = [];

    for (const order of validPendingOrders) {
      const orderCreatedAt = new Date(order.createdAt);
      const elapsedMs = now - orderCreatedAt;

      // Check if accept time has expired
      if (elapsedMs >= ACCEPT_TIME_LIMIT_MS) {
        try {
          // Double-check order hasn't been accepted or cancelled by another process
          const currentOrder = await Order.findById(order._id);
          if (!currentOrder) {
            continue; // Order was deleted
          }

          // Only reject if still in pending/confirmed status
          if (!['pending', 'confirmed'].includes(currentOrder.status)) {
            continue; // Order was already accepted/rejected
          }

          // CRITICAL FIX: Check if payment was actually made (for Razorpay orders)
          // Ideally, frontend handles verification, but if user closed tab, payment might be successful but order pending
          if (currentOrder.payment?.method === 'razorpay' && currentOrder.payment?.status === 'pending') {
            try {
              const { fetchOrderPayments } = await import('../../payment/services/razorpayService.js');
              const razorpayOrderId = currentOrder.payment.razorpayOrderId;

              if (razorpayOrderId) {
                const payments = await fetchOrderPayments(razorpayOrderId);
                // Check if any payment is captured or authorized
                const successfulPayment = payments.items?.find(p => p.status === 'captured' || p.status === 'authorized');

                if (successfulPayment) {
                  console.log(`✅ FOUND SUCCESSFUL PAYMENT for pending order ${currentOrder.orderId}:`, successfulPayment.id);

                  // Mark order as paid and confirmed instead of cancelling
                  currentOrder.payment.status = 'completed';
                  currentOrder.payment.razorpayPaymentId = successfulPayment.id;
                  currentOrder.payment.transactionId = successfulPayment.id;
                  currentOrder.status = 'confirmed';
                  currentOrder.tracking.confirmed = { status: true, timestamp: new Date() };

                  await currentOrder.save();

                  console.log(`✅ Auto-confirmed order ${currentOrder.orderId} (recovered from pending state)`);

                  // Notify restaurant about the recovered order
                  try {
                    const { notifyRestaurantNewOrder } = await import('./restaurantNotificationService.js');
                    await notifyRestaurantNewOrder(currentOrder, currentOrder.restaurantId);
                  } catch (notifyError) {
                    console.error('Error notifying restaurant for recovered order:', notifyError);
                  }

                  continue; // Skip cancellation logic!
                }
              }
            } catch (paymentCheckError) {
              console.error(`⚠️ Error checking Razorpay status for auto-reject candidate ${currentOrder.orderId}:`, paymentCheckError);
              // Fallthrough to cancel if check fails (safest default for truly abandoned orders)
            }
          }

          // Update order status to cancelled
          currentOrder.status = 'cancelled';
          currentOrder.cancellationReason = 'Order not accepted within time limit. Restaurant did not respond in time.';
          currentOrder.cancelledBy = 'restaurant';
          currentOrder.cancelledAt = now;

          await currentOrder.save();

          rejectedOrders.push({
            orderId: currentOrder.orderId,
            elapsedSeconds: Math.floor(elapsedMs / 1000)
          });
          processedCount++;

          console.log(`✅ Order ${currentOrder.orderId} automatically rejected (elapsed: ${Math.floor(elapsedMs / 1000)}s >= ${ACCEPT_TIME_LIMIT_SECONDS}s)`);

          // Calculate refund amount but don't process automatically
          // Admin will process refund manually via refund button
          try {
            await calculateCancellationRefund(
              currentOrder._id,
              'Order not accepted within time limit. Restaurant did not respond in time.'
            );
            console.log(`✅ Cancellation refund calculated for order ${currentOrder.orderId} - awaiting admin approval`);
          } catch (refundError) {
            console.error(`❌ Error calculating cancellation refund for order ${currentOrder.orderId}:`, refundError);
            // Don't fail order cancellation if refund calculation fails
          }

          // Notify about status update
          try {
            await notifyRestaurantOrderUpdate(currentOrder._id.toString(), 'cancelled');
          } catch (notifError) {
            console.error(`❌ Error sending notification for order ${currentOrder.orderId}:`, notifError);
          }
        } catch (updateError) {
          console.error(`❌ Error auto-rejecting order ${order.orderId}:`, updateError);
        }
      }
    }

    // --- ADDITIONAL RECOVERY FOR ALREADY CANCELLED ORDERS ---
    // Check for orders cancelled recently (e.g. last 1 hour) that are Razorpay + Pending Payment
    // This fixes the issue where an order was auto-cancelled BEFORE the payment could be verified
    try {
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const ambiguousCancelledOrders = await Order.find({
        status: 'cancelled',
        'payment.method': 'razorpay',
        'payment.status': 'pending',
        updatedAt: { $gte: oneHourAgo } // Limit scope to recently modified orders
      });

      if (ambiguousCancelledOrders.length > 0) {
        console.log(`🔍 Checking ${ambiguousCancelledOrders.length} recently cancelled orders for payments...`);
        const { fetchOrderPayments } = await import('../../payment/services/razorpayService.js');

        for (const cancelledOrder of ambiguousCancelledOrders) {
          try {
            const razorpayOrderId = cancelledOrder.payment.razorpayOrderId;
            if (razorpayOrderId) {
              const payments = await fetchOrderPayments(razorpayOrderId);
              const successfulPayment = payments.items?.find(p => p.status === 'captured' || p.status === 'authorized');

              if (successfulPayment) {
                console.log(`✅ FOUND PAYMENT FOR CANCELLED ORDER ${cancelledOrder.orderId}:`, successfulPayment.id);

                // CRITICAL FIX: Reactivate the order!
                // The user wants it to appear in "Order Assign" (active orders).
                // So we must revert 'cancelled' -> 'confirmed'.

                cancelledOrder.status = 'confirmed'; // Reactivate order!

                cancelledOrder.payment.status = 'completed';
                cancelledOrder.payment.razorpayPaymentId = successfulPayment.id;
                cancelledOrder.payment.transactionId = successfulPayment.id;

                // Update tracking
                if (!cancelledOrder.tracking) cancelledOrder.tracking = {};
                cancelledOrder.tracking.confirmed = { status: true, timestamp: new Date() };

                // Add a note but clear cancellation flags so it's treated as active
                const oldReason = cancelledOrder.cancellationReason || '';
                cancelledOrder.cancellationReason = ''; // Clear reason so it doesn't look cancelled
                cancelledOrder.note = (cancelledOrder.note || '') + ` [System: Auto-recovered from cancellation. Payment verified. Previous reason: ${oldReason}]`;

                // Remove cancellation meta
                cancelledOrder.cancelledBy = undefined;
                cancelledOrder.cancelledAt = undefined;

                await cancelledOrder.save();
                console.log(`✅ REACTIVATED Order ${cancelledOrder.orderId}. Status: CONFIRMED, Payment: COMPLETED.`);

                // Notify restaurant again so they see it in "New Orders"
                try {
                  const { notifyRestaurantNewOrder } = await import('./restaurantNotificationService.js');
                  await notifyRestaurantNewOrder(cancelledOrder, cancelledOrder.restaurantId);
                } catch (notifyError) {
                  console.error('Error notifying restaurant for reactivated order:', notifyError);
                }
              }
            }
          } catch (err) {
            console.error(`Error checking payment for cancelled order ${cancelledOrder.orderId}:`, err);
          }
        }
      }
    } catch (recoveryError) {
      console.error('Error in cancelled order recovery loop:', recoveryError);
    }

    return {
      processed: processedCount,
      message: processedCount > 0
        ? `Auto-rejected ${processedCount} order(s) that were not accepted within ${ACCEPT_TIME_LIMIT_SECONDS} seconds`
        : 'No orders to auto-reject'
    };
  } catch (error) {
    console.error('❌ Error processing auto-reject orders:', error);
    return { processed: 0, message: `Error: ${error.message}` };
  }
}

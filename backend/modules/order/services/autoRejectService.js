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
    const ACCEPT_TIME_LIMIT_SECONDS = 600; // 10 minutes (increased from 4 mins for better reliability)
    const ACCEPT_TIME_LIMIT_MS = ACCEPT_TIME_LIMIT_SECONDS * 1000;

    // Find all orders with status 'pending' or 'confirmed' that haven't been accepted yet
    const validPendingOrders = await Order.find({
      status: { $in: ['pending', 'confirmed'] }
    }).lean();

    if (validPendingOrders.length === 0) {
      // Still run recovery loop even if no pending orders
    }

    const now = new Date();
    let processedCount = 0;

    for (const order of validPendingOrders) {
      const orderCreatedAt = new Date(order.createdAt);
      const elapsedMs = now - orderCreatedAt;

      // Check if accept time has expired
      if (elapsedMs >= ACCEPT_TIME_LIMIT_MS) {
        try {
          const currentOrder = await Order.findById(order._id);
          if (!currentOrder || !['pending', 'confirmed'].includes(currentOrder.status)) continue;

          // DYNAMIC RECOVERY: Check Razorpay for payment status before rejecting
          let successfulPayment = null;
          try {
            const { fetchOrderPayments, getRazorpayInstance } = await import('../../payment/services/razorpayService.js');
            const razorpayOrderId = currentOrder.payment?.razorpayOrderId;

            if (razorpayOrderId) {
              const payments = await fetchOrderPayments(razorpayOrderId);
              successfulPayment = payments.items?.find(p => p.status === 'captured' || p.status === 'authorized');
            } else {
              // Search by receipt (Order ID) if razorpayOrderId is missing
              const razorpay = await getRazorpayInstance();
              if (razorpay) {
                const rzpOrders = await razorpay.orders.all({ receipt: currentOrder.orderId });
                if (rzpOrders.items?.length > 0) {
                  const rzpOrderId = rzpOrders.items[0].id;
                  const payments = await razorpay.orders.fetchPayments(rzpOrderId);
                  successfulPayment = payments.items?.find(p => p.status === 'captured' || p.status === 'authorized');
                  if (successfulPayment) {
                    currentOrder.payment.razorpayOrderId = rzpOrderId;
                  }
                }
              }
            }
          } catch (e) {
            console.error(`Error checking payment for ${currentOrder.orderId}:`, e.message);
          }

          if (successfulPayment) {
            console.log(`✅ [Auto-Reject] Recovery triggered for ${currentOrder.orderId}: Payment found (${successfulPayment.id})`);
            currentOrder.payment.status = 'completed';
            currentOrder.payment.razorpayPaymentId = successfulPayment.id;
            currentOrder.payment.transactionId = successfulPayment.id;
            currentOrder.status = 'confirmed';
            currentOrder.tracking.confirmed = { status: true, timestamp: new Date() };
            await currentOrder.save();

            try {
              const { notifyRestaurantNewOrder } = await import('./restaurantNotificationService.js');
              await notifyRestaurantNewOrder(currentOrder, currentOrder.restaurantId);
            } catch (nErr) { console.error('Notify Error:', nErr.message); }
            continue;
          }

          // Proceed with rejection if no payment found
          currentOrder.status = 'cancelled';
          currentOrder.cancellationReason = 'Order not accepted within time limit. Restaurant did not respond in time.';
          currentOrder.cancelledBy = 'restaurant';
          currentOrder.cancelledAt = now;
          await currentOrder.save();
          processedCount++;

          console.log(`🔒 Order ${currentOrder.orderId} auto-rejected.`);

          try {
            await calculateCancellationRefund(currentOrder._id, 'Order not accepted within time limit.');
          } catch (refErr) { console.error('Refund calc error:', refErr.message); }

          try {
            await notifyRestaurantOrderUpdate(currentOrder._id.toString(), 'cancelled');
          } catch (notifError) { console.error('Update notification error:', notifError.message); }

        } catch (updateError) {
          console.error(`❌ Error processing order ${order.orderId}:`, updateError);
        }
      }
    }

    // --- RECOVERY FOR ALREADY CANCELLED ORDERS (FIX FOR USER) ---
    try {
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const ambiguousCancelledOrders = await Order.find({
        status: 'cancelled',
        updatedAt: { $gte: oneHourAgo }
      });

      if (ambiguousCancelledOrders.length > 0) {
        console.log(`🔍 Checking ${ambiguousCancelledOrders.length} recently cancelled orders...`);
        const { fetchOrderPayments, getRazorpayInstance } = await import('../../payment/services/razorpayService.js');
        const razorpay = await getRazorpayInstance();

        for (const cancelledOrder of ambiguousCancelledOrders) {
          try {
            let successfulPayment = null;
            const razorpayOrderId = cancelledOrder.payment?.razorpayOrderId;

            if (razorpayOrderId) {
              const payments = await fetchOrderPayments(razorpayOrderId);
              successfulPayment = payments.items?.find(p => p.status === 'captured' || p.status === 'authorized');
            } else if (razorpay) {
              const rzpOrders = await razorpay.orders.all({ receipt: cancelledOrder.orderId });
              if (rzpOrders.items?.length > 0) {
                const rzpOrderId = rzpOrders.items[0].id;
                const payments = await razorpay.orders.fetchPayments(rzpOrderId);
                successfulPayment = payments.items?.find(p => p.status === 'captured' || p.status === 'authorized');
                if (successfulPayment) cancelledOrder.payment.razorpayOrderId = rzpOrderId;
              }
            }

            if (successfulPayment) {
              console.log(`✅ [Recovery] Reactivating order ${cancelledOrder.orderId} due to verified payment.`);
              cancelledOrder.status = 'confirmed';
              cancelledOrder.payment.status = 'completed';
              cancelledOrder.payment.razorpayPaymentId = successfulPayment.id;
              cancelledOrder.payment.transactionId = successfulPayment.id;
              cancelledOrder.cancellationReason = '';
              cancelledOrder.cancelledBy = undefined;
              cancelledOrder.cancelledAt = undefined;
              // Re-confirmed order doesn't need system text in customer-facing note
              // cancelledOrder.note = (cancelledOrder.note || '') + ' [System: Recovery verified payment]';
              if (!cancelledOrder.tracking) cancelledOrder.tracking = {};
              cancelledOrder.tracking.confirmed = { status: true, timestamp: new Date() };

              await cancelledOrder.save();

              try {
                const { notifyRestaurantNewOrder } = await import('./restaurantNotificationService.js');
                await notifyRestaurantNewOrder(cancelledOrder, cancelledOrder.restaurantId);
              } catch (nErr) { console.error('Recovery Notify Error:', nErr.message); }
            }
          } catch (innerErr) {
            console.error(`Error in recovery loop for ${cancelledOrder.orderId}:`, innerErr.message);
          }
        }
      }
    } catch (recErr) {
      console.error('Recovery Loop Error:', recErr.message);
    }

    return { processed: processedCount, message: `Processed ${processedCount} rejections.` };
  } catch (error) {
    console.error('❌ Global error in autoReject:', error);
    return { processed: 0, message: error.message };
  }
}

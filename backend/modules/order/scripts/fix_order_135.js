
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Razorpay from 'razorpay';
import Order from '../models/Order.js'; // Ensure correct path
import Restaurant from '../../restaurant/models/Restaurant.js';

// Load env vars
dotenv.config({ path: '../../.env' });
if (!process.env.MONGODB_URI) dotenv.config();

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;
        await mongoose.connect(uri);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    }
};

const run = async () => {
    await connectDB();

    // 1. Check Restaurant Timings
    const restaurantName = "Grocery & Daily Essential";
    const restaurant = await Restaurant.findOne({ name: { $regex: "Grocery", $options: "i" } });
    if (restaurant) {
        console.log(`\n=== RESTAURANT: ${restaurant.name} ===`);
        console.log(`Timings: Open ${restaurant.deliveryTimings?.openingTime}, Close ${restaurant.deliveryTimings?.closingTime}`);
        console.log(`Accepting Orders: ${restaurant.isAcceptingOrders}`);

        // Fix if necessary
        if (restaurant.deliveryTimings?.closingTime === '01:00' || restaurant.deliveryTimings?.closingTime === '1:00') {
            console.log("⚠️ Found potentially incorrect closing time '01:00' (1 AM). This explains why it stayed open.");
            console.log("Change to '13:00' (1 PM)? (Simulating fix)");
            // Uncomment to fix
            // restaurant.deliveryTimings.closingTime = '13:00';
            // await restaurant.save();
            // console.log("✅ Updated closing time to 13:00");
        }
    } else {
        console.log("\n❌ Restaurant not found.");
    }

    // 2. Check Order Payment
    const orderIdToFind = 'ORD-1771241035689-70';
    // Remove "ORD-" and timestamps if searching by _id, but user gave string ID.
    // Usually orderId is a custom string field.
    const order = await Order.findOne({ orderId: orderIdToFind });

    if (order) {
        console.log(`\n=== ORDER: ${order.orderId} ===`);
        console.log(`Status: ${order.status}`);
        console.log(`Payment Status: ${order.payment.status}`);
        console.log(`Razorpay Order ID: ${order.payment.razorpayOrderId}`);
        console.log(`Transaction ID: ${order.payment.transactionId}`);
        console.log(`Amount: ${order.totalAmount}`);

        // If cancellation happened
        console.log(`Cancellation Reason: ${order.cancellationReason}`);
        console.log(`Cancelled By: ${order.cancelledBy}`);

        if (order.payment.razorpayOrderId) {
            console.log("\nChecking Razorpay status...");
            const razorpay = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET,
            });

            try {
                // Fetch order from Razorpay
                const rzpOrder = await razorpay.orders.fetch(order.payment.razorpayOrderId);
                console.log(`Razorpay Order Status: ${rzpOrder.status} (amount_paid: ${rzpOrder.amount_paid})`);

                // Fetch payments for this order
                const payments = await razorpay.orders.fetchPayments(order.payment.razorpayOrderId);
                console.log(`Payments found: ${payments.count}`);

                const successfulPayment = payments.items.find(p => p.status === 'captured');
                if (successfulPayment) {
                    console.log(`✅ FOUND SUCCESSFUL PAYMENT: ${successfulPayment.id}`);

                    // FIX: Update Order
                    if (order.status === 'cancelled' || order.payment.status !== 'completed') {
                        console.log("⚠️ Order is Cancelled/Unpaid despite payment. Fixing...");

                        order.status = 'confirmed';
                        order.payment.status = 'completed';
                        order.payment.transactionId = successfulPayment.id;
                        order.payment.razorpayPaymentId = successfulPayment.id;
                        order.cancellationReason = '';
                        order.cancelledBy = undefined;
                        order.cancelledAt = undefined;
                        order.note = (order.note || '') + ' [System: Manually recovered via script. Payment verified.]';

                        await order.save();
                        console.log("✅ ORDER FIXED and REACTIVATED!");
                    } else {
                        console.log("Order status is already correct.");
                    }
                } else {
                    console.log("❌ No captured payment found on Razorpay.");
                }

            } catch (rzpError) {
                console.error("Razorpay API Error:", rzpError);
            }
        } else {
            console.log("⚠️ No Razorpay Order ID on local order.");
        }
    } else {
        console.log("\n❌ Order not found.");
        // Try searching by _id just in case
        // const orderById = await Order.findById('...'); 
    }

    process.exit(0);
};

run();

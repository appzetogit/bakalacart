
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order.js';

dotenv.config({ path: 'e:/bakalanew/bakalacart/backend/.env' });

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    // The specific order from the new screenshot
    const targetOrderId = 'ORD-1771244970343-325';
    const order = await Order.findOne({ orderId: targetOrderId }).lean();

    if (order) {
        console.log("=== ORDER 325 DETAILS ===");
        console.log("ID:", order._id);
        console.log("Status:", order.status);
        console.log("Payment Method:", order.payment?.method);
        console.log("Payment Status:", order.payment?.status);
        console.log("Cancelled At:", order.cancelledAt);
        console.log("Cancellation Reason:", order.cancellationReason);
        console.log("CreatedAt:", order.createdAt);
        console.log("AssignmentInfo:", JSON.stringify(order.assignmentInfo, null, 2));
    } else {
        console.log("Order 325 not found.");
    }
    process.exit(0);
};

run();


import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order.js';

dotenv.config({ path: 'e:/bakalanew/bakalacart/backend/.env' });

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const targetOrderId = 'ORD-1771241035689-70';
    const order = await Order.findOne({ orderId: targetOrderId }).lean();

    if (order) {
        console.log("=== ORDER 135 DETAILS ===");
        console.log("Status:", order.status);
        console.log("Order Type (SelfPickup):", order.isSelfPickup);
        console.log("Delivery Fleet:", order.deliveryFleet);
        console.log("Assignment Info:", JSON.stringify(order.assignmentInfo, null, 2));
        console.log("Zone ID:", order.assignmentInfo?.zoneId);
    } else {
        console.log("Order not found.");
    }
    process.exit(0);
};

run();

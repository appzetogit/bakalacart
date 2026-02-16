
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order.js';

dotenv.config({ path: 'e:/bakalanew/bakalacart/backend/.env' });

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const targetOrderId = 'ORD-1771241035689-70';
    const order = await Order.findOne({ orderId: targetOrderId });

    if (order) {
        console.log("Fixing order 135 for Assignment List...");

        // 1. Reactivate
        order.status = 'confirmed';
        order.payment.status = 'completed';
        order.cancellationReason = '';
        order.cancelledBy = undefined;
        order.cancelledAt = undefined;

        // 2. Set Zone Info (Missing in this order)
        // From find_zone.js, we found Mumbra zone
        order.assignmentInfo = {
            zoneId: '6990670787828d02f45af09f',
            zoneName: 'Mumbra',
            pincode: '400612'
        };

        // 3. Reset Timer (Give it another 10 minutes to be accepted)
        const now = new Date();
        order.createdAt = now;
        order.updatedAt = now;

        if (!order.tracking) order.tracking = {};
        order.tracking.confirmed = { status: true, timestamp: now };

        order.note = (order.note || '') + ' [System: Fixed for Order Assign list]';

        await order.save();
        console.log("Order 135 updated successfully.");
        console.log("New Status:", order.status);
        console.log("Zone:", order.assignmentInfo.zoneName);
        console.log("Time Reset to:", order.createdAt);
    } else {
        console.log("Order not found.");
    }
    process.exit(0);
};

run();

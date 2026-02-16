
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order.js';

dotenv.config({ path: 'e:/bakalanew/bakalacart/backend/.env' });

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const targetOrderId = 'ORD-1771241035689-70';
    const order = await Order.findOne({ orderId: targetOrderId });

    if (order && order.status === 'cancelled') {
        console.log("Fixing order 135...");
        order.status = 'confirmed';
        order.payment.status = 'completed';
        order.cancellationReason = '';
        order.cancelledBy = undefined;
        order.cancelledAt = undefined;
        order.note = (order.note || '') + ' [System: Manual Fix as requested by admin]';

        if (!order.tracking) order.tracking = {};
        order.tracking.confirmed = { status: true, timestamp: new Date() };

        await order.save();
        console.log("Order 135 is now CONFIRMED and PAID.");
    } else {
        console.log("Order not found or already active.");
    }
    process.exit(0);
};

run();

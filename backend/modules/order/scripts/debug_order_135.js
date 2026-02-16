
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: 'e:/bakalanew/bakalacart/backend/.env' });

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const targetOrderId = 'ORD-1771241035689-70';
    const order = await mongoose.connection.db.collection('orders').findOne({ orderId: targetOrderId });

    if (order) {
        console.log("=== TARGET ORDER ===");
        console.log(JSON.stringify(order, null, 2));

        // Find other orders for this user today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const userOrders = await mongoose.connection.db.collection('orders').find({
            userId: order.userId,
            createdAt: { $gte: startOfDay }
        }).toArray();

        console.log("\n=== ALL USER ORDERS TODAY ===");
        userOrders.forEach(o => console.log(`- ${o.orderId}, Status: ${o.status}, Payment: ${o.payment.method}/${o.payment.status}, Total: ${o.pricing?.total || o.totalAmount}`));
    } else {
        console.log("Order not found.");
    }
    process.exit(0);
};

run();

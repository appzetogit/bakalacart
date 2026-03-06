import mongoose from 'mongoose';
import 'dotenv/config';
import Order from './modules/order/models/Order.js';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const tStart = new Date();
    tStart.setHours(0, 0, 0, 0);
    const tEnd = new Date();
    tEnd.setHours(23, 59, 59, 999);
    
    // Find orders that match the logic for todayTotalOrdersCount
    const todayOrders = await Order.find({
      status: 'delivered',
      deliveryPartnerId: { $ne: null },
      $or: [
        { deliveredAt: { $gte: tStart, $lte: tEnd } },
        { updatedAt: { $gte: tStart, $lte: tEnd } }
      ]
    }).select('orderId status deliveredAt updatedAt deliveryPartnerId').lean();
    
    console.log(`Found ${todayOrders.length} orders matching today's criteria:`);
    todayOrders.forEach(o => {
        console.log(`Order: ${o.orderId}, Status: ${o.status}, deliveredAt: ${o.deliveredAt}, updatedAt: ${o.updatedAt}, Partner: ${o.deliveryPartnerId}`);
    });
    
    process.exit(0);
}).catch(console.error);

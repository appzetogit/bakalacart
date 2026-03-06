import mongoose from 'mongoose';
import 'dotenv/config';
import Order from './modules/order/models/Order.js';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    // Also check orders
    const orders = await Order.find({ createdAt: { $gte: new Date('2026-02-25') }, status: 'delivered' }).select('orderId status createdAt deliveryPartnerId').lean();
    console.log(`Found ${orders.length} delivered orders on or after Feb 25`);
    let deliveredByPartner = 0;
    orders.forEach(o => {
      console.log(`Order ${o.orderId}, partner: ${o.deliveryPartnerId}, created at ${o.createdAt}`);
      if(o.deliveryPartnerId) deliveredByPartner++;
    });
    console.log(`Delivered by partner: ${deliveredByPartner}`);
    
    process.exit(0);
}).catch(console.error);

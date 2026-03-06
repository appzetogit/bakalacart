import mongoose from 'mongoose';
import 'dotenv/config';
import DeliveryWallet from './modules/delivery/models/DeliveryWallet.js';
import Order from './modules/order/models/Order.js';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const wallets = await DeliveryWallet.find().lean();
    let countAfter25 = 0;
    
    for (const w of wallets) {
        if(w.transactions) {
            for (const t of w.transactions) {
                const d = new Date(t.createdAt || t.processedAt);
                if (d >= new Date('2026-02-25')) {
                    countAfter25++;
                    console.log(`id: ${t._id}, type: ${t.type}, status: ${t.status}, createdAt: ${d}, orderId: ${t.orderId}`);
                }
            }
        }
    }
    console.log(`Found ${countAfter25} transactions on or after Feb 25`);
    
    // Also check orders
    const orders = await Order.find({ createdAt: { $gte: new Date('2026-02-25') } }).select('_id status createdAt').lean();
    console.log(`Found ${orders.length} orders on or after Feb 25`);
    orders.forEach(o => console.log(`Order ${o._id}, status ${o.status}, created at ${o.createdAt}`));
    
    process.exit(0);
}).catch(console.error);

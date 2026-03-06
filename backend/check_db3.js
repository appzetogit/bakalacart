import mongoose from 'mongoose';
import 'dotenv/config';
import DeliveryWallet from './modules/delivery/models/DeliveryWallet.js';
import Order from './modules/order/models/Order.js';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const wallets = await DeliveryWallet.find().lean();
    let orderIds = [];
    
    for (const w of wallets) {
        if(w.transactions) {
            for (const t of w.transactions) {
                const d = new Date(t.createdAt || t.processedAt);
                if (d >= new Date('2026-02-25') && t.type === 'payment' && t.status === 'Completed') {
                    orderIds.push(t.orderId);
                }
            }
        }
    }
    
    console.log(`Found ${orderIds.length} recent transactions`);
    
    // Check orders
    for (const oid of orderIds) {
        let order = null;
        if (mongoose.Types.ObjectId.isValid(oid)) {
            order = await Order.findById(oid).lean();
        } else {
            order = await Order.findOne({ orderId: oid }).lean();
        }
        console.log(`OrderId: ${oid}, Found: ${!!order}, Status: ${order ? order.status : 'N/A'}`);
    }
    
    process.exit(0);
}).catch(console.error);

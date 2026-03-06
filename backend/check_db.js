import mongoose from 'mongoose';
import 'dotenv/config';
import DeliveryWallet from './modules/delivery/models/DeliveryWallet.js';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const wallets = await DeliveryWallet.find().lean();
    let maxDate = new Date(0);
    let totalCount = 0;
    
    wallets.forEach(w => {
        if(w.transactions) {
            w.transactions.forEach(t => {
                totalCount++;
                const d = new Date(t.createdAt || t.processedAt);
                if (d > maxDate) maxDate = d;
            });
        }
    });
    console.log(`Total transactions: ${totalCount}`);
    console.log(`Max transaction date: ${maxDate}`);
    process.exit(0);
}).catch(console.error);

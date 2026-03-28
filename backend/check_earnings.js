import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

// Import models using relative paths
import Order from './modules/order/models/Order.js';
import DeliveryWallet from './modules/delivery/models/DeliveryWallet.js';
import Delivery from './modules/delivery/models/Delivery.js';

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const deliveries = await Delivery.find({}).select('_id').lean();
    const deliveryIds = deliveries.map(d => d._id);
    
    // Wallet earnings
    const wallets = await DeliveryWallet.find({ deliveryId: { $in: deliveryIds } }).lean();
    let walletTotal = 0;
    const processedOrderIds = new Set();
    
    for (const wallet of wallets) {
      const txns = (wallet.transactions || []).filter(t => t.type === 'payment' && t.status === 'Completed');
      for (const t of txns) {
        walletTotal += (t.amount || 0);
        if (t.orderId) processedOrderIds.add(t.orderId.toString());
      }
    }
    
    // Missing orders
    const missingOrders = await Order.find({
      deliveryPartnerId: { $in: deliveryIds },
      status: 'delivered',
      _id: { $nin: Array.from(processedOrderIds).filter(id => mongoose.Types.ObjectId.isValid(id)) }
    }).lean();
    
    let missingTotal = 0;
    for (const o of missingOrders) {
      missingTotal += (o.pricing?.deliveryFee || 0);
    }
    
    console.log('--- RESULTS ---');
    console.log('Wallet Total:', walletTotal);
    console.log('Missing Total:', missingTotal);
    console.log('Total:', walletTotal + missingTotal);
    console.log('Unique processed orders:', processedOrderIds.size);
    console.log('Missing orders count:', missingOrders.length);
    console.log('---------------');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

check();

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const orderSchema = new mongoose.Schema({}, { strict: false });
const Order = mongoose.model('Order', orderSchema);

async function checkOrder() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        // Find latest order 
        const orders = await Order.find().sort({ createdAt: -1 }).limit(10);
        for (const order of orders) {
            if (order.customerName && order.customerName.toLowerCase().includes('tanisha')) {
                console.log('--- Order ID ---');
                console.log(order.orderId);
                console.log('--- Customer Name ---');
                console.log(order.customerName);
                console.log('--- Order Address Data ---');
                console.log(JSON.stringify(order.address, null, 2));
            }
        }
    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

checkOrder();

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
        // Find latest orders 
        const orders = await Order.find().sort({ createdAt: -1 }).limit(20);
        console.log('--- DB ADDRESS CHECK ---');
        for (const order of orders) {
            console.log(`Order ID: ${order.orderId}`);
            console.log(`Customer: ${order.customerName || order.userId?.name}`);
            console.log(`deliveryAddressDetails: "${order.deliveryAddressDetails}"`);
            console.log(`address.formattedAddress: "${order.address?.formattedAddress}"`);
            console.log('-------------------------');
        }
    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

checkOrder();

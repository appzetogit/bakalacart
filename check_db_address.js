import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

const orderSchema = new mongoose.Schema({}, { strict: false });
const Order = mongoose.model('Order', orderSchema);

async function checkOrder() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const order = await Order.findOne({ orderId: 'ORD-351' });
        if (order) {
            console.log('--- Order Address Data ---');
            console.log(JSON.stringify(order.address, null, 2));
            console.log('--- Customer Name ---');
            console.log(order.customerName || 'N/A');
        } else {
            console.log('Order ORD-351 not found');
        }
    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

checkOrder();

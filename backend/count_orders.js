import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env'), override: true });

async function checkOrders() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
        const count = await Order.countDocuments({});
        console.log('Total Orders in DB:', count);
        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkOrders();

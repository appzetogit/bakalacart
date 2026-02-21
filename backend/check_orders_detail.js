import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const OrderSchema = new mongoose.Schema({}, { strict: false });
const Order = mongoose.model('Order', OrderSchema, 'orders');

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected');
    const orders = await Order.find().limit(5).lean();
    console.log(JSON.stringify(orders, null, 2));
    await mongoose.disconnect();
}

check();

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected');

    console.log('Models before import:', Object.keys(mongoose.models));

    const { getOrders } = await import('./modules/admin/controllers/orderController.js');

    console.log('Models after import:', Object.keys(mongoose.models));

    // Try to find an order using the model from mongoose.models
    if (mongoose.models.Order) {
        try {
            const count = await mongoose.models.Order.countDocuments();
            console.log('Count from mongoose.models.Order:', count);
        } catch (e) {
            console.error('Error with Order model:', e.message);
        }
    }

    await mongoose.disconnect();
}

test();

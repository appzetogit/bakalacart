import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function test() {
    try {
        // Explicitly connect before anything else
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Import models and controller AFTER connection
        const Admin = (await import('./modules/admin/models/Admin.js')).default;
        const { getOrders } = await import('./modules/admin/controllers/orderController.js');

        const admin = await Admin.findOne();
        if (!admin) {
            console.log('No admin found');
            return;
        }

        const req = {
            query: { page: 1, limit: 10 },
            admin: { id: admin._id.toString() }
        };

        const res = {
            status: (code) => {
                console.log('Response Status:', code);
                return res;
            },
            json: (data) => {
                console.log('Response Data:', JSON.stringify(data, null, 2));
            }
        };

        console.log('Running getOrders...');
        await getOrders(req, res);

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected');
    }
}

test();

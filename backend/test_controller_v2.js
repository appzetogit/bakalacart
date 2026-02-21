import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function test() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        // Import controller after connection
        const { getOrders } = await import('./modules/admin/controllers/orderController.js');

        const req = {
            query: { page: 1, limit: 1000 },
            admin: { id: 'superadmin', role: 'super_admin' }
        };

        const res = {
            status: (code) => {
                console.log('Response Status:', code);
                return res;
            },
            json: (data) => {
                console.log('Response JSON Success:', data.success);
                console.log('Order Count returned:', data.data?.orders?.length);
            }
        };

        console.log('Running getOrders...');
        const start = Date.now();
        await getOrders(req, res);
        console.log('Finished in', Date.now() - start, 'ms');

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected');
    }
}

test();

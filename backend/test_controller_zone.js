import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const { getOrders } = await import('./modules/admin/controllers/orderController.js');

        const req = {
            query: { page: 1, limit: 10, zone: 'Mumbra' },
            admin: { id: 'some-id' }
        };

        const res = {
            status: (code) => {
                console.log('Response Status:', code);
                return res;
            },
            json: (data) => {
                console.log('Response JSON:', JSON.stringify(data, null, 2));
            }
        };

        console.log('Running getOrders with zone=Mumbra...');
        await getOrders(req, res);

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected');
    }
}

test();

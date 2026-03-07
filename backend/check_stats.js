import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);

    const orderCount = await mongoose.connection.db.collection('orders').countDocuments();
    const userCount = await mongoose.connection.db.collection('users').countDocuments();
    const customerCount = await mongoose.connection.db.collection('users').countDocuments({ role: 'user' });
    const restaurantCount = await mongoose.connection.db.collection('restaurants').countDocuments();
    const deliveryCount = await mongoose.connection.db.collection('deliveries').countDocuments();
    const settlementCount = await mongoose.connection.db.collection('ordersettlements').countDocuments();
    const paymentCount = await mongoose.connection.db.collection('payments').countDocuments();

    console.log('Stats:');
    console.log('Orders:', orderCount);
    console.log('Total Users (all roles):', userCount);
    console.log('Customers (role: user):', customerCount);
    console.log('Restaurants:', restaurantCount);
    console.log('Deliveries:', deliveryCount);
    console.log('Settlements:', settlementCount);
    console.log('Payments:', paymentCount);

    await mongoose.disconnect();
}

check();

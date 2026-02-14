
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Delivery from './modules/delivery/models/Delivery.js';
import User from './modules/auth/models/User.js';
import Zone from './modules/admin/models/Zone.js';

dotenv.config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const checkCounts = async () => {
    await connectDB();

    try {
        const deliveryCount = await Delivery.countDocuments();
        const deliveryUserCount = await User.countDocuments({ role: 'delivery' });
        const allUserCount = await User.countDocuments();

        console.log('--- DB COUNTS ---');
        console.log(`Total Delivery Docs: ${deliveryCount}`);
        console.log(`Total User Docs: ${allUserCount}`);
        console.log(`User Docs with role='delivery': ${deliveryUserCount}`);

        // If there are delivery docs, let's look at one
        if (deliveryCount > 0) {
            const sample = await Delivery.findOne().select('name fcmTokens fcmTokenMobile availability');
            console.log('Sample Delivery:', JSON.stringify(sample, null, 2));
        }

        console.log('--- ZONES ---');
        const zones = await Zone.find({}).select('name');
        if (zones.length === 0) {
            console.log("No Zones found.");
        } else {
            zones.forEach(z => {
                console.log(`- "${z.name}"`);
            });
        }

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
};

checkCounts();

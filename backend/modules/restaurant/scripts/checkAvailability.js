
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { processRestaurantAvailability } from '../services/restaurantAvailabilityService.js';

// Load env vars
dotenv.config({ path: '../../.env' }); // Adjust relative path as script is deep in modules
// If that doesn't work, try absolute path or default if running from root
if (!process.env.MONGODB_URI) {
    dotenv.config(); // Fallback to default .env in cwd
}

// Connect to MongoDB
const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error('MONGODB_URI not found in env');
        await mongoose.connect(uri);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    }
};

const run = async () => {
    await connectDB();
    console.log('Checking restaurant availability...');
    const result = await processRestaurantAvailability();
    console.log('Result:', result);
    process.exit(0);
};

run();


import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { processAutoRejectOrders } from '../services/autoRejectService.js';

// Load env vars
dotenv.config({ path: '../../.env' });
if (!process.env.MONGODB_URI) dotenv.config();

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;
        await mongoose.connect(uri);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    }
};

const run = async () => {
    await connectDB();

    console.log("🚀 Running Dynamic Auto-Recovery Service...");
    try {
        const result = await processAutoRejectOrders();
        console.log("Result:", result);
    } catch (e) {
        console.error("Critical Error:", e);
    }

    process.exit(0);
};

run();

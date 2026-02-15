
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config();

// Manual cleanup for env vars (copied from server.js)
const requiredEnvVars = ['MONGODB_URI'];
requiredEnvVars.forEach(varName => {
    let value = process.env[varName];
    if (value && typeof value === 'string') {
        value = value.trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1).trim();
        }
    }
    if (value) {
        process.env[varName] = value;
    }
});

console.log('CWD:', process.cwd());
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Loaded' : 'Not Loaded');

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined');
        }
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const checkOrderUserIds = async () => {
    await connectDB();

    try {
        // Access the raw collection
        const ordersCollection = mongoose.connection.db.collection('orders');

        // Check for string vs objectId counts
        const stringIds = await ordersCollection.countDocuments({ userId: { $type: "string" } });
        const objectIds = await ordersCollection.countDocuments({ userId: { $type: "objectId" } });

        console.log(`Orders with String userId: ${stringIds}`);
        console.log(`Orders with ObjectId userId: ${objectIds}`);

        if (stringIds > 0) {
            console.log('WARNING: Found orders with String userId. This breaks aggregation with ObjectId matches.');
            // Get a sample
            const sample = await ordersCollection.findOne({ userId: { $type: "string" } });
            console.log('Sample order with string userId:', sample._id, sample.userId);
        }

        // Check pricing.total existence
        const missingPricing = await ordersCollection.countDocuments({ "pricing.total": { $exists: false } });
        console.log(`Orders missing pricing.total: ${missingPricing}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
        process.exit(0);
    }
};

checkOrderUserIds();

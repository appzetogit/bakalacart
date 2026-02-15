
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

const checkAggregation = async () => {
    await connectDB();

    try {
        const Order = mongoose.connection.collection('orders');
        const User = mongoose.connection.collection('users');

        // Get one user who has orders
        const order = await Order.findOne();
        if (!order) {
            console.log('No orders found at all.');
            return;
        }

        const userId = order.userId;
        console.log(`Checking stats for user: ${userId}`);

        // Check user exists
        const user = await User.findOne({ _id: userId });
        if (!user) {
            console.log('User not found for this order!');
        } else {
            console.log(`User found: ${user.name} (${user.email})`);
        }

        // Run aggregation same as in controller
        const userIds = [userId];

        const pipeline = [
            {
                $match: {
                    userId: { $in: userIds }
                }
            },
            {
                $group: {
                    _id: '$userId',
                    totalOrders: { $sum: 1 },
                    totalAmount: { $sum: '$pricing.total' }
                }
            }
        ];

        const results = await Order.aggregate(pipeline).toArray();
        console.log('Aggregation Results:', results);

        // Also perform simple find
        const matchingOrders = await Order.find({ userId: userId }).toArray();
        console.log(`Found ${matchingOrders.length} orders via find()`);
        let manualSum = 0;
        matchingOrders.forEach(o => {
            console.log(`Order ${o._id}: pricing.total = ${o.pricing?.total}`);
            manualSum += (o.pricing?.total || 0);
        });
        console.log(`Manual Sum: ${manualSum}`);


    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
        process.exit(0);
    }
};

checkAggregation();

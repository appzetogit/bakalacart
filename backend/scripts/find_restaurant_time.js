import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../config/database.js';
import Restaurant from '../modules/restaurant/models/Restaurant.js';
import OutletTimings from '../modules/restaurant/models/OutletTimings.js';

dotenv.config();

const findRestaurantTime = async () => {
    try {
        await connectDB();

        const restaurantName = "Sahil fine dine";
        // Case-insensitive search
        const restaurant = await Restaurant.findOne({
            name: { $regex: new RegExp(restaurantName, 'i') }
        });

        if (!restaurant) {
            console.log(`Restaurant '${restaurantName}' not found.`);
            process.exit(1);
        }

        console.log(`Found restaurant: ${restaurant.name}`);
        console.log(`Restaurant ID: ${restaurant._id}`);

        // Check main deliveryTimings
        if (restaurant.deliveryTimings) {
            console.log('\n--- Main Delivery Timings ---');
            console.log(`Opening Time: ${restaurant.deliveryTimings.openingTime}`);
            console.log(`Closing Time: ${restaurant.deliveryTimings.closingTime}`);
        } else {
            console.log('\nMain Delivery Timings: Not set');
        }

        // Check onboarding timings
        if (restaurant.onboarding && restaurant.onboarding.step2 && restaurant.onboarding.step2.deliveryTimings) {
            console.log('\n--- Onboarding Step 2 Timings ---');
            console.log(`Opening Time: ${restaurant.onboarding.step2.deliveryTimings.openingTime}`);
            console.log(`Closing Time: ${restaurant.onboarding.step2.deliveryTimings.closingTime}`);
        }

        // Check OutletTimings model if separate
        try {
            const timings = await OutletTimings.findOne({ restaurant: restaurant._id });
            if (timings) {
                console.log('\n--- OutletTimings Model ---');
                console.log(JSON.stringify(timings, null, 2));
            } else {
                console.log('\nNo separate OutletTimings found.');
            }
        } catch (err) {
            console.log("Error checking OutletTimings or model might not exist/be used this way.");
        }

        console.log(`\nIs Restaurant Open (Manual Override): ${restaurant.isRestaurantOpen}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

findRestaurantTime();

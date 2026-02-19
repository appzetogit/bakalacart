import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../config/database.js';
import Restaurant from '../modules/restaurant/models/Restaurant.js';

dotenv.config();

const checkRestaurants = async () => {
    try {
        await connectDB();

        const restaurants = await Restaurant.find({}).sort({ name: 1 });

        console.log('\n--- Restaurant Status Check ---');
        console.log('("Manual Override" column: true means "Automatic/Normal", false means "Forced Closed")');
        console.log('("Current Status" column: Determined by Time + Manual Flag)\n');
        console.log(String('Name').padEnd(30), String('Open/Close Times').padEnd(25), String('Manual Override (Enabled?)').padEnd(25), String('Current Status (isAcceptingOrders)'));
        console.log('-'.repeat(110));

        let autoCount = 0;
        let manualClosedCount = 0;

        restaurants.forEach(r => {
            const timings = r.deliveryTimings && r.deliveryTimings.openingTime ? `${r.deliveryTimings.openingTime} - ${r.deliveryTimings.closingTime}` : 'Not Set';
            const manualFlag = r.isRestaurantOpen; // true = Normal, false = Closed
            const currentStatus = r.isAcceptingOrders; // Logic handles this

            // If isRestaurantOpen is true, it is in "Automatic" mode (respecting time via checks)
            // If isRestaurantOpen is false, it is in "Manual Closed" mode.

            console.log(
                r.name.substring(0, 28).padEnd(30),
                timings.padEnd(25),
                String(manualFlag).padEnd(25),
                String(currentStatus)
            );

            if (manualFlag !== false) autoCount++;
            else manualClosedCount++;
        });

        console.log('\nSummary:');
        console.log(`Total Restaurants: ${restaurants.length}`);
        console.log(`Restaurants in Automatic Mode (Enabled): ${autoCount}`);
        console.log(`Restaurants Manually Closed: ${manualClosedCount}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkRestaurants();

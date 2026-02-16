
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Restaurant from '../models/Restaurant.js';

dotenv.config({ path: 'e:/bakalanew/bakalacart/backend/.env' });

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const restaurant = await Restaurant.findOne({ name: /Grocery & Daily Essential/i }).lean();

    if (restaurant) {
        console.log("=== RESTAURANT DETAILS ===");
        console.log("ID:", restaurant._id);
        console.log("Name:", restaurant.name);
        console.log("Location:", JSON.stringify(restaurant.location, null, 2));
    } else {
        console.log("Restaurant not found.");
    }
    process.exit(0);
};

run();

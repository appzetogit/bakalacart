
import mongoose from 'mongoose';
import User from './modules/auth/models/User.js';
import EnvironmentVariable from './modules/admin/models/EnvironmentVariable.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkDb() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const envVars = await EnvironmentVariable.findOne();
        if (envVars) {
            const publicVars = envVars.toEnvObject();
            console.log('Google Maps API Key:', publicVars.VITE_GOOGLE_MAPS_API_KEY ? 'SET' : 'NOT SET');
        } else {
            console.log('No environment variables found in DB');
        }

        const user = await User.findOne();
        if (user) {
            console.log('User found:', user.email);
            console.log('Addresses count:', user.addresses?.length || 0);
            user.addresses?.forEach(addr => {
                console.log(`- ${addr.label}: ${addr.street}, ${addr.city} (ID: ${addr._id})`);
            });
        } else {
            console.log('No user found');
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkDb();

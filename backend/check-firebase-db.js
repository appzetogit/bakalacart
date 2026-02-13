import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Direct import of the model
import EnvironmentVariable from './modules/admin/models/EnvironmentVariable.js';

async function checkFirebaseConfig() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected');

        const envVars = await EnvironmentVariable.getOrCreate();
        const envData = envVars.toEnvObject();

        console.log('--- Full Firebase Config in Database ---');
        console.log('FIREBASE_PROJECT_ID:', envData.FIREBASE_PROJECT_ID);
        console.log('FIREBASE_CLIENT_EMAIL:', envData.FIREBASE_CLIENT_EMAIL);
        console.log('FIREBASE_API_KEY:', envData.FIREBASE_API_KEY);
        console.log('FIREBASE_AUTH_DOMAIN:', envData.FIREBASE_AUTH_DOMAIN);
        console.log('FIREBASE_STORAGE_BUCKET:', envData.FIREBASE_STORAGE_BUCKET);
        console.log('FIREBASE_MESSAGING_SENDER_ID:', envData.FIREBASE_MESSAGING_SENDER_ID);
        console.log('FIREBASE_APP_ID:', envData.FIREBASE_APP_ID);
        console.log('MEASUREMENT_ID:', envData.MEASUREMENT_ID);
        console.log('FIREBASE_PRIVATE_KEY is set:', !!envData.FIREBASE_PRIVATE_KEY);

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkFirebaseConfig();

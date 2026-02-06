/**
 * Diagnostic script to check FCM notification setup
 * Run: node scripts/check-fcm-notifications.js
 */

import mongoose from 'mongoose';
import User from '../modules/auth/models/User.js';
import Restaurant from '../modules/restaurant/models/Restaurant.js';
import Delivery from '../modules/delivery/models/Delivery.js';
import admin from '../shared/services/firebaseAdmin.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkFCMSetup() {
    console.log('🔍 Checking FCM Notification Setup...\n');

    // 1. Check Firebase Admin initialization
    console.log('1️⃣ Checking Firebase Admin initialization...');
    try {
        const app = admin.app();
        console.log('✅ Firebase Admin is initialized');
        console.log('   Project ID:', app.options.projectId || 'N/A');
    } catch (error) {
        console.error('❌ Firebase Admin is NOT initialized');
        console.error('   Error:', error.message);
        console.error('   Please check if firebase-service-account.json exists in config folder');
        return;
    }

    // 2. Check database connection
    console.log('\n2️⃣ Checking database connection...');
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/bakalacart';
        await mongoose.connect(mongoUri);
        console.log('✅ Database connected');
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return;
    }

    // 3. Check FCM tokens in database
    console.log('\n3️⃣ Checking FCM tokens in database...');
    
    const userCount = await User.countDocuments({});
    const usersWithTokens = await User.countDocuments({
        $or: [
            { fcmTokens: { $exists: true, $ne: [] } },
            { fcmTokenMobile: { $exists: true, $ne: [] } }
        ]
    });
    
    const restaurantCount = await Restaurant.countDocuments({});
    const restaurantsWithTokens = await Restaurant.countDocuments({
        $or: [
            { fcmTokens: { $exists: true, $ne: [] } },
            { fcmTokenMobile: { $exists: true, $ne: [] } }
        ]
    });
    
    const deliveryCount = await Delivery.countDocuments({});
    const deliveriesWithTokens = await Delivery.countDocuments({
        $or: [
            { fcmTokens: { $exists: true, $ne: [] } },
            { fcmTokenMobile: { $exists: true, $ne: [] } }
        ]
    });

    console.log(`   Users: ${usersWithTokens}/${userCount} have FCM tokens`);
    console.log(`   Restaurants: ${restaurantsWithTokens}/${restaurantCount} have FCM tokens`);
    console.log(`   Delivery Partners: ${deliveriesWithTokens}/${deliveryCount} have FCM tokens`);

    // 4. Get sample tokens
    console.log('\n4️⃣ Sample FCM tokens:');
    const sampleUser = await User.findOne({
        $or: [
            { fcmTokens: { $exists: true, $ne: [] } },
            { fcmTokenMobile: { $exists: true, $ne: [] } }
        ]
    }).select('name email fcmTokens fcmTokenMobile');

    if (sampleUser) {
        console.log('   User:', sampleUser.name || sampleUser.email);
        console.log('   Web tokens:', sampleUser.fcmTokens?.length || 0);
        console.log('   Mobile tokens:', sampleUser.fcmTokenMobile?.length || 0);
        if (sampleUser.fcmTokens?.length > 0) {
            console.log('   Sample web token:', sampleUser.fcmTokens[0].substring(0, 30) + '...');
        }
        if (sampleUser.fcmTokenMobile?.length > 0) {
            console.log('   Sample mobile token:', sampleUser.fcmTokenMobile[0].substring(0, 30) + '...');
        }
    } else {
        console.log('   ⚠️ No users with FCM tokens found');
    }

    // 5. Test sending a notification (optional - commented out by default)
    console.log('\n5️⃣ Test notification (optional)');
    console.log('   To test, uncomment the test code in this script');
    
    // Uncomment below to test sending a notification
    /*
    if (sampleUser) {
        const testTokens = [
            ...(sampleUser.fcmTokens || []),
            ...(sampleUser.fcmTokenMobile || [])
        ].filter(Boolean);

        if (testTokens.length > 0) {
            console.log(`   Sending test notification to ${testTokens.length} token(s)...`);
            try {
                const { sendPushNotification } = await import('../shared/services/firebaseAdmin.js');
                const result = await sendPushNotification(testTokens.slice(0, 1), {
                    title: 'Test Notification',
                    body: 'This is a test notification from diagnostic script',
                    data: {
                        type: 'test',
                        icon: '/bakalalogo.png'
                    }
                });
                console.log('   Result:', result);
            } catch (error) {
                console.error('   Error:', error.message);
            }
        }
    }
    */

    // 6. Summary
    console.log('\n📊 Summary:');
    console.log('   ✅ Firebase Admin:', admin.app() ? 'Initialized' : 'Not initialized');
    console.log('   ✅ Database:', mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected');
    console.log('   ✅ Users with tokens:', usersWithTokens);
    console.log('   ✅ Restaurants with tokens:', restaurantsWithTokens);
    console.log('   ✅ Delivery partners with tokens:', deliveriesWithTokens);

    await mongoose.disconnect();
    console.log('\n✅ Diagnostic complete!');
}

checkFCMSetup().catch(console.error);

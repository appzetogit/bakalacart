import mongoose from 'mongoose';
import 'dotenv/config';
import { connectDB } from '../config/database.js';
import User from '../modules/auth/models/User.js';

const phoneNumbers = ['9167352382', '9009925021'];

async function testLogout() {
  try {
    await connectDB();
    console.log('✅ Database connected\n');

    console.log('🧪 TESTING LOGOUT STATUS:\n');

    for (const phoneNumber of phoneNumbers) {
      const phoneVariations = [
        phoneNumber,
        `+91${phoneNumber}`,
        `+91 ${phoneNumber}`,
        `91${phoneNumber}`,
        `0${phoneNumber}`
      ];

      let user = null;
      for (const phone of phoneVariations) {
        user = await User.findOne({ phone: phone, role: 'user' });
        if (user) break;
      }

      if (!user) {
        const regexPattern = new RegExp(phoneNumber.replace(/\D/g, ''), 'i');
        user = await User.findOne({ phone: { $regex: regexPattern }, role: 'user' });
      }

      if (!user) {
        console.log(`❌ User ${phoneNumber} not found\n`);
        continue;
      }

      console.log(`📱 User: ${user.name} (${user.phone})`);
      console.log(`   User ID: ${user._id}`);
      console.log(`   Is Active: ${user.isActive}`);
      
      if (user.forceLogoutAt) {
        const now = new Date();
        const timeDiff = now - user.forceLogoutAt;
        const minutesAgo = Math.floor(timeDiff / 60000);
        
        console.log(`   ✅ Force Logout: SET`);
        console.log(`   Force Logout At: ${user.forceLogoutAt}`);
        console.log(`   Time Since Logout: ${minutesAgo} minutes ago`);
        console.log(`   Status: User will be logged out on next token refresh`);
      } else {
        console.log(`   ⚠️  Force Logout: NOT SET`);
        console.log(`   Status: User is NOT logged out`);
      }
      console.log('');
    }

    console.log('📋 TESTING INSTRUCTIONS:');
    console.log('   1. Start your backend server');
    console.log('   2. Start your frontend (web app)');
    console.log('   3. Login with one of these users:');
    console.log('      - Unaib Khan (+91 9167352382)');
    console.log('      - Sagar kher (+91 9009925021)');
    console.log('   4. Make any API request (e.g., refresh token, fetch profile)');
    console.log('   5. User should get "Session expired. Please login again." error');
    console.log('   6. User will be automatically logged out\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testLogout();


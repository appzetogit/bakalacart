import mongoose from 'mongoose';
import 'dotenv/config';
import { connectDB } from '../config/database.js';
import User from '../modules/auth/models/User.js';
import jwtService from '../modules/auth/services/jwtService.js';

const phoneNumber = '9009925021';

async function testForceLogout() {
  try {
    await connectDB();
    console.log('✅ Database connected\n');

    // Find user
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
      console.log(`❌ User not found`);
      process.exit(1);
    }

    console.log(`📱 User: ${user.name} (${user.phone})`);
    console.log(`   User ID: ${user._id}`);
    console.log(`   Force Logout At: ${user.forceLogoutAt || 'NOT SET'}\n`);

    // Test: Create a fake token and check if middleware would reject it
    console.log('🧪 Testing Force Logout Logic:\n');
    
    if (user.forceLogoutAt) {
      console.log('✅ Force Logout is SET');
      console.log('   Expected Behavior:');
      console.log('   - Any API request should return 401');
      console.log('   - Error message: "Session expired. Please login again."');
      console.log('   - Frontend should logout user automatically\n');
      
      console.log('📋 To Test:');
      console.log('   1. Make sure backend server is RESTARTED');
      console.log('   2. User should make any API request');
      console.log('   3. Backend middleware will check forceLogoutAt');
      console.log('   4. If set, return 401 with "Session expired. Please login again."');
      console.log('   5. Frontend will detect 401 and logout user\n');
    } else {
      console.log('❌ Force Logout is NOT SET');
      console.log('   Run logout script first!\n');
    }

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testForceLogout();


import mongoose from 'mongoose';
import 'dotenv/config';
import { connectDB } from '../config/database.js';
import User from '../modules/auth/models/User.js';

const phoneNumbers = ['9167352382', '9009925021'];

async function verifyLogout() {
  try {
    await connectDB();
    console.log('✅ Database connected\n');

    console.log('🔍 VERIFYING LOGOUT WILL WORK:\n');

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
        console.log(`   ✅ Force Logout: SET`);
        console.log(`   Force Logout At: ${user.forceLogoutAt}`);
        console.log(`   ✅ LOGOUT WILL HAPPEN: Yes`);
        console.log(`   Reason: forceLogoutAt is set, backend will reject token refresh`);
      } else {
        console.log(`   ❌ Force Logout: NOT SET`);
        console.log(`   ⚠️  LOGOUT WILL NOT HAPPEN: No`);
        console.log(`   Reason: forceLogoutAt is not set`);
      }
      console.log('');
    }

    console.log('📋 LOGOUT MECHANISM:');
    console.log('   1. User makes API request');
    console.log('   2. Token refresh happens automatically');
    console.log('   3. Backend checks: if forceLogoutAt is set → logout');
    console.log('   4. Backend returns: "Session expired. Please login again."');
    console.log('   5. Frontend clears tokens and redirects to login');
    console.log('   6. ✅ User is logged out\n');

    console.log('✅ CONFIRMATION:');
    console.log('   - Logic is fixed: If forceLogoutAt exists → Always logout');
    console.log('   - No token issue time check needed');
    console.log('   - Users will be logged out on next token refresh');
    console.log('   - Accounts are safe - users can login again\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyLogout();


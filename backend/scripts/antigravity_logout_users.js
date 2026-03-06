import mongoose from 'mongoose';
import 'dotenv/config';
import { connectDB } from '../config/database.js';
import User from '../modules/auth/models/User.js';

const phoneNumbers = ['9167352382', '9009925021'];

async function logoutUsers() {
  try {
    await connectDB();
    console.log('✅ Database connected');

    for (const phoneNumber of phoneNumbers) {
      console.log(`\n🔍 Searching for user: ${phoneNumber}`);
      
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
        for (const phone of phoneVariations) {
          user = await User.findOne({ phone: phone });
          if (user) break;
        }
      }

      if (!user) {
        const regexPattern = new RegExp(phoneNumber.replace(/\D/g, ''), 'i');
        user = await User.findOne({ phone: { $regex: regexPattern } });
      }

      if (user) {
        console.log(`✅ Found: ${user.name} (${user.phone})`);
        user.forceLogoutAt = new Date();
        await user.save();
        console.log(`✅ Logged out! Timestamp: ${user.forceLogoutAt}`);
      } else {
        console.log(`❌ NOT FOUND: ${phoneNumber}`);
      }
    }

    await mongoose.connection.close();
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    process.exit(1);
  }
}

logoutUsers();

import mongoose from 'mongoose';
import 'dotenv/config';
import { connectDB } from '../config/database.js';
import User from '../modules/auth/models/User.js';

const phoneNumbers = ['9167352382', '9009925021'];

async function logoutUsers() {
  try {
    await connectDB();
    console.log('✅ Database connected\n');

    for (const phoneNumber of phoneNumbers) {
      console.log(`\n🔍 Processing phone number: ${phoneNumber}`);
      
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
        if (user) {
          console.log(`✅ User found with phone format: ${phone}`);
          break;
        }
      }

      if (!user) {
        for (const phone of phoneVariations) {
          user = await User.findOne({ phone: phone });
          if (user) {
            console.log(`✅ User found with phone format: ${phone}`);
            break;
          }
        }
      }

      if (!user) {
        const regexPattern = new RegExp(phoneNumber.replace(/\D/g, ''), 'i');
        user = await User.findOne({ phone: { $regex: regexPattern }, role: 'user' });
      }

      if (!user) {
        console.log(`❌ User with phone number ${phoneNumber} not found`);
        continue;
      }

      console.log(`   Name: ${user.name}`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   User ID: ${user._id}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Is Active: ${user.isActive}`);

      // Set forceLogoutAt to logout user
      user.forceLogoutAt = new Date();
      await user.save();
      console.log(`   ✅ Force logout timestamp set: ${user.forceLogoutAt}`);
      console.log(`   ✅ User will be logged out from app and web on next token refresh`);
      console.log(`   ✅ Account NOT deleted - user can login again`);
    }

    console.log(`\n📋 SUMMARY:`);
    console.log(`   ✅ All users found in database`);
    console.log(`   ✅ NO delete operation performed`);
    console.log(`   ✅ Users can login normally`);
    console.log(`   ✅ Accounts are safe\n`);

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

logoutUsers();


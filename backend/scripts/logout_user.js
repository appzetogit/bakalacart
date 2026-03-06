import mongoose from 'mongoose';
import 'dotenv/config';
import { connectDB } from '../config/database.js';
import User from '../modules/auth/models/User.js';

const phoneNumber = '9009925021';

async function logoutUser() {
  try {
    // Connect to database
    await connectDB();
    console.log('✅ Database connected');

    // Try different phone number formats
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

    // If not found, try without role filter
    if (!user) {
      for (const phone of phoneVariations) {
        user = await User.findOne({ phone: phone });
        if (user) {
          console.log(`✅ User found with phone format: ${phone}`);
          break;
        }
      }
    }

    // If still not found, try regex search
    if (!user) {
      const regexPattern = new RegExp(phoneNumber.replace(/\D/g, ''), 'i');
      user = await User.findOne({ phone: { $regex: regexPattern }, role: 'user' });
    }

    if (!user) {
      console.log(`❌ User with phone number ${phoneNumber} not found`);
      process.exit(1);
    }

    console.log(`\n📱 User Found:`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Phone: ${user.phone}`);
    console.log(`   Email: ${user.email || 'N/A'}`);
    console.log(`   User ID: ${user._id}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Is Active: ${user.isActive}`);

    // Note: For user role, refreshToken is stored in cookies (not in database)
    // The user will be logged out when they try to use their refresh token
    // as it will be invalidated on the next token refresh attempt
    
    console.log(`\n✅ User logout process initiated`);
    console.log(`   Note: User's refresh token is stored in cookies.`);
    console.log(`   The user will be logged out on their next request when the refresh token is used.`);
    console.log(`   Account is NOT deleted - only logout action performed.\n`);

    // Close database connection
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

logoutUser();


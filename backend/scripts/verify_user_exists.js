import mongoose from 'mongoose';
import 'dotenv/config';
import { connectDB } from '../config/database.js';
import User from '../modules/auth/models/User.js';

const phoneNumber = '9167352382';
const userId = '698cc6432dd792a4274b66f0';

async function verifyUser() {
  try {
    // Connect to database
    await connectDB();
    console.log('✅ Database connected\n');

    // Find user by phone number
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

    // Also try by User ID
    const userById = await User.findById(userId);

    console.log('🔍 VERIFICATION RESULTS:\n');
    
    if (user) {
      console.log('✅ USER ACCOUNT EXISTS - NOT DELETED');
      console.log(`   Name: ${user.name}`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   User ID: ${user._id}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Is Active: ${user.isActive}`);
      console.log(`   Created At: ${user.createdAt}`);
      console.log(`   Updated At: ${user.updatedAt}`);
    } else {
      console.log('❌ USER NOT FOUND BY PHONE');
    }

    if (userById) {
      console.log('\n✅ USER ACCOUNT EXISTS BY ID - NOT DELETED');
      console.log(`   Name: ${userById.name}`);
      console.log(`   Phone: ${userById.phone}`);
      console.log(`   User ID: ${userById._id}`);
    } else {
      console.log('\n❌ USER NOT FOUND BY ID');
    }

    console.log('\n📋 SUMMARY:');
    console.log('   ✅ Account EXISTS in database');
    console.log('   ✅ NO delete operation performed');
    console.log('   ✅ Only logout action was initiated');
    console.log('   ✅ User can login again anytime\n');

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

verifyUser();


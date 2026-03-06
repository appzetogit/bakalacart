import mongoose from 'mongoose';
import 'dotenv/config';
import { connectDB } from '../config/database.js';
import User from '../modules/auth/models/User.js';

const phoneNumber = '9167352382';

async function findUser() {
  try {
    // Connect to database
    await connectDB();
    console.log('✅ Database connected');

    // Try different phone number formats
    const phoneVariations = [
      phoneNumber,
      `+91${phoneNumber}`,
      `91${phoneNumber}`,
      `0${phoneNumber}`,
      `+91-${phoneNumber}`,
      `91-${phoneNumber}`
    ];

    console.log(`\n🔍 Searching for user with phone number: ${phoneNumber}`);
    console.log(`   Trying variations: ${phoneVariations.join(', ')}\n`);

    let userFound = false;

    for (const phone of phoneVariations) {
      const user = await User.findOne({ phone: phone, role: 'user' });
      if (user) {
        console.log(`✅ User Found with phone format: ${phone}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Phone: ${user.phone}`);
        console.log(`   Email: ${user.email || 'N/A'}`);
        console.log(`   User ID: ${user._id}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Is Active: ${user.isActive}`);
        userFound = true;
        break;
      }
    }

    if (!userFound) {
      // Search without role filter
      console.log('\n🔍 Searching without role filter...');
      for (const phone of phoneVariations) {
        const user = await User.findOne({ phone: phone });
        if (user) {
          console.log(`✅ User Found with phone format: ${phone}`);
          console.log(`   Name: ${user.name}`);
          console.log(`   Phone: ${user.phone}`);
          console.log(`   Email: ${user.email || 'N/A'}`);
          console.log(`   User ID: ${user._id}`);
          console.log(`   Role: ${user.role}`);
          console.log(`   Is Active: ${user.isActive}`);
          userFound = true;
          break;
        }
      }
    }

    if (!userFound) {
      // Search with regex
      console.log('\n🔍 Searching with regex pattern...');
      const regexPattern = new RegExp(phoneNumber.replace(/\D/g, ''), 'i');
      const users = await User.find({ phone: { $regex: regexPattern } });
      
      if (users.length > 0) {
        console.log(`✅ Found ${users.length} user(s) with matching phone pattern:`);
        users.forEach((user, index) => {
          console.log(`\n   User ${index + 1}:`);
          console.log(`   Name: ${user.name}`);
          console.log(`   Phone: ${user.phone}`);
          console.log(`   Email: ${user.email || 'N/A'}`);
          console.log(`   User ID: ${user._id}`);
          console.log(`   Role: ${user.role}`);
          console.log(`   Is Active: ${user.isActive}`);
        });
        userFound = true;
      }
    }

    if (!userFound) {
      console.log(`\n❌ User with phone number ${phoneNumber} not found in any format`);
    }

    // Close database connection
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

findUser();


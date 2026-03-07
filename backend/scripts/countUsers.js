import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import User from '../modules/auth/models/User.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const countUsers = async () => {
  try {
    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not set in environment variables');
      process.exit(1);
    }

    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000
    });
    console.log('✅ Connected to MongoDB');

    // Count total users
    const totalUsers = await User.countDocuments({});
    
    // Count users by role
    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Count verified vs unverified users
    const verifiedUsers = await User.countDocuments({ phoneVerified: true });
    const unverifiedUsers = await User.countDocuments({ phoneVerified: false });

    // Count by signup method
    const usersBySignupMethod = await User.aggregate([
      {
        $group: {
          _id: '$signupMethod',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Display results
    console.log('\n📊 ========== USER STATISTICS ==========\n');
    console.log(`👥 Total Users: ${totalUsers}\n`);
    
    console.log('📋 Users by Role:');
    usersByRole.forEach(item => {
      console.log(`   ${item._id || 'null'}: ${item.count}`);
    });
    
    console.log('\n✅ Verified Users:');
    console.log(`   Phone Verified: ${verifiedUsers}`);
    console.log(`   Phone Unverified: ${unverifiedUsers}`);
    
    console.log('\n🔐 Users by Signup Method:');
    usersBySignupMethod.forEach(item => {
      console.log(`   ${item._id || 'null'}: ${item.count}`);
    });
    
    console.log('\n✅ ======================================\n');

    // Close connection
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error counting users:', error);
    process.exit(1);
  }
};

countUsers();


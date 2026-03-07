import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/database.js';
import User from '../modules/auth/models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from backend directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function logoutAllCustomers() {
  try {
    // Show which database will be used BEFORE connecting
    const mongoUri = process.env.MONGODB_URI || 'NOT SET';
    const dbName = mongoUri.includes('mongodb.net') ? 'PRODUCTION/LIVE' : 
                   mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1') ? 'LOCAL' : 
                   'UNKNOWN';
    
    console.log('⚠️  DATABASE CONNECTION INFO:');
    console.log(`   Database Type: ${dbName}`);
    if (mongoUri !== 'NOT SET') {
      // Show database name from URI
      const dbMatch = mongoUri.match(/\/([^?]+)/);
      const dbNameFromUri = dbMatch ? dbMatch[1] : 'unknown';
      console.log(`   Database Name: ${dbNameFromUri}`);
      console.log(`   Connection: ${mongoUri.includes('mongodb.net') ? 'MongoDB Atlas (Cloud)' : 'Local MongoDB'}`);
    }
    console.log('');
    
    if (dbName === 'PRODUCTION/LIVE') {
      console.log('🚨 WARNING: You are about to logout users from PRODUCTION/LIVE database!');
      console.log('   This will affect ALL live users.');
    } else if (dbName === 'LOCAL') {
      console.log('ℹ️  INFO: You are connecting to LOCAL database.');
      console.log('   Only local users will be affected.');
    }
    console.log('');

    await connectDB();
    console.log('✅ Database connected\n');

    // Get total customers before logout
    const totalCustomers = await User.countDocuments({ role: 'user' });
    console.log(`📊 Total Customers: ${totalCustomers}\n`);

    if (totalCustomers === 0) {
      console.log('❌ No customers found to logout');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Confirm before proceeding
    console.log('⚠️  WARNING: This will logout ALL customers immediately!');
    console.log('   - All customers will be logged out on their next API request');
    console.log('   - They can login again normally after logout');
    console.log('   - Accounts are NOT deleted, only sessions will be invalidated\n');

    // Set forceLogoutAt for all customers
    const result = await User.updateMany(
      { role: 'user' },
      { $set: { forceLogoutAt: new Date() } }
    );

    console.log(`✅ Successfully set forceLogoutAt for ${result.modifiedCount} customers\n`);

    // Verify the update
    const usersWithForceLogout = await User.countDocuments({
      role: 'user',
      forceLogoutAt: { $exists: true, $ne: null }
    });

    console.log('📋 Verification:');
    console.log(`   - Users with forceLogoutAt set: ${usersWithForceLogout}`);
    console.log(`   - Expected: ${totalCustomers}\n`);

    if (usersWithForceLogout === totalCustomers) {
      console.log('✅ All customers will be logged out on next token refresh');
    } else {
      console.log('⚠️  Warning: Some users might not have forceLogoutAt set');
    }

    console.log('\n📝 What happens next:');
    console.log('   1. Customers will be logged out on their next API request');
    console.log('   2. When they try to refresh token, backend will reject it');
    console.log('   3. Frontend will clear tokens and redirect to login');
    console.log('   4. Customers can login again normally');
    console.log('   5. forceLogoutAt will be cleared automatically on successful login\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

logoutAllCustomers();


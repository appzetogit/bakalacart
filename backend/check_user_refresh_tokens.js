import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function checkUserRefreshTokens() {
    await mongoose.connect(process.env.MONGODB_URI);

    const User = mongoose.connection.db.collection('users');
    
    // Get total customers
    const totalCustomers = await User.countDocuments({ role: 'user' });
    
    // Check if User model has refreshToken field (it shouldn't for customers)
    // But let's check the actual documents
    const sampleUser = await User.findOne({ role: 'user' });
    
    console.log('\n=== User Refresh Token Analysis ===\n');
    console.log('Total Customers:', totalCustomers);
    console.log('\nNote: For customers (role: user), refresh tokens are NOT stored in database.');
    console.log('Refresh tokens are JWT tokens stored in HTTP-only cookies on the client side.');
    console.log('\nSample User Fields:', Object.keys(sampleUser || {}));
    
    if (sampleUser && sampleUser.refreshToken) {
        console.log('\n⚠️ WARNING: Found refreshToken field in user document!');
        const usersWithRefreshToken = await User.countDocuments({ 
            role: 'user', 
            refreshToken: { $exists: true, $ne: null } 
        });
        console.log('Users with refreshToken in DB:', usersWithRefreshToken);
    } else {
        console.log('\n✅ Confirmed: No refreshToken field in user documents (as expected)');
    }
    
    // Check for other session-related fields
    const usersWithForceLogout = await User.countDocuments({ 
        role: 'user',
        forceLogoutAt: { $exists: true, $ne: null } 
    });
    
    const activeUsers = await User.countDocuments({ 
        role: 'user',
        isActive: true 
    });
    
    const inactiveUsers = await User.countDocuments({ 
        role: 'user',
        isActive: false 
    });
    
    console.log('\n=== User Status ===');
    console.log('Active Users:', activeUsers);
    console.log('Inactive Users:', inactiveUsers);
    console.log('Users with forceLogoutAt set:', usersWithForceLogout);
    
    // Check last login activity (if available)
    const usersWithRecentActivity = await User.countDocuments({
        role: 'user',
        updatedAt: { 
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
    });
    
    console.log('\nUsers with activity in last 30 days:', usersWithRecentActivity);
    console.log('\n=== Summary ===');
    console.log('Refresh tokens for customers are JWT tokens in cookies, not in database.');
    console.log('To check active sessions, you would need to verify JWT tokens.');
    console.log('Users with recent activity might have active sessions.');
    
    await mongoose.disconnect();
}

checkUserRefreshTokens().catch(console.error);


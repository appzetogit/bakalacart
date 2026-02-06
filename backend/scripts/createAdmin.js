import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Models
import Admin from '../modules/admin/models/Admin.js';

// Setup environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
  }
};

const createAdmin = async () => {
  try {
    await connectDB();

    const adminData = {
      name: 'Ajay panchal',
      email: 'panchalajay717@gmail.com',
      password: 'Admin@123', // Default password, can be changed later
      role: 'super_admin',
      isActive: true,
      permissions: [
        'dashboard_view',
        'admin_manage',
        'restaurant_manage',
        'delivery_manage',
        'order_manage',
        'user_manage',
        'report_view',
        'settings_manage',
        'payment_manage',
        'campaign_manage'
      ]
    };

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: adminData.email.toLowerCase() });
    if (existingAdmin) {
      console.log('⚠️  Admin already exists with this email:', adminData.email);
      console.log('   Admin ID:', existingAdmin._id);
      console.log('   Name:', existingAdmin.name);
      console.log('   Role:', existingAdmin.role);
      await mongoose.connection.close();
      process.exit(0);
    }

    // Create new admin
    const admin = await Admin.create(adminData);

    console.log('\n✅ Admin created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', admin.email);
    console.log('👤 Name:', admin.name);
    console.log('🔑 Password: Admin@123 (please change after first login)');
    console.log('🎭 Role:', admin.role);
    console.log('🆔 Admin ID:', admin._id);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 Note: OTP 110211 is set as default for this email');
    console.log('   You can use this OTP for signup/verification\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    if (error.code === 11000) {
      console.error('   Admin with this email already exists');
    }
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
createAdmin();

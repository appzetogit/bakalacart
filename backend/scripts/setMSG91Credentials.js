import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Models
import EnvironmentVariable from '../modules/admin/models/EnvironmentVariable.js';

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

const setMSG91Credentials = async () => {
  try {
    await connectDB();

    // MSG91 Credentials
    const msg91Credentials = {
      MSG91_AUTH_KEY: '472430AdiQcZH1OX68e4db1aP1',
      MSG91_SENDER_ID: 'BAKCRT',
      MSG91_DLT_TE_ID: '1007318303408420217'
    };

    // Get or create environment variables document
    const envVars = await EnvironmentVariable.getOrCreate();

    // Update MSG91 credentials
    envVars.MSG91_AUTH_KEY = msg91Credentials.MSG91_AUTH_KEY;
    envVars.MSG91_SENDER_ID = msg91Credentials.MSG91_SENDER_ID;
    envVars.MSG91_DLT_TE_ID = msg91Credentials.MSG91_DLT_TE_ID;

    // Mark fields as modified to trigger encryption
    envVars.markModified('MSG91_AUTH_KEY');
    envVars.markModified('MSG91_SENDER_ID');
    envVars.markModified('MSG91_DLT_TE_ID');

    // Save the document (encryption will happen in pre-save hook)
    await envVars.save();

    console.log('\n✅ MSG91 Credentials configured successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔑 Auth Key:', msg91Credentials.MSG91_AUTH_KEY);
    console.log('📱 Sender ID:', msg91Credentials.MSG91_SENDER_ID);
    console.log('📄 Template ID:', msg91Credentials.MSG91_DLT_TE_ID);
    console.log('💬 Message Template: Bakalaa: ##OTP## is your login OTP. Use this OTP to login to your Bakalaa account. Thank you.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 Note: Credentials have been encrypted and saved to the database.');
    console.log('   The error "MSG91 credentials not configured" should now be resolved.\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting MSG91 credentials:', error.message);
    console.error('   Stack:', error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
setMSG91Credentials();

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    const admins = await mongoose.connection.db.collection('admins').find().toArray();
    console.log('Admins:', JSON.stringify(admins, null, 2));
    await mongoose.disconnect();
}

check();

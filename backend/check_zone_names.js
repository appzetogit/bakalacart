import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    const zones = await mongoose.connection.db.collection('zones').find().toArray();
    zones.forEach(z => console.log(z.name));
    await mongoose.disconnect();
}

check();

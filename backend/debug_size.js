import mongoose from 'mongoose';
import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
import dotenv from 'dotenv';
import Menu from './modules/restaurant/models/Menu.js';

dotenv.config();

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    console.time('count');
    const count = await Menu.countDocuments();
    console.timeEnd('count');
    console.log(`Total Menus: ${count}`);

    console.time('fetch_header');
    const firstMenu = await Menu.findOne({}, { _id: 1, restaurant: 1 }).lean();
    console.timeEnd('fetch_header');
    console.log(`First Menu ID: ${firstMenu?._id}`);

    // Let's see how big a full menu is
    console.time('fetch_full');
    const fullMenu = await Menu.findOne().lean();
    console.timeEnd('fetch_full');
    console.log(`Full Menu Size (chars): ${JSON.stringify(fullMenu).length}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

check();

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

    const sampleMenu = await Menu.findOne({ isActive: true }).lean();
    if (sampleMenu) {
        console.log('Sample Menu found:', sampleMenu._id);
        console.log('Has sections:', !!sampleMenu.sections);
        if (sampleMenu.sections && sampleMenu.sections.length > 0) {
            const section = sampleMenu.sections[0];
            console.log('Sample section:', section.name);
            console.log('Items count:', section.items?.length || 0);
            if (section.items && section.items.length > 0) {
                console.log('Sample item:', JSON.stringify(section.items[0], null, 2));
            }
        }
    } else {
        console.log('No active menus found');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error during check:', error);
    process.exit(1);
  }
}

check();

import mongoose from 'mongoose';
import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
import dotenv from 'dotenv';
import Menu from './modules/restaurant/models/Menu.js';
import Restaurant from './modules/restaurant/models/Restaurant.js';

dotenv.config();

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const menus = await Menu.find({ isActive: true })
      .populate('restaurant', 'name restaurantId')
      .lean();

    console.log(`Found ${menus.length} active menus`);

    const pendingRequests = [];
    for (const menu of menus) {
      if (!menu.restaurant) {
        console.log(`Menu ${menu._id} has no restaurant populated`);
        continue;
      }

      for (const section of menu.sections || []) {
        if (!section.items) continue;
        for (const item of section.items) {
          if (!item) {
            console.log(`Found null item in menu ${menu._id}, section ${section.id}`);
            continue;
          }
          if (item.approvalStatus === 'pending') {
            pendingRequests.push(item.name);
          }
        }
        
        if (section.subsections) {
            for (const subsection of section.subsections) {
                if (!subsection.items) continue;
                for (const item of subsection.items) {
                    if (!item) continue;
                    if (item.approvalStatus === 'pending') {
                        pendingRequests.push(item.name);
                    }
                }
            }
        }
      }

      if (menu.addons) {
        for (const addon of menu.addons) {
          if (!addon) continue;
          if (addon.approvalStatus === 'pending') {
            pendingRequests.push(addon.name);
          }
        }
      }
    }

    console.log(`Total pending requests: ${pendingRequests.length}`);
    console.log('Sample names:', pendingRequests.slice(0, 5));

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error during check:', error);
    process.exit(1);
  }
}

check();

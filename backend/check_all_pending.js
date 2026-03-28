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

    // Find ALL menus (even inactive ones)
    const menus = await Menu.find({})
      .populate('restaurant', 'name restaurantId')
      .lean();

    console.log(`Found total ${menus.length} menus in DB`);

    let pendingCount = 0;
    const details = [];

    for (const menu of menus) {
      // Check items in sections
      for (const section of menu.sections || []) {
        for (const item of section.items || []) {
          if (item.approvalStatus === 'pending') {
            pendingCount++;
            details.push({ type: 'item', name: item.name, menuId: menu._id, restaurant: menu.restaurant?.name, isActive: menu.isActive });
          }
        }
        for (const subsection of section.subsections || []) {
          for (const item of subsection.items || []) {
            if (item.approvalStatus === 'pending') {
              pendingCount++;
              details.push({ type: 'subsection_item', name: item.name, menuId: menu._id, restaurant: menu.restaurant?.name, isActive: menu.isActive });
            }
          }
        }
      }

      // Check add-ons
      for (const addon of menu.addons || []) {
        if (addon.approvalStatus === 'pending') {
          pendingCount++;
          details.push({ type: 'addon', name: addon.name, menuId: menu._id, restaurant: menu.restaurant?.name, isActive: menu.isActive });
        }
      }
    }

    console.log(`Total pending items found in DB across ALL menus: ${pendingCount}`);
    if (details.length > 0) {
        console.log('Sample pending items:', JSON.stringify(details.slice(0, 5), null, 2));
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error during check:', error);
    process.exit(1);
  }
}

check();

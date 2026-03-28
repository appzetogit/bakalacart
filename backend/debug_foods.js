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

    const pipeline = [
      {
        $lookup: {
          from: 'restaurants',
          localField: 'restaurant',
          foreignField: '_id',
          as: 'restaurantInfo'
        }
      },
      { $unwind: { path: "$restaurantInfo", preserveNullAndEmptyArrays: true } },
      {
        $facet: {
          directItems: [
            { $unwind: "$sections" },
            { $unwind: "$sections.items" },
            {
              $project: {
                _id: "$sections.items._id",
                id: { $ifNull: ["$sections.items.id", "$sections.items._id"] },
                name: "$sections.items.name",
                price: "$sections.items.price",
                restaurantName: "$restaurantInfo.name"
              }
            }
          ],
          subsectionItems: [
            { $unwind: "$sections" },
            { $unwind: "$sections.subsections" },
            { $unwind: "$sections.subsections.items" },
            {
              $project: {
                _id: "$sections.subsections.items._id",
                id: { $ifNull: ["$sections.subsections.items.id", "$sections.subsections.items._id"] },
                name: "$sections.subsections.items.name",
                price: "$sections.subsections.items.price",
                restaurantName: "$restaurantInfo.name"
              }
            }
          ]
        }
      },
      {
        $project: {
          all: { $concatArrays: ["$directItems", "$subsectionItems"] }
        }
      },
      { $unwind: "$all" },
      { $replaceRoot: { newRoot: "$all" } },
    ];

    console.time('aggregation');
    const results = await Menu.aggregate(pipeline);
    console.timeEnd('aggregation');
    console.log(`Aggregation found ${results.length} food items`);
    if (results.length > 0) {
        console.log('Sample result:', JSON.stringify(results[0], null, 2));
    } else {
        console.log('No food items found with aggregation.');
        // Count menus
        const menuCount = await Menu.countDocuments();
        console.log(`Total Menu documents: ${menuCount}`);
        const firstMenu = await Menu.findOne();
        if (firstMenu) {
            console.log('First menu sections count:', firstMenu.sections?.length);
            if (firstMenu.sections?.[0]) {
                console.log('First section items count:', firstMenu.sections[0].items?.length);
            }
        }
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error during aggregate check:', error);
    process.exit(1);
  }
}

check();

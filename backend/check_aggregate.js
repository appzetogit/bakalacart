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

    const pipeline = [
      {
        $project: {
          restaurant: 1,
          sections: 1,
          addons: 1,
          createdAt: 1
        }
      },
      {
        $unwind: { path: '$sections', preserveNullAndEmptyArrays: true }
      },
      {
        $facet: {
          itemsFromSections: [
            { $unwind: '$sections.items' },
            { $match: { 'sections.items.approvalStatus': 'pending' } },
            {
              $project: {
                _id: '$sections.items.id',
                id: '$sections.items.id',
                itemName: '$sections.items.name',
                category: '$sections.items.category',
                sectionName: '$sections.name',
                sectionId: '$sections.id',
                price: '$sections.items.price',
                foodType: '$sections.items.foodType',
                description: '$sections.items.description',
                image: { $ifNull: [ '$sections.items.image', { $arrayElemAt: ['$sections.items.images', 0] } ] },
                requestedAt: { $ifNull: [ '$sections.items.requestedAt', '$createdAt' ] },
                restaurantId: '$restaurant',
                item: '$sections.items'
              }
            }
          ],
          itemsFromSubsections: [
            { $unwind: '$sections.subsections' },
            { $unwind: '$sections.subsections.items' },
            { $match: { 'sections.subsections.items.approvalStatus': 'pending' } },
            {
              $project: {
                _id: '$sections.subsections.items.id',
                id: '$sections.subsections.items.id',
                itemName: '$sections.subsections.items.name',
                category: '$sections.subsections.items.category',
                sectionName: '$sections.name',
                sectionId: '$sections.id',
                subsectionName: '$sections.subsections.name',
                subsectionId: '$sections.subsections.id',
                price: '$sections.subsections.items.price',
                foodType: '$sections.subsections.items.foodType',
                description: '$sections.subsections.items.description',
                image: { $ifNull: [ '$sections.subsections.items.image', { $arrayElemAt: ['$sections.subsections.items.images', 0] } ] },
                requestedAt: { $ifNull: [ '$sections.subsections.items.requestedAt', '$createdAt' ] },
                restaurantId: '$restaurant',
                item: '$sections.subsections.items'
              }
            }
          ],
          addons: [
            { $unwind: '$addons' },
            { $match: { 'addons.approvalStatus': 'pending' } },
            {
              $project: {
                _id: '$addons.id',
                id: '$addons.id',
                itemName: '$addons.name',
                category: { $literal: 'Add-on' },
                type: { $literal: 'addon' },
                price: '$addons.price',
                description: '$addons.description',
                image: { $ifNull: [ '$addons.image', { $arrayElemAt: ['$addons.images', 0] } ] },
                requestedAt: { $ifNull: [ '$addons.requestedAt', '$createdAt' ] },
                restaurantId: '$restaurant',
                item: '$addons'
              }
            }
          ]
        }
      },
      {
        $project: {
          all: { $concatArrays: ['$itemsFromSections', '$itemsFromSubsections', '$addons'] }
        }
      },
      { $unwind: '$all' },
      { $replaceRoot: { newRoot: '$all' } }
    ];

    const results = await Menu.aggregate(pipeline);
    console.log(`Aggregation found ${results.length} pending items`);
    if (results.length > 0) {
        console.log('Sample result:', JSON.stringify(results[0], null, 2));
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error during aggregate check:', error);
    process.exit(1);
  }
}

check();

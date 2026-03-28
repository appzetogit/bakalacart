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
        $project: {
          restaurant: 1,
          items: {
            $concatArrays: [
              {
                $reduce: {
                  input: { $ifNull: ["$sections", []] },
                  initialValue: [],
                  in: { 
                    $concatArrays: [
                      "$$value", 
                      {
                        $map: {
                          input: { $ifNull: ["$$this.items", []] },
                          as: "item",
                          in: {
                            $mergeObjects: ["$$item", { sectionName: "$$this.name", categoryId: "$$this.id" }]
                          }
                        }
                      }
                    ]
                  }
                }
              },
              {
                $reduce: {
                  input: { $ifNull: ["$sections", []] },
                  initialValue: [],
                  in: {
                    $concatArrays: [
                      "$$value",
                      {
                        $reduce: {
                          input: { $ifNull: ["$$this.subsections", []] },
                          initialValue: [],
                          in: {
                            $concatArrays: [
                              "$$value",
                              {
                                $map: {
                                  input: { $ifNull: ["$$this.items", []] },
                                  as: "item",
                                  in: {
                                    $mergeObjects: ["$$item", { sectionName: "$$this.name", categoryId: "$$this.id", subsectionName: "$$this.name" }]
                                  }
                                }
                              }
                            ]
                          }
                        }
                      }
                    ]
                  }
                }
              }
            ]
          }
        }
      },
      { $unwind: "$items" },
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
        $project: {
          _id: "$items._id",
          id: { $ifNull: ["$items.id", "$items._id"] },
          name: "$items.name",
          price: "$items.price",
          restaurantId: "$restaurant",
          restaurantName: "$restaurantInfo.name",
          sectionName: "$items.sectionName",
          subsectionName: "$items.subsectionName",
          categoryId: "$items.categoryId"
        }
      }
    ];

    console.time('aggregation_optimized');
    const results = await Menu.aggregate(pipeline);
    console.timeEnd('aggregation_optimized');
    console.log(`Aggregation found ${results.length} food items`);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error during aggregate check:', error);
    process.exit(1);
  }
}

check();

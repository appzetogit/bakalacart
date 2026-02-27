import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkDescriptions() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB\n');
        const db = mongoose.connection.db;

        // menus collection uses "restaurant" field (not restaurantId)
        const restaurants = await db.collection('restaurants').find(
            { isActive: true },
            { projection: { name: 1, _id: 1 } }
        ).toArray();

        console.log(`Total active restaurants: ${restaurants.length}\n`);
        console.log('='.repeat(60));

        const withDesc = [];
        const withoutDesc = [];

        for (const restaurant of restaurants) {
            const menu = await db.collection('menus').findOne({ restaurant: restaurant._id });

            let itemsWithDesc = 0;
            let totalItems = 0;

            if (menu && menu.sections) {
                for (const section of menu.sections) {
                    const items = section.items || [];
                    const subItems = (section.subsections || []).flatMap(s => s.items || []);
                    const allItems = [...items, ...subItems];
                    totalItems += allItems.length;
                    itemsWithDesc += allItems.filter(item =>
                        item.description && item.description.trim() !== ''
                    ).length;
                }
            }

            if (itemsWithDesc > 0) {
                withDesc.push({ name: restaurant.name, itemsWithDesc, totalItems });
            } else {
                withoutDesc.push({ name: restaurant.name, totalItems });
            }
        }

        // Sort
        withDesc.sort((a, b) => b.itemsWithDesc - a.itemsWithDesc);

        console.log('✅ Restaurants WITH descriptions:');
        console.log('-'.repeat(60));
        if (withDesc.length === 0) {
            console.log('  None found');
        } else {
            withDesc.forEach(r => {
                console.log(`  ✅ ${r.name}`);
                console.log(`     → ${r.itemsWithDesc} of ${r.totalItems} items have description`);
            });
        }

        console.log('\n❌ Restaurants WITHOUT descriptions:');
        console.log('-'.repeat(60));
        withoutDesc.forEach(r => {
            console.log(`  ❌ ${r.name} (${r.totalItems} items)`);
        });

        console.log('\n' + '='.repeat(60));
        console.log(`\nSUMMARY:`);
        console.log(`  ✅ ${withDesc.length} restaurants have descriptions`);
        console.log(`  ❌ ${withoutDesc.length} restaurants have NO descriptions`);

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

checkDescriptions();

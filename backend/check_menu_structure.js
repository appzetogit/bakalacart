import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkMenuStructure() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB\n');
        const db = mongoose.connection.db;

        // Step 1: List all collections
        const collections = await db.listCollections().toArray();
        console.log('All Collections:', collections.map(c => c.name).join(', '));
        console.log('');

        // Step 2: Find Mirch N Lime restaurant
        const mirchR = await db.collection('restaurants').findOne({ name: /mirch/i });
        console.log('Mirch restaurant:', mirchR ? `${mirchR.name} (ID: ${mirchR._id})` : 'Not found');

        if (mirchR) {
            // Step 3: Check all menu-related collections
            const menuCollections = collections.filter(c =>
                c.name.toLowerCase().includes('menu') ||
                c.name.toLowerCase().includes('item') ||
                c.name.toLowerCase().includes('food')
            );
            console.log('\nMenu-related collections:', menuCollections.map(c => c.name));

            for (const col of menuCollections) {
                const count = await db.collection(col.name).countDocuments({ restaurantId: mirchR._id });
                const countStr = await db.collection(col.name).countDocuments({ restaurant: mirchR._id });
                const countSlug = await db.collection(col.name).countDocuments({ restaurantSlug: mirchR.slug });
                console.log(`  ${col.name}: restaurantId match=${count}, restaurant match=${countStr}, slug match=${countSlug}`);
            }

            // Step 4: Also check if restaurant doc itself has menu/items
            const restaurantDoc = await db.collection('restaurants').findOne({ _id: mirchR._id });
            console.log('\nRestaurant doc fields:', Object.keys(restaurantDoc || {}).join(', '));
            if (restaurantDoc?.menu) {
                console.log('Has menu field in restaurant doc!');
                console.log('Sections:', restaurantDoc.menu?.sections?.length || 0);
                const firstSection = restaurantDoc.menu?.sections?.[0];
                if (firstSection) {
                    const firstItem = firstSection.items?.[0];
                    console.log('First item sample:', JSON.stringify({
                        name: firstItem?.name,
                        description: firstItem?.description
                    }, null, 2));
                }
            }
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

checkMenuStructure();

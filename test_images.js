import mongoose from 'mongoose';
import Restaurant from './backend/modules/restaurant/models/Restaurant.js';

mongoose.connect('mongodb+srv://bakalaaupdate:bakala123@cluster0.ptajoze.mongodb.net/bakala')
    .then(async () => {
        const r = await Restaurant.findOne({ name: /Imran/i });
        if (r) {
            console.log('Imrans Kitchen:');
            console.log('coverImages:', r.coverImages);
            console.log('menuImages:', r.menuImages);
            console.log('profileImage:', r.profileImage);
        } else {
            console.log('Not found');
        }

        // Also check a category
        const Category = (await import('./backend/modules/restaurant/models/RestaurantCategory.js')).default;
        const cat = await Category.findOne({});
        console.log('Category:', cat?.name, cat?.image);

        process.exit();
    })
    .catch(console.error);

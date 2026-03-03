import mongoose from 'mongoose';
import Restaurant from './modules/restaurant/models/Restaurant.js';
import Category from './modules/restaurant/models/RestaurantCategory.js';

mongoose.connect('mongodb+srv://bakalaaupdate:bakala123@cluster0.ptajoze.mongodb.net/bakala')
    .then(async () => {
        try {
            const rest = await Restaurant.findOne({ name: /Imran/i });
            console.log('Imrans Kitchen:');
            console.log('coverImages:', JSON.stringify(rest?.coverImages));
            console.log('menuImages:', JSON.stringify(rest?.menuImages));
            console.log('profileImage:', JSON.stringify(rest?.profileImage));
            console.log('image:', rest?.image);

            const cat = await Category.findOne({});
            console.log('\nCategory:');
            console.log('name:', cat?.name);
            console.log('image:', cat?.image);
            console.log('imageUrl:', cat?.imageUrl);
        } catch (e) {
            console.error(e);
        } finally {
            process.exit();
        }
    })
    .catch(console.error);

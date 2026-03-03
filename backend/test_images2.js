import mongoose from 'mongoose';
import Category from './modules/restaurant/models/RestaurantCategory.js';
import Menu from './modules/restaurant/models/Menu.js';

mongoose.connect('mongodb+srv://bakalaaupdate:bakala123@cluster0.ptajoze.mongodb.net/bakala')
    .then(async () => {
        try {
            const cat = await Category.findOne({ name: /Momos/i });
            console.log('Category Momos:', cat);

            const item = await Menu.findOne({ "sections.items.name": /Chicken Tikka/i });
            if (item) {
                const i = item.sections.flatMap(s => s.items).find(x => x.name.includes("Chicken Tikka"));
                console.log('Item Chicken Tikka:', i.name, i.image, i.imageUrl);
            }
        } catch (e) {
            console.error(e);
        } finally {
            process.exit();
        }
    })
    
.catch(console.error);

import mongoose from 'mongoose';
import AdminCategoryManagement from './modules/admin/models/AdminCategoryManagement.js';

mongoose.connect('mongodb+srv://bakalaaupdate:bakala123@cluster0.ptajoze.mongodb.net/bakala')
    .then(async () => {
        try {
            const cats = await AdminCategoryManagement.find({}).limit(10);
            for (let cat of cats) {
                console.log(cat.name, cat.image);
            }
        } catch (e) {
            console.error(e);
        } finally {
            process.exit();
        }
    })
    .catch(console.error);

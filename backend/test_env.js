import mongoose from 'mongoose';
import EnvironmentVariable from './modules/admin/models/EnvironmentVariable.js';

mongoose.connect('mongodb+srv://bakalaaupdate:bakala123@cluster0.ptajoze.mongodb.net/bakala')
    .then(async () => {
        try {
            const doc = await EnvironmentVariable.getOrCreate();
            const envObj = doc.toEnvObject();
            console.log('CLOUDINARY_CLOUD_NAME:', envObj.CLOUDINARY_CLOUD_NAME);
            console.log('CLOUDINARY_API_KEY:', envObj.CLOUDINARY_API_KEY);
            console.log('CLOUDINARY_API_SECRET set?', !!envObj.CLOUDINARY_API_SECRET);
        } catch (e) {
            console.error(e);
        } finally {
            process.exit();
        }
    })
    .catch(console.error);

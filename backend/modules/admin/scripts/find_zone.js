
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Zone from '../models/Zone.js';

dotenv.config({ path: 'e:/bakalanew/bakalacart/backend/.env' });

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    // Coordinates from Grocery & Daily Essential
    const lat = 19.1624208;
    const lng = 73.0315458;

    const zones = await Zone.find({ isActive: true }).lean();
    console.log(`Checking ${zones.length} zones...`);

    let matchedZone = null;
    for (const zone of zones) {
        // We can't easily use the method since we didn't instantiate the model, 
        // let's use the DB query or manual check
        const coords = zone.boundary?.coordinates[0];
        if (!coords) continue;

        let inside = false;
        for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
            const xi = coords[i][0], yi = coords[i][1];
            const xj = coords[j][0], yj = coords[j][1];

            // Note: coordinates are [lng, lat]
            // xi, xj are longitudes
            // yi, yj are latitudes
            const intersect = ((yi > lat) !== (yj > lat)) &&
                (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);

            if (intersect) inside = !inside;
        }

        if (inside) {
            matchedZone = zone;
            console.log(`Matched Zone: ${zone.name} (${zone._id})`);
            break;
        }
    }

    if (!matchedZone) {
        console.log("No zone matched these coordinates.");
    }
    process.exit(0);
};

run();

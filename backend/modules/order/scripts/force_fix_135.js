
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: 'e:/bakalanew/bakalacart/backend/.env' });

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const targetOrderId = 'ORD-1771241035689-70';
    const now = new Date();

    console.log("Forcing update for order 135...");

    const result = await mongoose.connection.db.collection('orders').updateOne(
        { orderId: targetOrderId },
        {
            $set: {
                status: 'confirmed',
                'payment.status': 'completed',
                cancellationReason: '',
                cancelledBy: null,
                cancelledAt: null,
                createdAt: now,
                updatedAt: now,
                assignmentInfo: {
                    zoneId: new mongoose.Types.ObjectId('6990670787828d02f45af09f'),
                    zoneName: 'Mumbra',
                    pincode: '400612'
                },
                note: 'Fixed for Order Assign list v2'
            }
        }
    );

    console.log("Update result:", result);

    const updated = await mongoose.connection.db.collection('orders').findOne({ orderId: targetOrderId });
    console.log("New createdAt:", updated.createdAt);
    console.log("New Status:", updated.status);
    console.log("New Zone:", updated.assignmentInfo?.zoneName);

    process.exit(0);
};

run();

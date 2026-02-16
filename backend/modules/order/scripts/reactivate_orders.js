
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order.js';

dotenv.config({ path: 'e:/bakalanew/bakalacart/backend/.env' });

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    // Orders to fix
    const orderIds = ['ORD-1771241035689-70', 'ORD-1771244970343-325'];
    const now = new Date();

    for (const orderId of orderIds) {
        console.log(`Fixing order ${orderId}...`);

        const result = await mongoose.connection.db.collection('orders').updateOne(
            { orderId: orderId },
            {
                $set: {
                    status: 'confirmed',
                    'payment.status': 'pending', // Keep pending for COD, but confirmed for order
                    cancellationReason: '',
                    cancelledBy: null,
                    cancelledAt: null,
                    createdAt: now,
                    updatedAt: now,
                    assignmentInfo: {
                        zoneId: new mongoose.Types.ObjectId('6990670787828d02f45af09f'),
                        zoneName: 'Mumbra',
                        pincode: '400612',
                        assignedBy: 'zone_match',
                        assignedAt: now
                    },
                    note: 'System: Reactivated and Zone Added'
                }
            }
        );
        console.log(`Result for ${orderId}:`, result);
    }

    process.exit(0);
};

run();

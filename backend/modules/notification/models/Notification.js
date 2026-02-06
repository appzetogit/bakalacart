
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String
    },
    zone: {
        type: String,
        default: 'All'
    },
    target: {
        type: String,
        enum: ['Customer', 'Delivery Man', 'Restaurant'],
        required: true
    },
    status: {
        type: Boolean,
        default: true
    },
    sentAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;

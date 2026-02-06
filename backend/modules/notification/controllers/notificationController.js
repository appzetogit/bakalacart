
import Notification from '../models/Notification.js';
import User from '../../auth/models/User.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import Delivery from '../../delivery/models/Delivery.js';
import Zone from '../../admin/models/Zone.js';
import { sendPushNotification } from '../../../shared/services/firebaseAdmin.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { uploadToCloudinary } from '../../../shared/utils/cloudinaryService.js';
import mongoose from 'mongoose';

/**
 * Send push notification from Admin to target group
 * POST /api/notification/send
 */
export const sendAdminNotification = asyncHandler(async (req, res) => {
    const { title, zone, sendTo, description } = req.body;
    let { image } = req.body;

    if (!title || !description || !sendTo) {
        return errorResponse(res, 400, 'Title, description, and target group are required');
    }

    try {
        // Handle Cloudinary Image Upload
        if (req.file) {
            console.log('📤 Uploading notification banner to Cloudinary...');
            const uploadResult = await uploadToCloudinary(req.file.buffer, {
                folder: 'notifications'
            });
            image = uploadResult.secure_url;
            console.log('✅ Image uploaded successfully:', image);
        }

        let targetTokens = [];

        // 1. Identify Zone if specified
        let zoneModel = null;
        if (zone && zone !== 'All') {
            zoneModel = await Zone.findOne({ name: zone });
        }

        let users = [];
        if (sendTo === 'Customer') {
            if (zoneModel) {
                // Find users whose current location is in the zone
                users = await User.find({
                    role: 'user',
                    'currentLocation.location': {
                        $geoWithin: {
                            $geometry: zoneModel.boundary
                        }
                    }
                }).select('fcmTokens fcmTokenMobile');
            } else {
                users = await User.find({ role: 'user' }).select('fcmTokens fcmTokenMobile');
            }

            users.forEach(user => {
                targetTokens.push(...(user.fcmTokens || []), ...(user.fcmTokenMobile || []));
            });
        } else if (sendTo === 'Restaurant') {
            let restaurants = [];
            if (zoneModel) {
                // Find restaurants in the specified zone using GeoJSON coordinates
                restaurants = await Restaurant.find({
                    'location.coordinates': {
                        $geoWithin: {
                            $geometry: zoneModel.boundary
                        }
                    }
                }).select('fcmTokens fcmTokenMobile');
            } else {
                // Find all restaurants if no zone specified
                restaurants = await Restaurant.find({}).select('fcmTokens fcmTokenMobile');
            }

            console.log('Restaurants found:', restaurants.length);
            restaurants.forEach(r => {
                console.log('Restaurant tokens:', r.fcmTokens, r.fcmTokenMobile);
                targetTokens.push(...(r.fcmTokens || []), ...(r.fcmTokenMobile || []));
            });
        } else if (sendTo === 'Delivery Man') {
            let deliveryPartners = [];
            if (zoneModel) {
                // Find delivery partners by zone assignment OR geographic location
                deliveryPartners = await Delivery.find({
                    $or: [
                        { 'availability.zones': zoneModel._id },
                        {
                            'availability.currentLocation': {
                                $geoWithin: {
                                    $geometry: zoneModel.boundary
                                }
                            }
                        }
                    ]
                }).select('fcmTokens fcmTokenMobile');
            } else {
                deliveryPartners = await Delivery.find({}).select('fcmTokens fcmTokenMobile');
            }

            deliveryPartners.forEach(delivery => {
                targetTokens.push(...(delivery.fcmTokens || []), ...(delivery.fcmTokenMobile || []));
            });
        }

        // Remove duplicates and empties
        targetTokens = [...new Set(targetTokens)].filter(Boolean);

        // 3. Save to History (we need ID for tag)
        const newNotification = await Notification.create({
            title,
            description,
            image,
            zone: zone || 'All',
            target: sendTo,
            status: true
        });

        if (targetTokens.length === 0) {
            console.log(`⚠️ [Admin Notification] No FCM tokens found for target: ${sendTo}, zone: ${zone}`);
        } else {
            console.log(`🚀 [Admin Notification] Sending to ${targetTokens.length} tokens. Title: ${title}`);

            const payload = {
                title: title,
                body: description,
                data: {
                    type: 'admin_broadcast',
                    image: image || '',
                    icon: '/bakalalogo.png', // Bakala logo requirement
                    tag: newNotification._id.toString(), // Prevent duplicates
                    click_action: 'FLUTTER_NOTIFICATION_CLICK'
                }
            };

            if (image) {
                payload.image = image; // For system tray preview
                payload.data.image = image;
            }

            // Send via Firebase
            await sendPushNotification(targetTokens, payload);
        }

        return successResponse(res, 201, 'Notification sent and saved successfully', {
            notification: newNotification,
            tokenCount: targetTokens.length
        });

    } catch (error) {
        console.error('Error sending admin notification:', error);
        return errorResponse(res, 500, 'Failed to send notification');
    }
});

/**
 * Get notification history
 * GET /api/notification
 */
export const getNotifications = asyncHandler(async (req, res) => {
    try {
        const notifications = await Notification.find().sort({ createdAt: -1 });
        return successResponse(res, 200, 'Notification history retrieved', { notifications });
    } catch (error) {
        return errorResponse(res, 500, 'Failed to fetch notification history');
    }
});

/**
 * Delete a notification from history
 * DELETE /api/notification/:id
 */
export const deleteNotification = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        await Notification.findByIdAndDelete(id);
        return successResponse(res, 200, 'Notification deleted');
    } catch (error) {
        return errorResponse(res, 500, 'Failed to delete notification');
    }
});

/**
 * Toggle notification status (just for UI)
 * PATCH /api/notification/:id/status
 */
export const toggleNotificationStatus = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findById(id);
        if (!notification) return errorResponse(res, 404, 'Notification not found');

        notification.status = !notification.status;
        await notification.save();

        return successResponse(res, 200, 'Notification status updated', { notification });
    } catch (error) {
        return errorResponse(res, 500, 'Failed to update status');
    }
});

import Notification from '../models/Notification.js';
import User from '../../auth/models/User.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import Delivery from '../../delivery/models/Delivery.js';
import Zone from '../../admin/models/Zone.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { sendPushNotification } from '../../../shared/services/firebaseAdmin.js';
import { cloudinary } from '../../../config/cloudinary.js';
import { uploadToCloudinary } from '../../../shared/utils/cloudinaryService.js';

/**
 * Send notification from admin dashboard
 * POST /api/notification/send
 */
export const sendAdminNotification = asyncHandler(async (req, res) => {
    try {
        const { title, description, sendTo, zone } = req.body;
        let { image } = req.body;
        console.log(`🔔 [Admin Notification] Request:`, { title, sendTo, zone });

        // Handle Image Upload if file exists
        if (req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file.buffer, {
                    folder: 'notifications'
                });
                image = uploadResult.secure_url;
                console.log(`📸 [Admin Notification] Image uploaded: ${image}`);
            } catch (uploadError) {
                console.error(`❌ [Admin Notification] Image upload failed:`, uploadError);
            }
        }

        // Debug: Check total counts visible to this controller
        try {
            const count = await Delivery.countDocuments();
            console.log(`🔍 [Admin Notification] Total Delivery docs in DB: ${count}`);
        } catch (e) {
            console.error(`❌ [Admin Notification] Error counting docs:`, e);
        }

        if (!title || !description || !sendTo) {
            return errorResponse(res, 400, 'Title, description and target (sendTo) are required');
        }

        let targetTokens = [];
        let zoneModel = null;

        if (zone && zone !== 'All') {
            zoneModel = await Zone.findOne({ name: zone });
            if (!zoneModel) {
                console.log(`⚠️ [Admin Notification] Zone not found: ${zone}. Falling back to all users in category.`);
            }
        }

        // Logic to collect tokens based on target
        if (sendTo === 'All') {
            const allUsers = await User.find({}).select('fcmTokens fcmTokenMobile');
            const allRestaurants = await Restaurant.find({}).select('fcmTokens fcmTokenMobile');
            const allDelivery = await Delivery.find({}).select('fcmTokens fcmTokenMobile');

            [...allUsers, ...allRestaurants, ...allDelivery].forEach(record => {
                targetTokens.push(...(record.fcmTokens || []), ...(record.fcmTokenMobile || []));
            });
        } else if (sendTo === 'Customer') {
            let users = [];
            if (zoneModel) {
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
            let restaurantUsers = [];

            if (zoneModel) {
                restaurants = await Restaurant.find({
                    'location.coordinates': {
                        $geoWithin: {
                            $geometry: zoneModel.boundary
                        }
                    }
                }).select('name fcmTokens fcmTokenMobile');

                restaurantUsers = await User.find({
                    role: 'restaurant',
                    'currentLocation.location': {
                        $geoWithin: {
                            $geometry: zoneModel.boundary
                        }
                    }
                }).select('name fcmTokens fcmTokenMobile');
            } else {
                restaurants = await Restaurant.find({}).select('name fcmTokens fcmTokenMobile');
                restaurantUsers = await User.find({ role: 'restaurant' }).select('name fcmTokens fcmTokenMobile');
            }

            console.log(`📡 [Admin Notification] Restaurants: ${restaurants.length}, Restaurant Users: ${restaurantUsers.length}`);

            [...restaurants, ...restaurantUsers].forEach(r => {
                targetTokens.push(...(r.fcmTokens || []), ...(r.fcmTokenMobile || []));
            });
        } else if (sendTo === 'Delivery Man') {
            let deliveryPartners = [];
            let deliveryUsers = [];

            if (zoneModel) {
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
                }).select('name fcmTokens fcmTokenMobile');

                deliveryUsers = await User.find({
                    role: 'delivery',
                    'currentLocation.location': {
                        $geoWithin: {
                            $geometry: zoneModel.boundary
                        }
                    }
                }).select('name fcmTokens fcmTokenMobile');

                // Fallback: If no delivery partners found in zone (common in testing if location is missing), fetch ALL
                if (deliveryPartners.length === 0 && deliveryUsers.length === 0) {
                    console.log(`⚠️ [Admin Notification] No delivery partners found in zone '${zoneModel.name}'. Falling back to ALL delivery partners.`);
                    deliveryPartners = await Delivery.find({}).select('name fcmTokens fcmTokenMobile');
                    deliveryUsers = await User.find({ role: 'delivery' }).select('name fcmTokens fcmTokenMobile');
                }
            } else {
                deliveryPartners = await Delivery.find({}).select('name fcmTokens fcmTokenMobile');
                deliveryUsers = await User.find({ role: 'delivery' }).select('name fcmTokens fcmTokenMobile');
            }

            console.log(`📡 [Admin Notification] Delivery partners: ${deliveryPartners.length}, Delivery Users: ${deliveryUsers.length}`);

            [...deliveryPartners, ...deliveryUsers].forEach(d => {
                targetTokens.push(...(d.fcmTokens || []), ...(d.fcmTokenMobile || []));
            });
        }

        // CRITICAL: Deduplicate tokens to prevent duplicate notifications
        // Remove duplicates and empty values before sending
        targetTokens = [...new Set(targetTokens.filter(Boolean))];

        console.log(`📊 [Admin Notification] Collected ${targetTokens.length} unique tokens for target: ${sendTo}`);

        // Save notification to history
        const newNotification = await Notification.create({
            title,
            description,
            image,
            zone: zone || 'All',
            target: sendTo,
            status: true
        });

        if (targetTokens.length === 0) {
            console.log(`⚠️ [Admin Notification] No FCM tokens found.`);
        } else {
            const baseUrl = process.env.CORS_ORIGIN || 'https://bakalacart.com';
            const logoUrl = `${baseUrl}/bakalalogo.png`;

            const payload = {
                title: title,
                body: description,
                image: image || null,
                data: {
                    type: 'admin_broadcast',
                    image: image || '',
                    icon: logoUrl,
                    tag: newNotification._id.toString(),
                    notificationId: newNotification._id.toString(),
                    click_action: '/notifications',
                    link: '/notifications'
                }
            };

            // Send via Firebase
            console.log(`📤 [Admin Notification] Sending notification with tag: ${payload.data.tag} to ${targetTokens.length} unique tokens`);
            const result = await sendPushNotification(targetTokens, payload);
            console.log(`✅ [Admin Notification] Notification sent. Success: ${result?.successCount || 0}, Failed: ${result?.failureCount || 0}`);

            if (result && result.cleanupTokens && result.cleanupTokens.length > 0) {
                await cleanupInvalidTokens(result.cleanupTokens);
            }
        }

        return successResponse(res, 201, 'Notification sent successfully', {
            notification: newNotification,
            tokenCount: [...new Set(targetTokens.filter(Boolean))].length
        });

    } catch (error) {
        console.error('Error sending admin notification:', error);
        return errorResponse(res, 500, 'Failed to send notification');
    }
});

/**
 * Cleanup invalid tokens from all models
 */
const cleanupInvalidTokens = async (tokens) => {
    if (!tokens || tokens.length === 0) return;
    try {
        await Promise.all([
            User.updateMany({}, { $pull: { fcmTokens: { $in: tokens }, fcmTokenMobile: { $in: tokens } } }),
            Restaurant.updateMany({}, { $pull: { fcmTokens: { $in: tokens }, fcmTokenMobile: { $in: tokens } } }),
            Delivery.updateMany({}, { $pull: { fcmTokens: { $in: tokens }, fcmTokenMobile: { $in: tokens } } })
        ]);
        console.log(`✨ [FCM Cleanup] Removed ${tokens.length} invalid tokens.`);
    } catch (error) {
        console.error('❌ [FCM Cleanup] Error:', error);
    }
};

/**
 * Get notification history
 */
export const getNotifications = asyncHandler(async (req, res) => {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    return successResponse(res, 200, 'Notification history retrieved', { notifications });
});

/**
 * Delete a notification from history
 */
export const deleteNotification = asyncHandler(async (req, res) => {
    await Notification.findByIdAndDelete(req.params.id);
    return successResponse(res, 200, 'Notification deleted');
});

/**
 * Toggle notification status
 */
export const toggleNotificationStatus = asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return errorResponse(res, 404, 'Notification not found');
    notification.status = !notification.status;
    await notification.save();
    return successResponse(res, 200, 'Notification status updated', { notification });
});

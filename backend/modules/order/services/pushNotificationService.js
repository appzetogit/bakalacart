import mongoose from 'mongoose';
import { sendPushNotification } from '../../../shared/services/firebaseAdmin.js';
import Admin from '../../admin/models/Admin.js';
import User from '../../auth/models/User.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import Delivery from '../../delivery/models/Delivery.js';

/**
 * Send push notification to a user
 * @param {string} userId - User, Restaurant, or Delivery ID
 * @param {string} userType - 'user' | 'restaurant' | 'delivery' | 'admin'
 * @param {Object} payload - { title, body, data }
 */
export const sendOrderPushNotification = async (userId, userType, payload) => {
    try {
        let tokens = [];
        let model;

        if (userType === 'user') model = User;
        else if (userType === 'restaurant') model = Restaurant;
        else if (userType === 'delivery') model = Delivery;
        else if (userType === 'admin') model = Admin;

        let record = null;

        // 1. Try finding by MongoDB _id first (standard for all models)
        if (mongoose.Types.ObjectId.isValid(userId)) {
            record = await model.findById(userId).select('fcmTokens fcmTokenMobile');
        }

        // 2. Fallback: Try finding by model-specific custom ID fields if findById failed
        if (!record) {
            if (userType === 'restaurant') {
                record = await model.findOne({ restaurantId: userId }).select('fcmTokens fcmTokenMobile');
            } else if (userType === 'delivery') {
                record = await model.findOne({ deliveryId: userId }).select('fcmTokens fcmTokenMobile');
            }
        }

        if (!record) {
            console.warn(`[Push Notification] ${userType} not found with identifier: ${userId}`);
            return;
        }

        // Combine both web and mobile tokens
        tokens = [...(record.fcmTokens || []), ...(record.fcmTokenMobile || [])];

        // Remove duplicates and empty values
        tokens = [...new Set(tokens)].filter(Boolean);

        if (tokens.length === 0) {
            console.log(`⚠️ [Push Notification] No FCM tokens found for ${userType} ${userId}. (Has Tokens: ${record.fcmTokens?.length || 0}, Has Mobile Tokens: ${record.fcmTokenMobile?.length || 0})`);
            return;
        }

        console.log(`🚀 [Push Notification] Sending to ${userType} ${userId} (${tokens.length} tokens combined). Title: ${payload.title}`);

        const baseUrl = process.env.CORS_ORIGIN || 'https://bakalacart.com';
        const logoUrl = `${baseUrl}/bakalalogo.png`;

        if (!payload.data) payload.data = {};
        payload.data.icon = payload.data.icon || logoUrl;

        // Ensure tag is present for deduplication
        if (!payload.data.tag) {
            payload.data.tag = payload.data.orderId || payload.data.notificationId || Date.now().toString();
        }

        // Also add image/icon to the notification payload itself so firebaseAdmin can use it
        if (!payload.image) {
            payload.image = logoUrl;
        }

        const response = await sendPushNotification(tokens, {
            title: payload.title,
            body: payload.body,
            data: payload.data,
            image: payload.image,
            icon: logoUrl
        });

        // Clean up invalid tokens
        if (response && response.cleanupTokens && response.cleanupTokens.length > 0) {
            console.log(`🧹 [Push Notification] ${response.cleanupTokens.length} tokens are invalid for ${userType} ${userId}. Removing them.`);

            const pullQuery = {
                $pull: {
                    fcmTokens: { $in: response.cleanupTokens },
                    fcmTokenMobile: { $in: response.cleanupTokens }
                }
            };

            // 1. Try updating by MongoDB _id first
            if (mongoose.Types.ObjectId.isValid(userId)) {
                await model.findByIdAndUpdate(userId, pullQuery);
            } else {
                // 2. Fallback: Update by custom ID for Restaurant/Delivery
                const customIdField = userType === 'restaurant' ? 'restaurantId' : (userType === 'delivery' ? 'deliveryId' : null);
                if (customIdField) {
                    await model.findOneAndUpdate({ [customIdField]: userId }, pullQuery);
                }
            }
            console.log(`✨ [Push Notification] Cleanup complete for ${userType} ${userId}`);
        } else if (response && response.failedTokens && response.failedTokens.length > 0) {
            console.log(`🧹 [Push Notification] ${response.failedTokens.length} tokens failed (but might be temporary).`);
        }

    } catch (error) {
        console.error(`[Push Notification] Error sending to ${userType}:`, error);
    }
};

/**
 * Send push notification to all admin users
 * @param {Object} payload - { title, body, data }
 */
/**
 * Send push notification to all admin users
 * @param {Object} payload - { title, body, data }
 */
export const sendAdminPushNotification = async (payload) => {
    try {
        const Admin = (await import('../../admin/models/Admin.js')).default;

        // Fetch admins from Admin collection (the dedicated admin users)
        const admins = await Admin.find({
            fcmTokens: { $exists: true, $not: { $size: 0 } }
        }).select('fcmTokens');

        // Also fetch Users with admin role if applicable (optional, depending on if you use dual systems)
        // For now, focusing on the dedicated Admin model as that's what the request implies

        if (!admins || admins.length === 0) {
            console.log('⚠️ [Push Notification] No admin users found with tokens.');
            return;
        }

        let allTokens = [];
        admins.forEach(admin => {
            if (admin.fcmTokens && Array.isArray(admin.fcmTokens)) {
                allTokens.push(...admin.fcmTokens);
            }
        });

        allTokens = [...new Set(allTokens)].filter(Boolean);

        if (allTokens.length === 0) {
            console.log('⚠️ [Push Notification] No admin FCM tokens found.');
            return;
        }

        console.log(`🚀 [Push Notification] Sending to ${admins.length} admins (${allTokens.length} tokens combined). Title: ${payload.title}`);

        if (!payload.data) payload.data = {};
        const baseUrl = process.env.CORS_ORIGIN || 'https://bakalacart.com';
        const logoUrl = `${baseUrl}/bakalalogo.png`;
        payload.data.icon = payload.data.icon || logoUrl;

        // Ensure tag is present for deduplication
        if (!payload.data.tag) {
            payload.data.tag = payload.data.orderId || payload.data.notificationId || 'admin_broadcast';
        }

        const { sendPushNotification } = await import('../../../shared/services/firebaseAdmin.js');
        const response = await sendPushNotification(allTokens, {
            title: payload.title,
            body: payload.body,
            data: payload.data,
            image: payload.image || logoUrl,
            icon: logoUrl
        });

        // Cleanup invalid tokens if any
        if (response && response.cleanupTokens && response.cleanupTokens.length > 0) {
            console.log(`🧹 [Push Notification] ${response.cleanupTokens.length} admin tokens are invalid. Cleaning them up...`);

            // Clean up from Admin collection
            await Admin.updateMany(
                {},
                {
                    $pull: {
                        fcmTokens: { $in: response.cleanupTokens }
                    }
                }
            );
            console.log('✨ [Push Notification] Admin token cleanup complete.');
        }

    } catch (error) {
        console.error('[Push Notification] Error sending to admins:', error);
    }
};

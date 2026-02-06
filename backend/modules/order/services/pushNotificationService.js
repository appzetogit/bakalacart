import { sendPushNotification } from '../../../shared/services/firebaseAdmin.js';
import User from '../../auth/models/User.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import Delivery from '../../delivery/models/Delivery.js';

/**
 * Send push notification to a user
 * @param {string} userId - User, Restaurant, or Delivery ID
 * @param {string} userType - 'user' | 'restaurant' | 'delivery'
 * @param {Object} payload - { title, body, data }
 */
export const sendOrderPushNotification = async (userId, userType, payload) => {
    try {
        let tokens = [];
        let model;

        if (userType === 'user') model = User;
        else if (userType === 'restaurant') model = Restaurant;
        else if (userType === 'delivery') model = Delivery;

        const record = await model.findById(userId).select('fcmTokens fcmTokenMobile');
        if (!record) {
            console.warn(`[Push Notification] ${userType} not found with ID: ${userId}`);
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

        // Note: We use 'icon' in data payload which SW uses.
        // We also want to ensure the main icon is the logo.
        if (!payload.data) payload.data = {};
        // Use the new logo-icon.png which we just copied from assets
        payload.data.icon = payload.data.icon || '/bakalalogo.png';

        // Also add image/icon to the notification payload itself so firebaseAdmin can use it
        // This helps if the browser handles the notification automatically (background)
        if (!payload.image) payload.image = process.env.VITE_API_URL ? `${process.env.VITE_API_URL}/bakalalogo.png` : 'https://bakalacart.com/bakalalogo.png';
        // Note: The above URL might be wrong if VITE_API_URL points to backend. We need frontend URL or relative path support.
        // For web push, relative path usually works if origin is same. 
        // But for safety, let's keep it in data for SW.

        const response = await sendPushNotification(tokens, {
            title: payload.title,
            body: payload.body,
            data: payload.data,
            // Pass icon to be added to notification part if needed
            icon: '/bakalalogo.png'
        });

        // Clean up invalid tokens
        if (response && response.failedTokens && response.failedTokens.length > 0) {
            console.log(`🧹 [Push Notification] ${response.failedTokens.length} tokens failed to receive notification.`);

            // Enable cleanup for NotRegistered errors
            console.log(`🧹 [Push Notification] Removing ${response.failedTokens.length} invalid tokens for ${userType} ${userId}`);

            await model.findByIdAndUpdate(userId, {
                $pull: {
                    fcmTokens: { $in: response.failedTokens },
                    fcmTokenMobile: { $in: response.failedTokens }
                }
            });
            console.log(`✨ [Push Notification] Cleanup complete for ${userType} ${userId}`);
        }

    } catch (error) {
        console.error(`[Push Notification] Error sending to ${userType}:`, error);
    }
};

/**
 * Send push notification to all admin users
 * @param {Object} payload - { title, body, data }
 */
export const sendAdminPushNotification = async (payload) => {
    try {
        const admins = await User.find({ role: 'admin' }).select('fcmTokens fcmTokenMobile');

        if (!admins || admins.length === 0) {
            console.log('⚠️ [Push Notification] No admin users found.');
            return;
        }

        let allTokens = [];
        admins.forEach(admin => {
            const tokens = [...(admin.fcmTokens || []), ...(admin.fcmTokenMobile || [])];
            allTokens.push(...tokens);
        });

        allTokens = [...new Set(allTokens)].filter(Boolean);

        if (allTokens.length === 0) {
            console.log('⚠️ [Push Notification] No admin FCM tokens found.');
            return;
        }

        console.log(`🚀 [Push Notification] Sending to ${admins.length} admins (${allTokens.length} tokens combined). Title: ${payload.title}`);

        if (!payload.data) payload.data = {};
        payload.data.icon = payload.data.icon || '/bakalalogo.png';

        const { sendPushNotification } = await import('../../../shared/services/firebaseAdmin.js');
        await sendPushNotification(allTokens, {
            title: payload.title,
            body: payload.body,
            data: payload.data,
            icon: '/bakalalogo.png'
        });

    } catch (error) {
        console.error('[Push Notification] Error sending to admins:', error);
    }
};

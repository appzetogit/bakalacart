
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

// Initialize Firebase Admin
let isInitialized = false;

try {
    const serviceAccountPath = path.resolve(process.cwd(), 'config', 'firebase-service-account.json');

    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        isInitialized = true;
        console.log('✅ [FCM] Firebase Admin initialized successfully.');
    } else {
        console.warn('⚠️ [FCM] Firebase service account file not found.');
    }
} catch (error) {
    console.error('❌ [FCM] Error initializing Firebase Admin:', error);
}

// Function to send notification
export const sendPushNotification = async (tokens, payload) => {
    if (!isInitialized) return { success: false, error: 'Firebase Admin not initialized' };

    // Ensure tokens are unique and non-empty
    const uniqueTokens = [...new Set(tokens.filter(Boolean))];

    if (uniqueTokens.length === 0) {
        console.log('⚠️ [FCM] No tokens to send to.');
        return { successCount: 0, failureCount: 0, failedTokens: [] };
    }

    try {
        const tag = payload.data?.tag || payload.data?.orderId || payload.data?.notificationId || Date.now().toString();
        const iconUrl = payload.data?.icon || 'https://bakalacart.com/bakalalogo.png';

        const message = {
            // Data payload for all (Metadata for custom handlers)
            data: {
                ...payload.data,
                tag: tag,
                title: payload.title,
                body: payload.body,
                icon: iconUrl,
                image: payload.image || ''
            },
            tokens: uniqueTokens,
            android: {
                collapseKey: tag, // Deduplication for Android
                priority: 'high',
                // For Native Apps: If 'notification' is included here, Android OS shows it automatically.
                // If the app also has an 'onMessage' listener that shows a notification, you get two.
                // WE REMOVE THE ANDROID NOTIFICATION BLOCK to let the App handle it via 'data' only.
                // OR we keep it but ensure 'data' doesn't contain the same info if the app is naive.
                // BEST BET: Keep notification for background but use 'tag' correctly.
                notification: {
                    title: payload.title,
                    body: payload.body,
                    tag: tag,
                    icon: 'notification_icon',
                    color: '#008037',
                    image: payload.image || null,
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                    sound: 'default'
                }
            },
            apns: {
                headers: {
                    'apns-collapse-id': tag, // Deduplication for iOS
                    'apns-priority': '10'
                },
                payload: {
                    aps: {
                        alert: {
                            title: payload.title,
                            body: payload.body
                        },
                        'thread-id': tag,
                        badge: 1,
                        sound: 'default',
                        'mutable-content': 1
                    }
                }
            },
            webpush: {
                headers: {
                    Urgency: 'high',
                    Topic: tag.substring(0, 32)
                },
                notification: {
                    title: payload.title,
                    body: payload.body,
                    tag: tag, // Deduplication for Web
                    icon: iconUrl,
                    badge: iconUrl,
                    image: payload.image || null,
                    requireInteraction: true
                },
                fcmOptions: {
                    link: (payload.data?.click_action && !payload.data.click_action.includes('_CLICK'))
                        ? payload.data.click_action
                        : (payload.data?.link || '/')
                }
            }
        };

        // CRITICAL: We DO NOT send the top-level 'notification' object 
        // if we are providing platform-specific notification blocks.
        // This is a common cause of double notifications.
        // However, for generic clients, we keep it. but here we have all 3 major platforms covered.
        // For security, if it's a mobile app, it relies on 'android' and 'apns'.
        // If it's a web app, it relies on 'webpush'.
        // So we can SAFELY remove the top-level 'notification' object.

        console.log(`🚀 [FCM] Preparing to send to ${uniqueTokens.length} tokens. Tag: ${tag}`);
        const response = await admin.messaging().sendEachForMulticast(message);

        console.log(`✅ [FCM] Sent successfully: ${response.successCount}, Failed: ${response.failureCount}`);

        const failedTokensList = [];
        const cleanupTokens = [];

        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                const token = uniqueTokens[idx];
                failedTokensList.push({ token, error: resp.error?.code });

                if (['messaging/registration-token-not-registered',
                    'messaging/invalid-registration-token',
                    'messaging/invalid-argument'].includes(resp.error?.code)) {
                    cleanupTokens.push(token);
                }
            }
        });

        return {
            successCount: response.successCount,
            failureCount: response.failureCount,
            failedTokens: failedTokensList,
            cleanupTokens: cleanupTokens,
            responses: response.responses
        };
    } catch (error) {
        console.error('❌ [FCM] Multicast Error:', error);
        return { successCount: 0, failureCount: uniqueTokens.length, error: error.message };
    }
};

export default admin;


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

    // FCM sendEachForMulticast has a limit of 500 tokens per call
    const CHUNK_SIZE = 500;
    const chunks = [];
    for (let i = 0; i < uniqueTokens.length; i += CHUNK_SIZE) {
        chunks.push(uniqueTokens.slice(i, i + CHUNK_SIZE));
    }

    console.log(`🚀 [FCM] Preparing to send to ${uniqueTokens.length} tokens in ${chunks.length} batches. Tag: ${payload.data?.tag || 'none'}`);

    const results = {
        successCount: 0,
        failureCount: 0,
        failedTokens: [],
        cleanupTokens: [],
        responses: []
    };

    const tag = payload.data?.tag || payload.data?.orderId || payload.data?.notificationId || Date.now().toString();
    const iconUrl = payload.data?.icon || 'https://bakalacart.com/bakalalogo.png';

    // Determine if this is a new order notification that needs sound
    const isNewOrder = payload.data?.type === 'new_order' || payload.data?.orderId;
    const baseUrl = process.env.CORS_ORIGIN || 'https://bakalacart.com';
    const soundUrl = isNewOrder ? `${baseUrl}/audio/alert.mp3` : null;

    for (const tokenChunk of chunks) {
        try {
            const message = {
                data: {
                    ...payload.data,
                    tag: tag,
                    title: payload.title,
                    body: payload.body,
                    icon: iconUrl,
                    image: payload.image || '',
                    sound: soundUrl || ''
                },
                tokens: tokenChunk,
                android: {
                    collapseKey: tag,
                    priority: 'high',
                },
                apns: {
                    headers: {
                        'apns-collapse-id': tag,
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
                        tag: tag,
                        icon: iconUrl,
                        badge: iconUrl,
                        image: payload.image || undefined,
                        requireInteraction: true,
                        sound: soundUrl || undefined
                    },
                    fcmOptions: {
                        link: (payload.data?.click_action && !payload.data.click_action.includes('_CLICK'))
                            ? payload.data.click_action
                            : (payload.data?.link || '/')
                    }
                }
            };

            const response = await admin.messaging().sendEachForMulticast(message);

            results.successCount += response.successCount;
            results.failureCount += response.failureCount;
            results.responses.push(...response.responses);

            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const token = tokenChunk[idx];
                    results.failedTokens.push({ token, error: resp.error?.code });

                    if (['messaging/registration-token-not-registered',
                        'messaging/invalid-registration-token',
                        'messaging/invalid-argument',
                        'messaging/mismatched-credential'].includes(resp.error?.code)) {
                        results.cleanupTokens.push(token);
                    }
                }
            });
        } catch (error) {
            console.error('❌ [FCM] Batch Error:', error);
            results.failureCount += tokenChunk.length;
        }
    }

    console.log(`✅ [FCM] All batches complete. Success: ${results.successCount}, Failed: ${results.failureCount}`);
    return results;
};

export default admin;

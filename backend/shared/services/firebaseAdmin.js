
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

// Initialize Firebase Admin
let isInitialized = false;

try {
    // Try to load service account from config file
    const serviceAccountPath = path.resolve(process.cwd(), 'config', 'firebase-service-account.json');

    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        isInitialized = true;
        console.log('Firebase Admin initialized successfully with service account file.');
    } else {
        // Fallback to environment variables if file doesn't exist (Production support)
        // You can implement this if you have env vars like FIREBASE_PROJECT_ID etc.
        console.warn('Firebase service account file not found at:', serviceAccountPath);
    }
} catch (error) {
    console.error('Error initializing Firebase Admin:', error);
}

// Function to send notification
export const sendPushNotification = async (tokens, payload) => {
    if (!isInitialized) {
        console.error('❌ [FCM] Firebase Admin not initialized. Cannot send notifications.');
        console.error('❌ [FCM] Please check if firebase-service-account.json exists in config folder.');
        return {
            successCount: 0,
            failureCount: tokens?.length || 0,
            failedTokens: tokens || [],
            error: 'Firebase Admin not initialized'
        };
    }

    if (!tokens || tokens.length === 0) {
        console.warn('⚠️ [FCM] No tokens provided. Skipping notification.');
        return {
            successCount: 0,
            failureCount: 0,
            failedTokens: [],
            error: 'No tokens provided'
        };
    }

    // Validate payload
    if (!payload || !payload.title || !payload.body) {
        console.error('❌ [FCM] Invalid payload: title and body are required');
        return {
            successCount: 0,
            failureCount: tokens.length,
            failedTokens: tokens,
            error: 'Invalid payload'
        };
    }

    try {
        // Build notification object with optional image
        const notificationObj = {
            title: payload.title,
            body: payload.body,
        };
        
        // Add image URL if provided (for web push notifications)
        if (payload.image) {
            notificationObj.imageUrl = payload.image;
        }

        const message = {
            notification: notificationObj,
            data: payload.data || {},
            tokens: tokens, // Array of FCM tokens
            webpush: {
                notification: {
                    ...notificationObj,
                    icon: payload.data?.icon || '/bakalalogo.png',
                    badge: payload.data?.icon || '/bakalalogo.png',
                },
                fcmOptions: {
                    link: payload.data?.click_action || '/'
                }
            }
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`📡 [FCM] Successfully sent: ${response.successCount} messages, Failed: ${response.failureCount} messages`);
        console.log(`📡 [FCM] Title: "${payload.title}" | Recipient count: ${tokens.length}`);
        
        // Log detailed error information
        if (response.failureCount > 0) {
            console.error(`❌ [FCM] ${response.failureCount} notifications failed out of ${tokens.length} total`);
        }

        // Optional: cleanup invalid tokens
        const failedTokens = [];
        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                    console.error(`❌ [FCM Error] Token: ${tokens[idx].substring(0, 10)}... Error:`, resp.error);
                }
            });
            console.log('Failed tokens:', failedTokens);
        }

        return {
            successCount: response.successCount,
            failureCount: response.failureCount,
            failedTokens: failedTokens,
            responses: response.responses
        };
    } catch (error) {
        console.error('❌ [FCM] Error sending message:', error);
        console.error('❌ [FCM] Error details:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        // Return error details instead of null
        return {
            successCount: 0,
            failureCount: tokens.length,
            failedTokens: tokens,
            error: error.message || 'Unknown error'
        };
    }
};

export default admin;

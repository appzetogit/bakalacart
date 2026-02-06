
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
        console.warn('Firebase Admin not initialized. Skipping notification.');
        return;
    }

    if (!tokens || tokens.length === 0) {
        return;
    }

    try {
        const message = {
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: payload.data || {},
            tokens: tokens, // Array of FCM tokens
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`📡 [FCM] Successfully sent: ${response.successCount} messages, Failed: ${response.failureCount} messages`);
        console.log(`📡 [FCM] Title: "${payload.title}" | Recipient count: ${tokens.length}`);

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
        console.error('Error sending message:', error);
        // Don't throw error to prevent blocking main flow
        return null;
    }
};

export default admin;

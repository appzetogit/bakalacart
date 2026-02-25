import admin from 'firebase-admin';
import { getDatabase } from 'firebase-admin/database';
import path from 'path';
import fs from 'fs';
import { getFirebaseCredentials } from '../utils/envService.js';

let isInitialized = false;
let database = null;

/**
 * Initialize Firebase Admin with both Messaging and Realtime Database
 */
export const initializeFirebase = async () => {
    if (isInitialized) return { admin, database };

    try {
        // 1. Get credentials (prioritizing database/env vars)
        const credentials = await getFirebaseCredentials();
        let serviceAccount = null;
        let databaseURL = process.env.FIREBASE_DATABASE_URL || credentials.databaseURL;

        if (credentials.projectId && credentials.clientEmail && credentials.privateKey) {
            console.log('📦 [Firebase] Using credentials from database/env vars.');
            serviceAccount = {
                projectId: credentials.projectId,
                clientEmail: credentials.clientEmail,
                privateKey: credentials.privateKey.replace(/\\n/g, '\n')
            };
        }
        // 2. Fallback to service account file
        else {
            const serviceAccountPath = path.resolve(process.cwd(), 'config', 'firebase-service-account.json');
            if (fs.existsSync(serviceAccountPath)) {
                console.log('📦 [Firebase] Falling back to service account file.');
                serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
            }
        }

        if (serviceAccount) {
            // Use the suggested URL from the warning if we know the project
            if (!databaseURL) {
                const projectId = serviceAccount.projectId || serviceAccount.project_id;
                // Specifically handle the asia-southeast1 region mismatch for this project
                if (projectId === 'bakalaa-8f5c2') {
                    databaseURL = `https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`;
                } else {
                    databaseURL = `https://${projectId}-default-rtdb.firebaseio.com/`;
                }
            }

            if (!admin.apps.length) {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    databaseURL: databaseURL
                });
            }

            try {
                // Use getDatabase() for better ESM/v12 support
                database = getDatabase();
                isInitialized = true;
                console.log('✅ [Firebase] Firebase Admin initialized successfully.');
                const currentDbUrl = admin.app().options.databaseURL;
                console.log(`📡 [Firebase] Realtime Database: ${currentDbUrl || databaseURL}`);
            } catch (dbError) {
                console.warn('⚠️ [Firebase] Could not initialize Realtime Database:', dbError.message);
                if (admin.apps.length) isInitialized = true;
            }
        } else {
            console.warn('⚠️ [Firebase] Firebase configuration missing. Realtime features will be disabled.');
        }

        return { admin, database };
    } catch (error) {
        console.error('❌ [Firebase] Error initializing Firebase Admin:', error);
        return { admin: null, database: null };
    }
};

/**
 * Legacy support for the requested function name
 */
export const initializeFirebaseRealtime = initializeFirebase;

/**
 * Get the Realtime Database instance
 */
export const getFirebaseDb = () => {
    if (!isInitialized || !database) {
        return null;
    }
    return database;
};

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export const calculateHaversineDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Sync active order status and polyline to Firebase
 */
export const syncActiveOrderToFirebase = async (orderId, data) => {
    const db = getFirebaseDb();
    if (!db) return false;
    try {
        await db.ref(`active_orders/${orderId}`).update({
            ...data,
            last_updated: Date.now()
        });
        return true;
    } catch (error) {
        console.warn(`⚠️ Firebase Sync Error (active_orders/${orderId}):`, error.message);
        return false;
    }
};

/**
 * Sync delivery boy online status and location to Firebase
 */
export const syncDeliveryBoyStatusToFirebase = async (boyId, data) => {
    const db = getFirebaseDb();
    if (!db) return false;
    try {
        await db.ref(`delivery_boys/${boyId}`).update({
            ...data,
            last_updated: Date.now()
        });
        return true;
    } catch (error) {
        console.warn(`⚠️ Firebase Sync Error (delivery_boys/${boyId}):`, error.message);
        return false;
    }
};

/**
 * Find nearest online delivery boy using Firebase data
 */
export const findNearestBoyFirebase = async (restLat, restLng, maxDist = 50) => {
    const db = getFirebaseDb();
    if (!db) return null;

    try {
        const snapshot = await db.ref('delivery_boys')
            .orderByChild('status')
            .equalTo('online')
            .once('value');

        const boys = snapshot.val();
        if (!boys) return null;

        let nearestBoyId = null;
        let minDistance = Infinity;

        for (const boyId in boys) {
            const boy = boys[boyId];
            if (!boy.lat || !boy.lng) continue;

            const dist = calculateHaversineDistance(restLat, restLng, boy.lat, boy.lng);
            if (dist < minDistance && dist <= maxDist) {
                minDistance = dist;
                nearestBoyId = boyId;
            }
        }

        return nearestBoyId ? { id: nearestBoyId, distance: minDistance, ...boys[nearestBoyId] } : null;
    } catch (error) {
        console.error('❌ Error finding nearest boy from Firebase:', error);
        return null;
    }
};

// Function to send notification (kept from original for compatibility)
export const sendPushNotification = async (tokens, payload) => {
    if (!isInitialized) {
        // Try to initialize if not done yet
        await initializeFirebase();
        if (!isInitialized) return { success: false, error: 'Firebase Admin not initialized' };
    }

    const uniqueTokens = [...new Set(tokens.filter(Boolean))];
    if (uniqueTokens.length === 0) return { successCount: 0, failureCount: 0, failedTokens: [] };

    const CHUNK_SIZE = 500;
    const chunks = [];
    for (let i = 0; i < uniqueTokens.length; i += CHUNK_SIZE) {
        chunks.push(uniqueTokens.slice(i, i + CHUNK_SIZE));
    }

    const results = {
        successCount: 0,
        failureCount: 0,
        failedTokens: [],
        cleanupTokens: [],
        responses: []
    };

    const tag = payload.data?.tag || payload.data?.orderId || payload.data?.notificationId || Date.now().toString();
    const iconUrl = payload.data?.icon || 'https://bakalacart.com/bakalalogo.png';
    const isNewOrder = payload.data?.type === 'new_order' || payload.data?.orderId;
    const baseUrl = process.env.CORS_ORIGIN || 'https://bakalacart.com';
    const soundUrl = isNewOrder ? `${baseUrl}/audio/alert.mp3` : null;

    for (const tokenChunk of chunks) {
        try {
            const message = {
                data: {
                    ...payload.data,
                    tag,
                    title: payload.title,
                    body: payload.body,
                    icon: iconUrl,
                    image: payload.image || '',
                    sound: soundUrl || ''
                },
                tokens: tokenChunk,
                android: { collapseKey: tag, priority: 'high' },
                apns: {
                    headers: { 'apns-collapse-id': tag, 'apns-priority': '10' },
                    payload: { ops: { alert: { title: payload.title, body: payload.body }, 'thread-id': tag, badge: 1, sound: 'default', 'mutable-content': 1 } }
                },
                webpush: {
                    headers: { Urgency: 'high', Topic: tag.substring(0, 32) },
                    notification: {
                        title: payload.title,
                        body: payload.body,
                        tag,
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
                    if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(resp.error?.code)) {
                        results.cleanupTokens.push(token);
                    }
                }
            });
        } catch (error) {
            console.error('❌ [Firebase] Notification Batch Error:', error);
            results.failureCount += tokenChunk.length;
        }
    }

    return results;
};

export default admin;


import { messaging, getToken, onMessage, deleteToken } from '@/lib/firebase';
import axios from 'axios';

const VAPID_KEY = "BHZMH56oZ8hv-NfRyAEwQJ_eRifGy5ZB7YbzSJAiUlT9UP0h4Wk8YLkQunbhs-FA7GFgafy_Iqrz5zRRbPpeqCg";

// Register service worker
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            console.log('✅ Service Worker registered:', registration);
            return registration;
        } catch (error) {
            console.error('❌ Service Worker registration failed:', error);
            throw error;
        }
    } else {
        throw new Error('Service Workers are not supported');
    }
}

// Request notification permission
async function requestNotificationPermission() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('✅ Notification permission granted');
            return true;
        } else {
            console.log('❌ Notification permission denied');
            return false;
        }
    }
    return false;
}

// Get FCM token
async function getFCMToken() {
    try {
        console.log('🔄 [FCM Service] Initializing FCM...');
        const registration = await registerServiceWorker();

        // Ensure SW is up to date
        if (registration && registration.update) {
            await registration.update();
        }

        // Check if permission granted
        if (Notification.permission !== 'granted') {
            console.log('⚠️ [FCM Service] Notification permission not granted yet. Requesting...');
            const granted = await requestNotificationPermission();
            if (!granted) {
                console.warn('❌ [FCM Service] Notification permission denied by user.');
                return null;
            }
        }

        console.log('🔑 [FCM Service] Requesting FCM token with VAPID key:', VAPID_KEY ? VAPID_KEY.substring(0, 10) + '...' : 'MISSING');

        try {
            const token = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (token) {
                console.log('✅ [FCM Service] FCM Token obtained successfully:', token.substring(0, 15) + '...');

                // SPECIAL FIX: Force refresh ONCE if we suspect stuck token
                const REFRESH_FIX_KEY = 'fcm_fix_v1_refresh_done';
                if (!localStorage.getItem(REFRESH_FIX_KEY)) {
                    console.log('🔄 [FCM Fix] Forcing token refresh to clear potential stale tokens...');
                    try {
                        await deleteToken(messaging);
                        console.log('🗑️ [FCM Fix] Old token deleted.');

                        // Get new token
                        const newToken = await getToken(messaging, {
                            vapidKey: VAPID_KEY,
                            serviceWorkerRegistration: registration
                        });
                        console.log('✅ [FCM Fix] New FRESH token obtained:', newToken ? newToken.substring(0, 15) + '...' : 'null');
                        localStorage.setItem(REFRESH_FIX_KEY, 'true');
                        return newToken;
                    } catch (refreshError) {
                        console.warn('⚠️ [FCM Fix] Failed to force refresh, using original token:', refreshError);
                    }
                }
                return token;
            } else {
                console.warn('❌ [FCM Service] No FCM token returned (null/undefined).');
                return null;
            }
        } catch (tokenError) {
            console.error('❌ [FCM Service] Error during getToken:', tokenError);
            if (tokenError.code === 'messaging/missing-current-browser-context') {
                console.warn('⚠️ [FCM Service] Browser context missing (likely headless or restrictive environment).');
            } else if (tokenError.message && tokenError.message.includes('Missing required authentication credential')) {
                console.error('🚨 [FCM Service] CRITICAL: VAPID Key mismatch or invalid project config!');
                console.error('   - Check if VAPID_KEY in pushNotificationService.js matches the key pair in Firebase Console -> Cloud Messaging -> Web Push Certificates.');
                console.error('   - Check if firebaseConfig in firebase.js matches the project ID associated with the VAPID key.');
                console.error('   - Ensure firebase-messaging-sw.js has the correct config.');
            }
            return null;
        }
    } catch (error) {
        console.error('❌ [FCM Service] Fatal error getting FCM token:', error);
        return null;
    }
}

// Helper to detect platform
function getPlatform() {
    const isMobileApp = window.Capacitor || window.cordova || /Capacitor/i.test(navigator.userAgent);
    return isMobileApp ? 'mobile' : 'web';
}

// Register FCM token with backend
async function registerFCMToken(authType = 'user', authToken = null) {
    try {
        // Determine Endpoint based on authType
        // authType: 'user' | 'restaurant' | 'delivery'
        const endpointMap = {
            'user': '/api/auth/fcm-token',
            'restaurant': '/api/restaurant/auth/fcm-token',
            'delivery': '/api/delivery/auth/fcm-token',
            'admin': '/api/admin/auth/fcm-token'
        };

        const endpoint = endpointMap[authType];
        if (!endpoint) {
            console.error("Unknown auth type for FCM registration");
            return;
        }

        // Get token from Firebase
        const token = await getFCMToken();
        if (!token) return;

        // Check if we should send to backend
        // We can store locally to avoid spamming backend, but backend logic also checks duplicates.
        const savedToken = localStorage.getItem(`fcm_token_${authType}`);
        const savedTokenSynced = localStorage.getItem(`fcm_token_${authType}_synced`);

        console.log(`🔍 [FCM Service] Checking sync status for ${authType}:`, { savedToken: savedToken ? 'exists' : 'null', synced: savedTokenSynced, newToken: token });

        if (savedToken === token && savedTokenSynced === 'true') {
            console.debug(`ℹ️ [FCM Service] Token already synced for ${authType}, but forcing update to ensure backend is in sync.`);
        }

        // Prepare headers
        const headers = {
            'Content-Type': 'application/json'
        };

        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        } else {
            // Try getting from localStorage if not provided (common pattern)
            // Adjust key based on your app's storage logic
            // But usually we pass it or use interceptors. 
            // If your axios has interceptors, this chunk is fine.
        }

        // But wait, if we are calling this POST login, we might not have set the token in axios default yet?
        // It's safer if the caller provides the token, OR we rely on axios interceptor if setup.
        // Assuming axios instance isn't imported here, we use 'axios' from package. 
        // If you have a configured axios instance, import that instead.

        // Using global axios for now, you should probably use your configured axios.
        // I will assume the caller handles the auth token in headers via interceptors OR pass it.

        // Send to backend
        // NOTE: This call might fail if not authenticated.
        // Ensure this is called ONLY when user is logged in.

        /* 
           However, the backend endpoints `saveFcmToken` usually require Auth.
           So we must have the token.
        */

        // Only proceed if we have an auth mechanism active
        // For now, I'll attempt the request.

        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

        // Remove trailing slash from base and leading slash from endpoint if needed to join correctly
        // But logic below: VITE_API_BASE_URL usually has /api at end. Endpoint has /api.
        // If VITE_API_BASE_URL is "http://localhost:5000/api", and endpoint is "/api/auth/fcm-token",
        // we get "http://localhost:5000/api/api/auth/fcm-token". This is WRONG.

        // Correct logic:
        // We should just use the base origin + endpoint.
        // OR better: replace the endpoint's "/api" prefix since base url has it.

        let finalUrl;
        if (API_URL.endsWith('/api') && endpoint.startsWith('/api')) {
            finalUrl = API_URL + endpoint.substring(4); // Remove first '/api' from endpoint
        } else {
            finalUrl = API_URL + endpoint;
        }

        console.log(`🚀 [FCM Service] Sending token to backend: ${finalUrl}`);

        const platform = getPlatform();

        // Send to backend
        const response = await axios.post(finalUrl, {
            token: token,
            platform: platform
        }, { headers }); // headers will likely need Authorization if not globally set

        console.log(`✅ [FCM Service] Backend response:`, response.data);

        localStorage.setItem(`fcm_token_${authType}`, token);
        localStorage.setItem(`fcm_token_${authType}_synced`, 'true');
        console.log(`✅ [FCM Service] FCM token registered and synced locally for ${authType}`);

        return token;
    } catch (error) {
        console.error(`❌ [FCM Service] Error registering FCM token for ${authType}:`, error.response?.data || error.message);
        // If registration failed, clear synced status so we try again next time
        localStorage.removeItem(`fcm_token_${authType}_synced`);
    }
}

let isForegroundHandlerSetup = false;

// Setup foreground notification handler
function setupForegroundNotificationHandler(handler) {
    if (isForegroundHandlerSetup) {
        console.warn('ℹ️ [FCM Service] Foreground notification handler already setup. Skipping to prevent duplicate notifications.');
        return;
    }

    onMessage(messaging, (payload) => {
        console.log('📬 [FCM Service] Foreground message received:', payload);

        // Show notification manually in foreground if needed
        if ('Notification' in window && Notification.permission === 'granted') {
            const { title, body } = payload.notification || {};
            // Use the provided icon or default
            const icon = payload.data?.icon || '/bakalalogo.png';

            console.log(`🔔 [FCM Service] Displaying real-time notification: ${title}`);

            new Notification(title, {
                body: body,
                icon: icon,
                data: payload.data,
                tag: payload.data?.tag || payload.data?.orderId // Prevent multiple notifications for same order/message
            });
        }

        // Call custom handler
        if (handler) {
            handler(payload);
        }
    });

    isForegroundHandlerSetup = true;
}

// Initialize push notifications
async function initializePushNotifications() {
    try {
        // Just register SW on load, don't ask for permission immediately if we want to wait for login
        // BUT the SOP says "Initialize on app load".
        await registerServiceWorker();

        // Setup foreground handler
        setupForegroundNotificationHandler();

    } catch (error) {
        console.error('Error initializing push notifications:', error);
    }
}

// Show a local notification (Real-time)
async function showLocalNotification(title, body, tag = 'general') {
    if (!('Notification' in window)) return;

    // Check if permission already granted
    if (Notification.permission !== 'granted') {
        const granted = await requestNotificationPermission();
        if (!granted) return;
    }

    // Use a unique tag to prevent duplicates in the system tray
    new Notification(title, {
        body: body,
        icon: '/bakalalogo.png',
        tag: tag, // This ensures that if the same tag is used, it replaces the old one instead of creating a new entry
        silent: false,
        requireInteraction: false
    });
}

export {
    initializePushNotifications,
    registerFCMToken,
    setupForegroundNotificationHandler,
    requestNotificationPermission,
    getFCMToken,
    getPlatform,
    showLocalNotification
};

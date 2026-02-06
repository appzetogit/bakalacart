
import { messaging, getToken, onMessage, deleteToken } from '@/lib/firebase';
import axios from 'axios';

const VAPID_KEY = "BKcDctPiH-WKLjyXh6RkJAl0S4vYWFe47m-Q0aHbmHkBgX1hhf5DhZjrYMyclPEW1vk9LvHoHnltavn6Iv2by8w";

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
        const registration = await registerServiceWorker();

        // Ensure SW is up to date
        if (registration && registration.update) {
            await registration.update();
        }

        // Check if permission granted
        if (Notification.permission !== 'granted') {
            const granted = await requestNotificationPermission();
            if (!granted) return null;
        }

        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration
        });

        if (token) {
            console.log('✅ FCM Token obtained:', token);

            // SPECIAL FIX: Force refresh ONCE if we suspect stuck token
            // This flag can be manually cleared or versioned if needed again
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
                    console.log('✅ [FCM Fix] New FRESH token obtained:', newToken);
                    localStorage.setItem(REFRESH_FIX_KEY, 'true');
                    return newToken;
                } catch (refreshError) {
                    console.warn('⚠️ [FCM Fix] Failed to force refresh, using original token:', refreshError);
                }
            }
            return token;
        } else {
            console.log('❌ No FCM token available');
            return null;
        }
    } catch (error) {
        console.error('❌ Error getting FCM token:', error);
        // Don't throw to avoid crashing app init
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
            'delivery': '/api/delivery/auth/fcm-token'
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

// Setup foreground notification handler
function setupForegroundNotificationHandler(handler) {
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
                tag: payload.data?.orderId // Prevent multiple notifications for same order
            });
        }

        // Call custom handler
        if (handler) {
            handler(payload);
        }
    });
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

export {
    initializePushNotifications,
    registerFCMToken,
    setupForegroundNotificationHandler,
    requestNotificationPermission,
    getFCMToken,
    getPlatform
};

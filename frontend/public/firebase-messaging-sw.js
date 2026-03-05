
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyDNxKR0YBWxL3HNvUADO4QFWD99spZpzCs",
    authDomain: "bakalaa-8f5c2.firebaseapp.com",
    projectId: "bakalaa-8f5c2",
    storageBucket: "bakalaa-8f5c2.firebasestorage.app",
    messagingSenderId: "411950794141",
    appId: "1:411950794141:web:16997299bfa32af55a1b74",
    measurementId: "G-TQVDSX2Z02"
};

// Simple version tag to help with debugging SW updates (no behavior change)
const SW_VERSION = 'v1-cache-safe';

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Function to play notification sound using Web Audio API
async function playNotificationSound() {
    try {
        // Audio file path - must be accessible from service worker
        const audioUrl = '/audio/alert.mp3';

        console.log('🔊 [SW] Attempting to play notification sound:', audioUrl);

        // Fetch the audio file
        const response = await fetch(audioUrl);
        if (!response.ok) {
            console.warn('[SW] Could not fetch audio file:', response.status);
            return;
        }

        const arrayBuffer = await response.arrayBuffer();

        // Create AudioContext and decode audio
        const audioContext = new (self.AudioContext || self.webkitAudioContext)();

        // Resume AudioContext if suspended (required for some browsers)
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Create source and play
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        // Play the sound
        source.start(0);

        console.log('✅ [SW] Notification sound played successfully');

        // Clean up after playback
        source.onended = () => {
            try {
                audioContext.close();
            } catch (e) {
                // Ignore errors during cleanup
            }
        };

    } catch (error) {
        console.warn('[SW] Could not play notification sound:', error);
        // Fallback: The notification's built-in sound property will handle it
    }
}

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Received background message:', payload);

    // Play sound for new order notifications (even when app is closed)
    const isNewOrder = payload.data?.type === 'new_order' || payload.data?.orderId;
    if (isNewOrder) {
        console.log('🔔 [SW] New order notification received - will play sound');
        playNotificationSound();
    }

    // If payload has notification object, the browser will show it automatically.
    // We don't need to call showNotification here to avoid double notifications.
    // However, we still want to play the sound, which we already did above.
    if (payload.notification) {
        console.log('[SW] Payload has notification object, browser will show it automatically');
        // Sound is already played above for new orders
        // The notification sound property in webpush will also trigger browser sound
        return;
    }

    const title = payload.data?.title || 'Bakala Update';
    const body = payload.data?.body || '';
    const tag = payload.data?.tag || payload.data?.orderId || 'admin_broadcast';

    // Icon and Image needs to be absolute URLs for maximum compatibility
    const icon = payload.data?.icon || '/bakalalogo.png';
    const image = payload.data?.image || null;
    const sound = payload.data?.sound || (isNewOrder ? '/audio/alert.mp3' : null);

    const notificationOptions = {
        body: body,
        icon: icon,
        image: image,
        data: payload.data,
        tag: tag, // THIS IS KEY FOR DEDUPLICATION
        badge: '/bakalalogo.png',
        requireInteraction: true,
        vibrate: [200, 100, 200]
    };

    // Add sound if available
    if (sound) {
        notificationOptions.sound = sound;
    }

    console.log(`🔔 [SW] Displaying manual notification: ${title} (Tag: ${tag})`);
    return self.registration.showNotification(title, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.notification.tag);
    event.notification.close();

    const data = event.notification.data;
    // Link can be in data.click_action or data.link
    const urlToOpen = data?.link || data?.click_action || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if there's already a window matching URL
            for (const client of clientList) {
                if (urlToOpen.includes(client.url) && 'focus' in client) {
                    return client.focus();
                }
            }
            // If no window match, open new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Make SW updates activate immediately and take control,
// without touching cookies, localStorage, or adding any caching logic.
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        self.clients.claim().then(() => {
            console.log('[SW] Activated firebase-messaging-sw.js', SW_VERSION);
        })
    );
});

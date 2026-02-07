
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyDqWg8g4sxwElZ12nxVLjUe7wqCnSuDV3g",
    authDomain: "bakala-ed61d.firebaseapp.com",
    projectId: "bakala-ed61d",
    storageBucket: "bakala-ed61d.firebasestorage.app",
    messagingSenderId: "41650386026",
    appId: "1:41650386026:web:495621e0f3e2424332c613",
    measurementId: "G-S49CP0DW74"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Received background message:', payload);

    // If payload has notification object, the browser will show it automatically.
    // If we call showNotification here, it will result in double notifications.
    if (payload.notification) {
        console.log('[SW] Payload has notification object, let browser handle automatically');
        return;
    }

    const title = payload.data?.title || 'Bakala Update';
    const body = payload.data?.body || '';
    const tag = payload.data?.tag || payload.data?.orderId || 'admin_broadcast';

    // Icon and Image needs to be absolute URLs for maximum compatibility
    const icon = payload.data?.icon || '/bakalalogo.png';
    const image = payload.data?.image || null;

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

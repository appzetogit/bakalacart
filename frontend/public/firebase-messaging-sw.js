
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

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message', payload);

    const notificationTitle = payload.notification?.title || 'Bakala Order Update';
    const notificationOptions = {
        body: payload.notification?.body || '',
        icon: payload.data?.icon || '/bakalalogo.png',
        data: payload.data,
        tag: payload.data?.tag || payload.data?.orderId // Prevent multiple notifications for same order/message
    };

    console.log(`[firebase-messaging-sw.js] Showing background notification for: ${notificationTitle}`);
    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const data = event.notification.data;
    const urlToOpen = data?.link || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if there's already a window matching URL
            for (const client of clientList) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // If no window match, open new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        }).catch(err => {
            console.error('[firebase-messaging-sw.js] Error handling notification click:', err);
        })
    );
});

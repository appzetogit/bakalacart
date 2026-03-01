import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '@/lib/api/config';
import alertSound from '@/assets/audio/alert.mp3'; // Using a distinct sound for admin

/**
 * Hook for Admin to receive real-time order notifications with sound
 */
export const useAdminNotifications = () => {
    const socketRef = useRef(null);
    const [newOrder, setNewOrder] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const audioRef = useRef(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Normalize backend URL (removing /api)
        let backendUrl = API_BASE_URL.replace(/\/api\/?$/, '');
        backendUrl = backendUrl.replace(/\/+$/, '');

        const socketUrl = `${backendUrl}/admin`;

        console.log('🔌 Admin connecting to Socket.IO:', socketUrl);

        socketRef.current = io(socketUrl, {
            path: '/socket.io/',
            transports: ['polling', 'websocket'],
            reconnection: true,
            auth: {
                token: localStorage.getItem('admin_accessToken') || localStorage.getItem('accessToken')
            }
        });

        socketRef.current.on('connect', () => {
            console.log('✅ Admin Socket connected:', socketRef.current.id);
            setIsConnected(true);
            setError(null);

            // Join admin room
            socketRef.current.emit('join-admin');
        });

        socketRef.current.on('admin-room-joined', (data) => {
            console.log('✅ Admin joined room:', data.room);
        });

        socketRef.current.on('connect_error', (err) => {
            console.error('❌ Admin Socket connection error:', err.message);
            setError(err.message);
            setIsConnected(false);
        });

        socketRef.current.on('new_order', (orderData) => {
            console.log('👑 Admin: New order notification received:', orderData);
            setNewOrder(orderData);
            playNotificationSound();
        });

        socketRef.current.on('play_notification_sound', (data) => {
            playNotificationSound();
        });

        // Initialize audio
        audioRef.current = new Audio(alertSound);
        audioRef.current.volume = 0.8;

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    const playNotificationSound = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(err => {
                // Silently catch autoplay errors
                console.warn('Autoplay blocked sound:', err.message);
            });
        }
    };

    const clearNewOrder = () => {
        setNewOrder(null);
    };

    return {
        newOrder,
        clearNewOrder,
        isConnected,
        error,
        playNotificationSound
    };
};

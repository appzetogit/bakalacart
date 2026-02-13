import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '@/lib/api/config';
import { deliveryAPI } from '@/lib/api';
import alertSound from '@/assets/audio/alert.mp3';
import originalSound from '@/assets/audio/original.mp3';

export const useDeliveryNotifications = () => {
  // CRITICAL: All hooks must be called unconditionally and in the same order every render
  // Order: useRef -> useState -> useEffect -> useCallback
  
  // Step 1: All refs first (unconditional)
  const socketRef = useRef(null);
  const audioRef = useRef(null);
  
  // Step 2: All state hooks (unconditional)
  const [newOrder, setNewOrder] = useState(null);
  const [orderReady, setOrderReady] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [deliveryPartnerId, setDeliveryPartnerId] = useState(null);

  // Step 3: All callbacks before effects (unconditional)
  // Track user interaction for autoplay policy
  const userInteractedRef = useRef(false);
  
  const playNotificationSound = useCallback(() => {
    try {
      // Check if running in Flutter InAppWebView (mobile APK)
      const isFlutterWebView = typeof window !== 'undefined' && 
        (window.flutter_inappwebview || navigator.userAgent.includes('wv'))
      
      // Always get fresh selected sound preference from localStorage
      const selectedSound = localStorage.getItem('delivery_alert_sound') || 'zomato_tone';
      const soundFile = selectedSound === 'original' ? originalSound : alertSound;
      
      console.log('🔊 Playing notification sound:', {
        selectedSound,
        soundType: selectedSound === 'original' ? 'Original' : 'Zomato Tone',
        soundFile,
        isFlutterWebView,
        userInteracted: userInteractedRef.current
      });
      
      // Always create a new Audio instance to ensure we use the selected sound
      // This ensures the selected sound is always used, even if preference changed
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      // Create new audio with selected sound
      audioRef.current = new Audio(soundFile);
      audioRef.current.volume = 1.0; // Full volume for notifications
      audioRef.current.loop = true; // Loop the sound for new order notifications
      
      // In mobile APK, always allow sound (Flutter handles permissions)
      // In browser, require user interaction due to autoplay policy
      if (!isFlutterWebView && !userInteractedRef.current) {
        console.log('🔇 Audio playback skipped - user has not interacted with page yet');
        return;
      }
      
      // For mobile APK, mark as interacted to allow sound playback
      if (isFlutterWebView) {
        userInteractedRef.current = true;
        console.log('📱 Mobile APK detected - allowing sound playback without user interaction');
      }
      
      // Try Flutter sound handler first (if available)
      if (isFlutterWebView && window.flutter_inappwebview?.callHandler) {
        try {
          console.log('📱 Attempting to play sound via Flutter handler');
          window.flutter_inappwebview.callHandler('playNotificationSound', {
            soundType: selectedSound === 'original' ? 'original' : 'alert',
            loop: true
          }).catch(err => {
            console.warn('⚠️ Flutter sound handler failed, using fallback:', err);
          });
        } catch (flutterError) {
          console.warn('⚠️ Flutter sound handler error, using fallback:', flutterError);
        }
      }
      
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('✅ Notification sound started playing successfully');
        }).catch(error => {
          // Don't log autoplay policy errors as they're expected in browser
          if (!error.message?.includes('user didn\'t interact') && 
              !error.name?.includes('NotAllowedError') &&
              !isFlutterWebView) {
            console.warn('Error playing notification sound:', error);
          } else if (isFlutterWebView) {
            // In mobile APK, this shouldn't fail, but log if it does
            console.error('❌ Sound playback failed in mobile APK:', error);
          }
        });
      }
    } catch (error) {
      // Don't log autoplay policy errors
      const isFlutterWebView = typeof window !== 'undefined' && 
        (window.flutter_inappwebview || navigator.userAgent.includes('wv'))
      
      if (!error.message?.includes('user didn\'t interact') && 
          !error.name?.includes('NotAllowedError') &&
          !isFlutterWebView) {
        console.warn('Error playing sound:', error);
      } else if (isFlutterWebView) {
        console.error('❌ Sound playback error in mobile APK:', error);
      }
    }
  }, []);

  // Step 4: All effects (unconditional hook calls, conditional logic inside)
  // Track user interaction for autoplay policy
  useEffect(() => {
    // Check if running in Flutter InAppWebView (mobile APK)
    const isFlutterWebView = typeof window !== 'undefined' && 
      (window.flutter_inappwebview || navigator.userAgent.includes('wv'))
    
    // In mobile APK, mark as interacted immediately (Flutter handles permissions)
    // This allows sound to play even when app is in foreground
    if (isFlutterWebView) {
      userInteractedRef.current = true;
      console.log('📱 Mobile APK detected - sound playback enabled without user interaction');
      return; // No need to listen for user interaction in mobile APK
    }
    
    const handleUserInteraction = () => {
      userInteractedRef.current = true;
      console.log('👆 User interaction detected - sound playback enabled');
      // Remove listeners after first interaction
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
    
    // Listen for user interaction (browser only)
    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });
    
    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, []);
  
  // Initialize audio on mount - use selected preference from localStorage
  useEffect(() => {
    // Get selected alert sound preference from localStorage
    const selectedSound = localStorage.getItem('delivery_alert_sound') || 'zomato_tone';
    const soundFile = selectedSound === 'original' ? originalSound : alertSound;
    
    if (!audioRef.current) {
      audioRef.current = new Audio(soundFile);
      audioRef.current.volume = 0.7;
      console.log('🔊 Audio initialized with:', selectedSound === 'original' ? 'Original' : 'Zomato Tone');
    } else {
      // Update audio source if preference changed
      const currentSrc = audioRef.current.src;
      const newSrc = soundFile;
      if (!currentSrc.includes(newSrc.split('/').pop())) {
        audioRef.current.pause();
        audioRef.current.src = newSrc;
        audioRef.current.load();
        console.log('🔊 Audio updated to:', selectedSound === 'original' ? 'Original' : 'Zomato Tone');
      }
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []); // Note: This runs once on mount. To update dynamically, we'd need to listen to storage events

  // Fetch delivery partner ID
  useEffect(() => {
    const fetchDeliveryPartnerId = async () => {
      try {
        const response = await deliveryAPI.getCurrentDelivery();
        if (response.data?.success && response.data.data) {
          const deliveryPartner = response.data.data.user || response.data.data.deliveryPartner;
          if (deliveryPartner) {
            const id = deliveryPartner.id?.toString() || 
                      deliveryPartner._id?.toString() || 
                      deliveryPartner.deliveryId;
            if (id) {
              setDeliveryPartnerId(id);
              console.log('✅ Delivery Partner ID fetched:', id);
            } else {
              console.warn('⚠️ Could not extract delivery partner ID from response');
            }
          } else {
            console.warn('⚠️ No delivery partner data in API response');
          }
        } else {
          console.warn('⚠️ Could not fetch delivery partner ID from API');
        }
      } catch (error) {
        console.error('Error fetching delivery partner:', error);
      }
    };
    fetchDeliveryPartnerId();
  }, []);

  // Socket connection effect
  useEffect(() => {
    if (!deliveryPartnerId) {
      console.log('⏳ Waiting for deliveryPartnerId...');
      return;
    }

    // Normalize backend URL - use simpler, more robust approach
    let backendUrl = API_BASE_URL;
    
    // Step 1: Extract protocol and hostname using URL parsing if possible
    try {
      const urlObj = new URL(backendUrl);
      // Remove /api from pathname
      let pathname = urlObj.pathname.replace(/^\/api\/?$/, '');
      // Reconstruct clean URL
      backendUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? `:${urlObj.port}` : ''}${pathname}`;
    } catch (e) {
      // If URL parsing fails, use regex-based normalization
      // Remove /api suffix first
      backendUrl = backendUrl.replace(/\/api\/?$/, '');
      backendUrl = backendUrl.replace(/\/+$/, ''); // Remove trailing slashes
      
      // Normalize protocol - ensure exactly two slashes after protocol
      // Fix patterns: https:/, https:///, https://https://
      if (backendUrl.startsWith('https:') || backendUrl.startsWith('http:')) {
        // Extract protocol
        const protocolMatch = backendUrl.match(/^(https?):/i);
        if (protocolMatch) {
          const protocol = protocolMatch[1].toLowerCase();
          // Remove everything up to and including the first valid domain part
          const afterProtocol = backendUrl.substring(protocol.length + 1);
          // Remove leading slashes
          const cleanPath = afterProtocol.replace(/^\/+/, '');
          // Reconstruct with exactly two slashes
          backendUrl = `${protocol}://${cleanPath}`;
        }
      }
    }
    
    // Final cleanup: ensure exactly two slashes after protocol
    backendUrl = backendUrl.replace(/^(https?):\/+/gi, '$1://');
    backendUrl = backendUrl.replace(/\/+$/, ''); // Remove trailing slashes
    
    const socketUrl = `${backendUrl}/delivery`;
    
    console.log('🔌 Attempting to connect to Delivery Socket.IO:', socketUrl);
    console.log('🔌 Backend URL:', backendUrl);
    console.log('🔌 API_BASE_URL:', API_BASE_URL);
    console.log('🔌 Delivery Partner ID:', deliveryPartnerId);
    console.log('🔌 Environment:', import.meta.env.MODE);
    
    // Warn if trying to connect to localhost in production
    if (import.meta.env.MODE === 'production' && backendUrl.includes('localhost')) {
      console.error('❌ CRITICAL: Trying to connect Socket.IO to localhost in production!');
      console.error('💡 This means VITE_API_BASE_URL was not set during build time');
      console.error('💡 Current socketUrl:', socketUrl);
      console.error('💡 Current API_BASE_URL:', API_BASE_URL);
      console.error('💡 Fix: Rebuild frontend with: VITE_API_BASE_URL=https://your-backend-domain.com/api npm run build');
      console.error('💡 Note: Vite environment variables are embedded at BUILD TIME, not runtime');
      console.error('💡 You must rebuild and redeploy the frontend with correct VITE_API_BASE_URL');
      
      // Don't try to connect to localhost in production - it will fail
      setIsConnected(false);
      return;
    }
    
    // Validate backend URL format
    if (!backendUrl || !backendUrl.startsWith('http')) {
      console.error('❌ CRITICAL: Invalid backend URL format:', backendUrl);
      console.error('💡 API_BASE_URL:', API_BASE_URL);
      console.error('💡 Expected format: https://your-domain.com or http://localhost:5000');
      return; // Don't try to connect with invalid URL
    }
    
    // Validate socket URL format
    try {
      new URL(socketUrl); // This will throw if URL is invalid
    } catch (urlError) {
      console.error('❌ CRITICAL: Invalid Socket.IO URL:', socketUrl);
      console.error('💡 URL validation error:', urlError.message);
      console.error('💡 Backend URL:', backendUrl);
      console.error('💡 API_BASE_URL:', API_BASE_URL);
      return; // Don't try to connect with invalid URL
    }

    socketRef.current = io(socketUrl, {
      path: '/socket.io/',
      transports: ['polling'], // Start with polling only
      upgrade: false, // Disable WebSocket upgrade to prevent WebSocket connection errors
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      forceNew: false,
      autoConnect: true,
      auth: {
        token: localStorage.getItem('delivery_accessToken') || localStorage.getItem('accessToken')
      }
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Delivery Socket connected, deliveryPartnerId:', deliveryPartnerId);
      setIsConnected(true);
      
      if (deliveryPartnerId) {
        console.log('📢 Joining delivery room with ID:', deliveryPartnerId);
        socketRef.current.emit('join-delivery', deliveryPartnerId);
      }
    });

    socketRef.current.on('delivery-room-joined', (data) => {
      console.log('✅ Delivery room joined successfully:', data);
    });

    socketRef.current.on('connect_error', (error) => {
      // Only log if it's not a network/polling/websocket error (backend might be down or WebSocket not available)
      // Socket.IO will automatically retry connection and fall back to polling
      const isTransportError = error.type === 'TransportError' || 
                               error.message === 'xhr poll error' ||
                               error.message?.includes('WebSocket') ||
                               error.message?.includes('websocket') ||
                               error.description === 0; // WebSocket upgrade failures
      
      if (!isTransportError) {
        console.error('❌ Delivery Socket connection error:', error);
      } else {
        // Silently handle transport errors - backend might not be running or WebSocket not available
        // Socket.IO will automatically retry with exponential backoff and fall back to polling
        // Only log in development for debugging
        if (process.env.NODE_ENV === 'development') {
          console.log('⏳ Delivery Socket: WebSocket upgrade failed, using polling fallback');
        }
      }
      setIsConnected(false);
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('❌ Delivery Socket disconnected:', reason);
      setIsConnected(false);
      
      if (reason === 'io server disconnect') {
        socketRef.current.connect();
      }
    });

    socketRef.current.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
    });

    socketRef.current.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      
      if (deliveryPartnerId) {
        socketRef.current.emit('join-delivery', deliveryPartnerId);
      }
    });

    socketRef.current.on('new_order', (orderData) => {
      console.log('📦 New order received via socket:', orderData);
      console.log('🔊 Triggering sound notification for new order');
      setNewOrder(orderData);
      // Play sound immediately when order is assigned (even in foreground)
      // For mobile APK, this will work without user interaction
      setTimeout(() => {
        playNotificationSound();
      }, 100); // Small delay to ensure state is set
    });

    // Listen for priority-based order notifications (new_order_available)
    socketRef.current.on('new_order_available', (orderData) => {
      console.log('📦 New order available (priority notification):', orderData);
      console.log('📦 Notification phase:', orderData.phase || 'unknown');
      console.log('🔊 Triggering sound notification for new order available');
      // Treat it the same as new_order for now - delivery boy can accept it
      setNewOrder(orderData);
      // Play sound immediately when order is assigned (even in foreground)
      setTimeout(() => {
        playNotificationSound();
      }, 100); // Small delay to ensure state is set
    });

    socketRef.current.on('play_notification_sound', (data) => {
      console.log('🔔 Sound notification:', data);
      playNotificationSound();
    });

    socketRef.current.on('order_ready', (orderData) => {
      console.log('✅ Order ready notification received via socket:', orderData);
      setOrderReady(orderData);
      playNotificationSound();
    });

    // Close socket on pagehide for bfcache compatibility
    const handlePageHide = () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [deliveryPartnerId, playNotificationSound]);

  // Helper functions
  const clearNewOrder = () => {
    setNewOrder(null);
  };

  const clearOrderReady = () => {
    setOrderReady(null);
  };

  return {
    newOrder,
    clearNewOrder,
    orderReady,
    clearOrderReady,
    isConnected,
    playNotificationSound
  };
};

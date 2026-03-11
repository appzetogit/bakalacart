import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '@/lib/api/config';
import { deliveryAPI } from '@/lib/api';
import alertSound from '@/assets/audio/delivery aacept ringtone.mp3';
import originalSound from '@/assets/audio/delivery aacept ringtone.mp3';

const isDev = import.meta.env.DEV;
const devLog = (...args) => {
  if (!isDev) return;
  // Use console.log to avoid recursive self-calls
  // eslint-disable-next-line no-console
  console.log('[DeliveryNotifications]', ...args);
};
const devWarn = (...args) => {
  if (!isDev) return;
  // eslint-disable-next-line no-console
  console.warn('[DeliveryNotifications]', ...args);
};

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

      devLog('🔊 Playing notification sound:', {
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

      // For mobile APK, use public path (more reliable than import path)
      // Public path: /audio/alert.mp3 (original.mp3 might not be in public, use alert as fallback)
      const publicPath = '/audio/alert.mp3'; // Always use alert.mp3 from public folder for mobile APK
      // For browser, try import path first, fallback to public
      let audioSrc = isFlutterWebView ? publicPath : soundFile;

      // If import path is a blob URL or data URL, use it directly
      // Otherwise, for mobile APK, always use public path
      if (isFlutterWebView) {
        // Use absolute URL for mobile APK to ensure it resolves correctly
        const baseUrl = window.location.origin;
        audioSrc = `${baseUrl}${publicPath}`;
        devLog('📱 Mobile APK - using absolute URL:', audioSrc);
      }

      devLog('🔊 Creating audio with source:', {
        audioSrc,
        isFlutterWebView,
        selectedSound,
        importPath: soundFile,
        publicPath: publicPath
      });

      // Create new audio with selected sound
      audioRef.current = new Audio(audioSrc);
      audioRef.current.volume = 1.0; // Full volume for notifications
      audioRef.current.loop = true; // Loop the sound for new order notifications
      audioRef.current.preload = 'auto'; // Preload for faster playback

      // Add comprehensive error handling
      audioRef.current.addEventListener('error', (e) => {
        console.error('❌ Audio load error:', {
          code: audioRef.current?.error?.code,
          message: audioRef.current?.error?.message,
          src: audioRef.current?.src,
          readyState: audioRef.current?.readyState
        });

        // Try fallback public path if import path failed (for browser)
        if (!isFlutterWebView && audioSrc === soundFile) {
          devLog('🔄 Trying fallback public path:', publicPath);
          const fallbackAudio = new Audio(publicPath);
          fallbackAudio.volume = 1.0;
          fallbackAudio.loop = true;
          fallbackAudio.preload = 'auto';

          fallbackAudio.addEventListener('canplaythrough', () => {
            devLog('✅ Fallback audio ready, playing...');
            fallbackAudio.currentTime = 0;
            fallbackAudio.play().catch(err => {
              console.error('❌ Fallback audio play failed:', err);
            });
          });

          fallbackAudio.addEventListener('error', (err) => {
            console.error('❌ Fallback audio also failed:', err);
          });

          fallbackAudio.load();
          audioRef.current = fallbackAudio;
        }
      });

      // Add success handlers
      audioRef.current.addEventListener('loadeddata', () => {
        devLog('✅ Audio file loaded successfully');
      });

      audioRef.current.addEventListener('canplay', () => {
        devLog('✅ Audio can play');
      });

      // In mobile APK, always allow sound (Flutter handles permissions)
      // In browser, require user interaction due to autoplay policy
      if (!isFlutterWebView && !userInteractedRef.current) {
        devLog('🔇 Audio playback skipped - user has not interacted with page yet');
        return;
      }

      // For mobile APK, mark as interacted to allow sound playback
      if (isFlutterWebView) {
        userInteractedRef.current = true;
        devLog('📱 Mobile APK detected - allowing sound playback without user interaction');
      }

      // Try Flutter sound handler first (if available)
      if (isFlutterWebView && window.flutter_inappwebview?.callHandler) {
        try {
          devLog('📱 Attempting to play sound via Flutter handler');
          window.flutter_inappwebview.callHandler('playNotificationSound', {
            soundType: selectedSound === 'original' ? 'original' : 'alert',
            loop: true
          }).catch(err => {
            devWarn('⚠️ Flutter sound handler failed, using fallback:', err);
          });
        } catch (flutterError) {
          devWarn('⚠️ Flutter sound handler error, using fallback:', flutterError);
        }
      }

      // Function to play audio
      const playAudio = () => {
        if (!audioRef.current) {
          devWarn('⚠️ Audio ref is null, cannot play');
          return;
        }

        devLog('🎵 Attempting to play audio...', {
          readyState: audioRef.current.readyState,
          src: audioRef.current.src,
          volume: audioRef.current.volume,
          loop: audioRef.current.loop,
          paused: audioRef.current.paused
        });

        try {
          audioRef.current.currentTime = 0;
          const playPromise = audioRef.current.play();

          if (playPromise !== undefined) {
            playPromise.then(() => {
              devLog('✅ Notification sound started playing successfully');
              // Verify it's actually playing
              setTimeout(() => {
                if (audioRef.current) {
                  devLog('🔊 Audio playback status:', {
                    paused: audioRef.current.paused,
                    currentTime: audioRef.current.currentTime,
                    duration: audioRef.current.duration,
                    volume: audioRef.current.volume
                  });
                }
              }, 500);
            }).catch(error => {
              // Don't log autoplay policy errors as they're expected in browser
              if (!error.message?.includes('user didn\'t interact') &&
                !error.name?.includes('NotAllowedError') &&
                !isFlutterWebView) {
                devWarn('Error playing notification sound:', error);
              } else if (isFlutterWebView) {
                // In mobile APK, this shouldn't fail, but log if it does
                console.error('❌ Sound playback failed in mobile APK:', error);
                console.error('❌ Error details:', {
                  name: error.name,
                  message: error.message,
                  stack: error.stack
                });
              }
            });
          }
        } catch (err) {
          console.error('❌ Exception while playing audio:', err);
        }
      };

      // Try to play when audio is ready
      if (audioRef.current.readyState >= 2) {
        // Audio already loaded
        devLog('✅ Audio already loaded, playing immediately');
        playAudio();
      } else {
        // Wait for audio to load
        devLog('⏳ Waiting for audio to load...');

        const onCanPlay = () => {
          devLog('✅ Audio can play, starting playback');
          playAudio();
        };

        audioRef.current.addEventListener('canplaythrough', onCanPlay, { once: true });
        audioRef.current.addEventListener('canplay', onCanPlay, { once: true });
        audioRef.current.addEventListener('loadeddata', () => {
          devLog('✅ Audio data loaded');
          // Try to play if ready
          if (audioRef.current.readyState >= 2) {
            playAudio();
          }
        }, { once: true });

        // Load the audio
        audioRef.current.load();

        // Fallback: try to play after delays (for mobile APK)
        setTimeout(() => {
          if (audioRef.current && audioRef.current.readyState >= 2) {
            devLog('🔄 Fallback: Audio ready after delay, playing...');
            playAudio();
          } else if (audioRef.current) {
            devWarn('⚠️ Audio not ready after 500ms, readyState:', audioRef.current.readyState);
          }
        }, 500);

        // Second fallback for mobile APK
        if (isFlutterWebView) {
          setTimeout(() => {
            if (audioRef.current && !audioRef.current.paused === false) {
              devLog('🔄 Mobile APK fallback: Force playing audio...');
              playAudio();
            }
          }, 1000);
        }
      }
    } catch (error) {
      // Don't log autoplay policy errors
      const isFlutterWebView = typeof window !== 'undefined' &&
        (window.flutter_inappwebview || navigator.userAgent.includes('wv'))

      if (!error.message?.includes('user didn\'t interact') &&
        !error.name?.includes('NotAllowedError') &&
        !isFlutterWebView) {
        devWarn('Error playing sound:', error);
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
      devLog('📱 Mobile APK detected - sound playback enabled without user interaction');
      return; // No need to listen for user interaction in mobile APK
    }

    const handleUserInteraction = () => {
      userInteractedRef.current = true;
      devLog('👆 User interaction detected - sound playback enabled');
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
      devLog('🔊 Audio initialized with:', selectedSound === 'original' ? 'Original' : 'Zomato Tone');
    } else {
      // Update audio source if preference changed
      const currentSrc = audioRef.current.src;
      const newSrc = soundFile;
      if (!currentSrc.includes(newSrc.split('/').pop())) {
        audioRef.current.pause();
        audioRef.current.src = newSrc;
        audioRef.current.load();
        devLog('🔊 Audio updated to:', selectedSound === 'original' ? 'Original' : 'Zomato Tone');
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
              devLog('✅ Delivery Partner ID fetched:', id);
            } else {
              devWarn('⚠️ Could not extract delivery partner ID from response');
            }
          } else {
            devWarn('⚠️ No delivery partner data in API response');
          }
        } else {
          devWarn('⚠️ Could not fetch delivery partner ID from API');
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
      devLog('⏳ Waiting for deliveryPartnerId...');
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

    devLog('🔌 Attempting to connect to Delivery Socket.IO:', socketUrl);
    devLog('🔌 Backend URL:', backendUrl);
    devLog('🔌 API_BASE_URL:', API_BASE_URL);
    devLog('🔌 Delivery Partner ID:', deliveryPartnerId);
    devLog('🔌 Environment:', import.meta.env.MODE);

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
      devLog('✅ Delivery Socket connected, deliveryPartnerId:', deliveryPartnerId);
      setIsConnected(true);

      if (deliveryPartnerId) {
        devLog('📢 Joining delivery room with ID:', deliveryPartnerId);
        socketRef.current.emit('join-delivery', deliveryPartnerId);
      }
    });

    socketRef.current.on('delivery-room-joined', (data) => {
      devLog('✅ Delivery room joined successfully:', data);
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
          devLog('⏳ Delivery Socket: WebSocket upgrade failed, using polling fallback');
        }
      }
      setIsConnected(false);
    });

    socketRef.current.on('disconnect', (reason) => {
      devLog('❌ Delivery Socket disconnected:', reason);
      setIsConnected(false);

      if (reason === 'io server disconnect') {
        socketRef.current.connect();
      }
    });

    socketRef.current.on('reconnect_attempt', (attemptNumber) => {
      devLog(`🔄 Reconnection attempt ${attemptNumber}...`);
    });

    socketRef.current.on('reconnect', (attemptNumber) => {
      devLog(`✅ Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);

      if (deliveryPartnerId) {
        socketRef.current.emit('join-delivery', deliveryPartnerId);
      }
    });

    socketRef.current.on('new_order', (orderData) => {
      devLog('📦 New order received via socket:', orderData);
      devLog('🔊 Triggering sound notification for new order');
      setNewOrder(orderData);
      // Play sound immediately when order is assigned (even in foreground)
      // For mobile APK, this will work without user interaction
      setTimeout(() => {
        playNotificationSound();
      }, 100); // Small delay to ensure state is set
    });

    // Listen for priority-based order notifications (new_order_available)
    socketRef.current.on('new_order_available', (orderData) => {
      devLog('📦 New order available (priority notification):', orderData);
      devLog('📦 Notification phase:', orderData.phase || 'unknown');
      devLog('🔊 Triggering sound notification for new order available');
      // Treat it the same as new_order for now - delivery boy can accept it
      setNewOrder(orderData);
      // Play sound immediately when order is assigned (even in foreground)
      setTimeout(() => {
        playNotificationSound();
      }, 100); // Small delay to ensure state is set
    });

    socketRef.current.on('play_notification_sound', (data) => {
      devLog('🔔 Sound notification:', data);
      playNotificationSound();
    });

    socketRef.current.on('order_ready', (orderData) => {
      devLog('✅ Order ready notification received via socket:', orderData);
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

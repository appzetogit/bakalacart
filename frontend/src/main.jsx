// CRITICAL FIX: Import React explicitly first to ensure proper initialization order
// This prevents "Cannot access 'React' before initialization" errors
import React from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.jsx'

// Global flag to track Google Maps loading state
window.__googleMapsLoading = window.__googleMapsLoading || false;
window.__googleMapsLoaded = window.__googleMapsLoaded || false;

// Defer all non-critical initialization until after React renders
// This prevents blocking the initial render
const initializeNonCriticalFeatures = () => {
  // Use requestIdleCallback if available, otherwise setTimeout
  const defer = (callback) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(callback, { timeout: 2000 })
    } else {
      setTimeout(callback, 0)
    }
  }

  // Load business settings (non-blocking, low priority)
  defer(() => {
    import('./lib/utils/businessSettings.js').then(({ loadBusinessSettings }) => {
      loadBusinessSettings().catch(() => {
        // Silently fail - settings will load when admin is authenticated
      })
    })
  })

  // Load Google Maps API (non-blocking, deferred)
  defer(() => {
    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      window.__googleMapsLoaded = true;
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      window.__googleMapsLoading = true;
      existingScript.addEventListener('load', () => {
        window.__googleMapsLoaded = true;
        window.__googleMapsLoading = false;
      });
      return;
    }

    // Check if Loader is already loading
    if (window.__googleMapsLoading) {
      return;
    }

    window.__googleMapsLoading = true;

    // Load Google Maps API key and script asynchronously
    import('./lib/utils/googleMapsApiKey.js').then(({ getGoogleMapsApiKey }) => {
      getGoogleMapsApiKey()
        .then((googleMapsApiKey) => {
          if (googleMapsApiKey) {
            const script = document.createElement('script')
            script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places,geometry,drawing`
            script.async = true
            script.defer = true
            script.onload = () => {
              window.__googleMapsLoaded = true;
              window.__googleMapsLoading = false;
            }
            script.onerror = () => {
              window.__googleMapsLoading = false;
            }
            document.head.appendChild(script)
          } else {
            window.__googleMapsLoading = false;
          }
        })
        .catch(() => {
          window.__googleMapsLoading = false;
        })
    })
  })

  // Initialize push notifications (non-blocking)
  defer(() => {
    import('./services/pushNotificationService.js').then(({ initializePushNotifications }) => {
      initializePushNotifications().catch(err => console.warn('Push notification error:', err));
    });
  });
}

// CRITICAL: Get root element first
const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

// CRITICAL: Apply theme IMMEDIATELY before any rendering to prevent blink
// This must happen synchronously before React renders
// CRITICAL: Flutter WebView optimization - set everything immediately
const savedTheme = localStorage.getItem('appTheme') || 'light'
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark')
  // Also set body and root background immediately to prevent white flash
  document.body.style.backgroundColor = '#0a0a0a'
  document.body.style.color = '#ffffff'
  document.body.style.opacity = '1'
  document.body.style.visibility = 'visible'
  rootElement.style.backgroundColor = '#0a0a0a'
  rootElement.style.opacity = '1'
  rootElement.style.visibility = 'visible'
  rootElement.style.display = 'block'
} else {
  document.documentElement.classList.remove('dark')
  // Set body and root background immediately to prevent white flash
  document.body.style.backgroundColor = '#ffffff'
  document.body.style.color = '#000000'
  document.body.style.opacity = '1'
  document.body.style.visibility = 'visible'
  rootElement.style.backgroundColor = '#ffffff'
  rootElement.style.opacity = '1'
  rootElement.style.visibility = 'visible'
  rootElement.style.display = 'block'
}

// CRITICAL: Ensure document is visible immediately for Flutter WebView
document.documentElement.style.opacity = '1'
document.documentElement.style.visibility = 'visible'

// Suppress browser extension errors (defer to avoid blocking render)
// Use requestIdleCallback or setTimeout to defer this setup
const setupErrorSuppression = () => {
  const originalError = console.error
  console.error = (...args) => {
    const errorStr = args.join(' ')

    // Suppress browser extension errors
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('chrome-extension://') ||
        args[0].includes('_$initialUrl') ||
        args[0].includes('_$onReInit') ||
        args[0].includes('_$bindListeners'))
    ) {
      return // Suppress browser extension errors
    }


    // Suppress geolocation errors (non-critical, will retry or use fallback)
    if (
      errorStr.includes('Timeout expired') ||
      errorStr.includes('GeolocationPositionError') ||
      errorStr.includes('Geolocation error') ||
      errorStr.includes('User denied Geolocation') ||
      errorStr.includes('permission denied') ||
      (errorStr.includes('code: 3') && errorStr.includes('location')) ||
      (errorStr.includes('code: 1') && errorStr.includes('location'))
    ) {
      return // Silently ignore geolocation errors (permission denied, timeout, etc.)
    }

    // Suppress duplicate network error messages (handled by axios interceptor with cooldown)
    // Check if any argument is an AxiosError with network error
    const hasNetworkError = args.some(arg => {
      if (arg && typeof arg === 'object') {
        // Check for AxiosError with ERR_NETWORK code
        if (arg.name === 'AxiosError' && (arg.code === 'ERR_NETWORK' || arg.message === 'Network Error')) {
          return true
        }
        // Check for error objects with network error message
        if (arg.message === 'Network Error' || arg.code === 'ERR_NETWORK') {
          return true
        }
      }
      return false
    })

    // If we have a network error object, suppress it regardless of the message prefix
    if (hasNetworkError) {
      // The axios interceptor already handles throttling and shows toast notifications
      return
    }

    // Check error string for network error patterns (for string-based error messages)
    if (
      errorStr.includes('🌐 Network Error') ||
      errorStr.includes('Network Error - Backend server may not be running') ||
      (errorStr.includes('ERR_NETWORK') && errorStr.includes('AxiosError')) ||
      errorStr.includes('💡 API Base URL:') ||
      errorStr.includes('💡 Backend URL:') ||
      errorStr.includes('💡 Start backend with:') ||
      errorStr.includes('💡 Check backend health:') ||
      errorStr.includes('💡 Make sure backend server is running:') ||
      errorStr.includes('❌ Backend not accessible at:') ||
      errorStr.includes('💡 Start backend:')
    ) {
      // Only show first occurrence, subsequent ones are suppressed
      // The axios interceptor already handles throttling
      return
    }

    // Suppress timeout errors (handled by axios interceptor)
    if (
      errorStr.includes('timeout of') ||
      errorStr.includes('ECONNABORTED') ||
      (errorStr.includes('AxiosError') && errorStr.includes('timeout'))
    ) {
      // Timeout errors are handled by axios interceptor with proper error handling
      return
    }

    // Suppress OTP verification errors (handled by UI error messages)
    if (
      errorStr.includes('OTP Verification Error:') ||
      (errorStr.includes('AxiosError') && errorStr.includes('Request failed with status code 403') && errorStr.includes('verify-otp'))
    ) {
      // OTP errors are already displayed to users via UI error messages
      return
    }

    // Suppress Restaurant Socket transport errors (handled by useRestaurantNotifications with throttled message)
    if (
      errorStr.includes('Restaurant Socket connection error') ||
      errorStr.includes('xhr poll error') ||
      (typeof args[0] === 'object' && args[0]?.type === 'TransportError' && args[0]?.message?.includes('xhr poll error'))
    ) {
      return
    }

    // Suppress Socket.IO WebSocket failed (backend unreachable; hook shows throttled message)
    if (errorStr.includes('WebSocket connection to') && errorStr.includes('socket.io') && errorStr.includes('failed')) {
      return
    }

    // Suppress React duplicate key warnings (keys are already handled with unique generation)
    if (
      errorStr.includes('Encountered two children with the same key') ||
      (errorStr.includes('Keys should be unique') && errorStr.includes('Non-unique keys'))
    ) {
      return // Suppress duplicate key warnings - keys are already handled properly
    }

    originalError.apply(console, args)
  }

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason || event
    const errorMsg = error?.message || String(error) || ''
    const errorName = error?.name || ''
    const errorStr = String(error) || ''

    // Suppress geolocation errors (permission denied, timeout, etc.)
    if (
      errorMsg.includes('Timeout expired') ||
      errorMsg.includes('User denied Geolocation') ||
      errorMsg.includes('permission denied') ||
      errorName === 'GeolocationPositionError' ||
      (error?.code === 3 && errorMsg.includes('timeout')) ||
      (error?.code === 1 && (errorMsg.includes('location') || errorMsg.includes('geolocation')))
    ) {
      event.preventDefault() // Prevent error from showing in console
      return
    }

    // Suppress refund processing errors that are already handled by the component
    // These errors are logged with console.error in the component's catch block
    if (
      errorStr.includes('Error processing refund') ||
      (errorName === 'AxiosError' && errorMsg.includes('refund'))
    ) {
      // Error is already handled by the component, just prevent unhandled rejection
      event.preventDefault()
      return
    }
  })
}

// Setup error suppression after initial render (non-blocking)
if ('requestIdleCallback' in window) {
  requestIdleCallback(setupErrorSuppression, { timeout: 1000 })
} else {
  setTimeout(setupErrorSuppression, 0)
}

// rootElement already defined above for theme setup

// Determine which router to use: HashRouter for Capacitor/Native, BrowserRouter for Web
// Improved detection for various mobile webview environments
const isNativeApp =
  !!window.Capacitor ||
  window.location.protocol === 'file:' ||
  window.location.protocol === 'capacitor:' ||
  window.location.protocol === 'ionic:' ||
  /Capacitor/i.test(navigator.userAgent) ||
  /Ionic/i.test(navigator.userAgent) ||
  // Catch Android/iOS webviews (wv is present in Chrome-based webviews for Android)
  /wv\)/i.test(navigator.userAgent) ||
  /WebView/i.test(navigator.userAgent) ||
  // Many local webview servers use localhost without a port or with a fixed port
  (window.location.hostname === 'localhost' && (window.location.port === '' || window.location.port === '8080' || window.location.port === '8100')) ||
  // Check for specialized bridges
  !!(window.webkit && window.webkit.messageHandlers) ||
  !!window.androidBridge ||
  !!window.AndroidBridge ||
  !!window.JSBridge;

// Log environment for troubleshooting - helps identify why refresh might be failing in webviews
if (import.meta.env.DEV) {
  console.log('[Router Type Detection]', {
    isNativeApp,
    protocol: window.location.protocol,
    pathname: window.location.pathname,
    hash: window.location.hash,
    userAgent: navigator.userAgent
  });
}

// Fix for mobile app refresh: Migrate pathname to hash if in native app and no hash exists
// This ensures that refreshing http://localhost/orders becomes http://localhost/#/orders
if (isNativeApp && !window.location.hash) {
  const currentPath = window.location.pathname;
  // If we have a path that isn't root, migrate it to hash
  if (currentPath !== '/' && currentPath !== '/index.html') {
    const cleanPath = currentPath.replace(/\/index\.html$/, '') || '/';
    const search = window.location.search;

    // Use replaceState to clear the pathname and then set the hash
    // This happens before React Router initialized, preventing double-renders
    window.history.replaceState({}, document.title, '/');
    window.location.hash = cleanPath + search;
  }
}

const Router = isNativeApp ? HashRouter : BrowserRouter;

// Render React immediately - don't wait for anything
// StrictMode disabled in production to reduce double renders and improve performance
const AppWrapper = import.meta.env.PROD ? (
  <Router>
    <App />
    <Toaster position="top-center" richColors offset="80px" />
  </Router>
) : (
  <StrictMode>
    <Router>
      <App />
      <Toaster position="top-center" richColors offset="80px" />
    </Router>
  </StrictMode>
)

// CRITICAL: Set root element visibility immediately before React renders
// This prevents Flutter WebView loading blink
// CRITICAL: Remove any placeholder content before React renders (if exists)
const placeholder = rootElement.querySelector('div[style*="placeholder"], div[style*="Placeholder"]')
if (placeholder) {
  placeholder.remove()
}

rootElement.style.opacity = '1'
rootElement.style.visibility = 'visible'
rootElement.style.display = 'block'
rootElement.style.backgroundColor = savedTheme === 'dark' ? '#0a0a0a' : '#ffffff'
document.body.style.opacity = '1'
document.body.style.visibility = 'visible'
document.documentElement.style.opacity = '1'
document.documentElement.style.visibility = 'visible'

createRoot(rootElement).render(AppWrapper)

// CRITICAL: Mark body as loaded after first render to enable transitions
// This prevents initial render blinks while allowing smooth transitions later
// Use multiple requestAnimationFrame calls to ensure it happens after all renders
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Only add loaded class after all initial renders are complete
      document.body.classList.add('loaded')
      // Ensure visibility is maintained
      document.body.style.opacity = '1'
      document.body.style.visibility = 'visible'
      rootElement.style.opacity = '1'
      rootElement.style.visibility = 'visible'
    })
  })
})

// Initialize non-critical features after React has rendered
// This ensures FCP and LCP are not blocked
initializeNonCriticalFeatures()

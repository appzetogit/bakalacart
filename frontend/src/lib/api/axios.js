import axios from 'axios';
import { toast } from 'sonner';
import { API_BASE_URL } from './config.js';
import { getRoleFromToken, clearModuleAuth } from '../utils/auth.js';

// Network error tracking to prevent spam
const networkErrorState = {
  lastErrorTime: 0,
  lastToastTime: 0,
  errorCount: 0,
  toastShown: false,
  COOLDOWN_PERIOD: 30000, // 30 seconds cooldown for console errors
  TOAST_COOLDOWN_PERIOD: 60000, // 60 seconds cooldown for toast notifications
};

// Validate API base URL on import
if (import.meta.env.DEV) {
  const backendUrl = API_BASE_URL.replace('/api', '');
  const frontendUrl = window.location.origin;

  if (API_BASE_URL.includes('5173') || backendUrl.includes('5173')) {
    console.error('❌ CRITICAL: API_BASE_URL is pointing to FRONTEND port (5173) instead of BACKEND port (5000)');
    console.error('💡 Current API_BASE_URL:', API_BASE_URL);
    console.error('💡 Frontend URL:', frontendUrl);
    console.error('💡 Backend should be at: http://localhost:5000');
    console.error('💡 Fix: Check .env file - VITE_API_BASE_URL should be http://localhost:5000/api');
  } else {
    console.log('✅ API_BASE_URL correctly points to backend:', API_BASE_URL);
    console.log('✅ Backend URL:', backendUrl);
    console.log('✅ Frontend URL:', frontendUrl);
  }
}

/**
 * Create axios instance with default configuration
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies for refresh token
});

/**
 * Get module information (token key, expected role, and refresh endpoint) based on a path
 * @param {string} path - URL path
 * @returns {Object} - Module info object
 */
function getModuleInfo(path) {
  // Normalize path by removing /api prefix if present for API calls
  const normalizedPath = path.startsWith('/api') ? path.substring(4) : path;

  if (normalizedPath.startsWith('/admin')) {
    return {
      tokenKey: 'admin_accessToken',
      expectedRole: 'admin',
      refreshEndpoint: '/admin/auth/refresh-token',
      loginPath: '/admin/login'
    };
  } else if (normalizedPath.startsWith('/restaurant') && !normalizedPath.startsWith('/restaurants') && !normalizedPath.startsWith('/restaurant/list') && !normalizedPath.startsWith('/restaurant/under-250')) {
    return {
      tokenKey: 'restaurant_accessToken',
      expectedRole: 'restaurant',
      refreshEndpoint: '/restaurant/auth/refresh-token',
      loginPath: '/restaurant/login'
    };
  } else if (normalizedPath.startsWith('/delivery')) {
    return {
      tokenKey: 'delivery_accessToken',
      expectedRole: 'delivery',
      refreshEndpoint: '/delivery/auth/refresh-token',
      loginPath: '/delivery/sign-in'
    };
  } else {
    // Default to user module for all other paths (home, profile, usermain, cart, etc.)
    return {
      tokenKey: 'user_accessToken',
      expectedRole: 'user',
      refreshEndpoint: '/auth/refresh-token',
      loginPath: '/auth/sign-in'
    };
  }
}

/**
 * Get the appropriate module token based on the current route
 * @returns {string|null} - Access token for the current module or null
 */
function getTokenForCurrentRoute() {
  const path = window.location.pathname;
  const { tokenKey } = getModuleInfo(path);

  let token = localStorage.getItem(tokenKey);

  // If module-specific token not found, fallback to legacy 'accessToken'
  // But DO NOT fallback to 'user_accessToken' if we are on another module's route
  if (!token) {
    token = localStorage.getItem('accessToken');
  }

  return token;
}

/**
 * Request Interceptor
 * Adds authentication token to requests based on current route
 */
apiClient.interceptors.request.use(
  (config) => {
    // Get access token for the current module based on route
    let accessToken = getTokenForCurrentRoute();

    // Fallback to legacy token if module-specific token not found
    if (!accessToken || accessToken.trim() === '') {
      accessToken = localStorage.getItem('accessToken');
    }

    // Ensure headers object exists
    if (!config.headers) {
      config.headers = {};
    }

    // Debug logging for FormData requests
    if (import.meta.env.DEV && config.data instanceof FormData) {
      console.log('[API Interceptor] FormData request detected:', {
        url: config.url,
        method: config.method,
        hasAuthHeader: !!config.headers.Authorization,
        authHeaderPrefix: config.headers.Authorization?.substring(0, 30),
        hasAccessToken: !!accessToken
      });
    }

    // Determine if this is an authenticated route
    const path = window.location.pathname;
    const requestUrl = config.url || '';

    // Check if this is a public restaurant route (should not require authentication)
    const isPublicRestaurantRoute = requestUrl.includes('/restaurant/list') ||
      requestUrl.includes('/restaurant/under-250') ||
      (requestUrl.includes('/restaurant/') &&
        !requestUrl.includes('/restaurant/orders') &&
        !requestUrl.includes('/restaurant/auth') &&
        !requestUrl.includes('/restaurant/menu') &&
        !requestUrl.includes('/restaurant/profile') &&
        !requestUrl.includes('/restaurant/staff') &&
        !requestUrl.includes('/restaurant/offers') &&
        !requestUrl.includes('/restaurant/inventory') &&
        !requestUrl.includes('/restaurant/categories') &&
        !requestUrl.includes('/restaurant/onboarding') &&
        !requestUrl.includes('/restaurant/delivery-status') &&
        !requestUrl.includes('/restaurant/finance') &&
        !requestUrl.includes('/restaurant/wallet') &&
        !requestUrl.includes('/restaurant/analytics') &&
        !requestUrl.includes('/restaurant/complaints') &&
        (requestUrl.match(/\/restaurant\/[^/]+$/) ||
          requestUrl.match(/\/restaurant\/[^/]+\/menu/) ||
          requestUrl.match(/\/restaurant\/[^/]+\/addons/) ||
          requestUrl.match(/\/restaurant\/[^/]+\/inventory/) ||
          requestUrl.match(/\/restaurant\/[^/]+\/offers/)));

    const isAuthenticatedRoute = (path.startsWith('/admin') ||
      (path.startsWith('/restaurant') && !path.startsWith('/restaurants') && !isPublicRestaurantRoute) ||
      path.startsWith('/delivery')) && !isPublicRestaurantRoute;

    // For authenticated routes, ALWAYS ensure Authorization header is set if we have a token
    // This ensures FormData requests and other requests always have the token
    if (isAuthenticatedRoute) {
      // If no Authorization header or invalid format, set it
      if (!config.headers.Authorization ||
        (typeof config.headers.Authorization === 'string' && !config.headers.Authorization.startsWith('Bearer '))) {
        if (accessToken && accessToken.trim() !== '' && accessToken !== 'null' && accessToken !== 'undefined') {
          config.headers.Authorization = `Bearer ${accessToken.trim()}`;
          if (import.meta.env.DEV && config.data instanceof FormData) {
            console.log('[API Interceptor] Added Authorization header for authenticated FormData request');
          }
        } else {
          // Log warning in development if token is missing for authenticated routes
          if (import.meta.env.DEV) {
            console.warn(`[API Interceptor] No access token found for authenticated route: ${path}. Request may fail with 401.`);
            console.warn(`[API Interceptor] Available tokens:`, {
              admin: localStorage.getItem('admin_accessToken') ? 'exists' : 'missing',
              restaurant: localStorage.getItem('restaurant_accessToken') ? 'exists' : 'missing',
              delivery: localStorage.getItem('delivery_accessToken') ? 'exists' : 'missing',
              user: localStorage.getItem('user_accessToken') ? 'exists' : 'missing',
              legacy: localStorage.getItem('accessToken') ? 'exists' : 'missing',
            });
          }
        }
      } else {
        // Authorization header already set (from getAuthConfig), log in dev mode for FormData
        if (import.meta.env.DEV && config.data instanceof FormData) {
          console.log('[API Interceptor] Authorization header already set, preserving it for FormData request');
        }
      }
    } else {
      // For non-authenticated routes (including public restaurant routes), don't add token
      // Public routes like /restaurant/list should work without authentication
      if (isPublicRestaurantRoute) {
        // Remove any existing Authorization header for public routes
        delete config.headers.Authorization;
      } else if (!config.headers.Authorization && accessToken && accessToken.trim() !== '' && accessToken !== 'null' && accessToken !== 'undefined') {
        // For other non-authenticated routes, add token if available (for optional auth)
        config.headers.Authorization = `Bearer ${accessToken.trim()}`;
      }
    }

    // If data is FormData, remove Content-Type header to let axios set it with boundary
    // BUT: Make sure Authorization header is preserved
    if (config.data instanceof FormData) {
      // Preserve Authorization header before removing Content-Type
      const authHeader = config.headers.Authorization;
      // Remove Content-Type to let axios set it with proper boundary
      delete config.headers['Content-Type'];
      // Always restore Authorization header if it was set (critical for authentication)
      if (authHeader) {
        config.headers.Authorization = authHeader;
        if (import.meta.env.DEV) {
          console.log('[API Interceptor] Preserved Authorization header for FormData request');
        }
      } else if (accessToken && accessToken.trim() !== '' && accessToken !== 'null' && accessToken !== 'undefined') {
        // If no auth header but we have a token, add it
        config.headers.Authorization = `Bearer ${accessToken.trim()}`;
        if (import.meta.env.DEV) {
          console.log('[API Interceptor] Added Authorization header for FormData request');
        }
      }
    }


    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 * Handles token refresh and error responses
 */
apiClient.interceptors.response.use(
  (response) => {
    // Reset network error state on successful response (backend is back online)
    if (networkErrorState.errorCount > 0) {
      networkErrorState.errorCount = 0;
      networkErrorState.lastErrorTime = 0;
      networkErrorState.toastShown = false;
      if (import.meta.env.DEV) {
        console.log('✅ Backend connection restored');
      }
    }

    // Check for access token in standard successResponse (response.data.data.accessToken)
    // or direct responses (response.data.accessToken)
    const token = response.data?.data?.accessToken || response.data?.accessToken;

    if (token) {
      const currentPath = window.location.pathname;
      const { tokenKey, expectedRole } = getModuleInfo(currentPath);

      const role = getRoleFromToken(token);

      // Only store the token if the role matches the current module or is a valid fallback
      if (role && role === expectedRole) {
        localStorage.setItem(tokenKey, token);
      } else if (role === 'user' && (tokenKey === 'accessToken' || !tokenKey)) {
        // Handle legacy case
        localStorage.setItem('user_accessToken', token);
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Determine which module's refresh endpoint to use based on the CURRENT PAGE (not the failing request URL)
        // Background API calls (like zones or notifications) shouldn't define the module for token refresh
        const currentAppPath = window.location.pathname;
        const { refreshEndpoint, tokenKey, expectedRole } = getModuleInfo(currentAppPath);

        // Try to refresh the token
        // The refresh token is sent via httpOnly cookie automatically
        const response = await axios.post(
          `${API_BASE_URL}${refreshEndpoint}`,
          {},
          {
            withCredentials: true,
          }
        );

        const { accessToken } = response.data.data || response.data;

        if (accessToken) {
          const role = getRoleFromToken(accessToken);

          // Only store token if role matches expected module; otherwise treat as invalid for this module
          if (!role || role !== expectedRole) {
            clearModuleAuth(tokenKey.replace('_accessToken', ''));
            throw new Error('Role mismatch on refreshed token');
          }

          // Store new access token for the current module
          localStorage.setItem(tokenKey, accessToken);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Check if it's a network error or truly expired token
        const isNetworkError = refreshError.code === 'ERR_NETWORK' || refreshError.message === 'Network Error';
        const isTokenExpired = refreshError.response?.status === 401 &&
          (refreshError.response?.data?.message?.includes('expired') ||
            refreshError.response?.data?.message?.includes('Invalid refresh token') ||
            refreshError.response?.data?.message?.includes('Refresh token not found') ||
            refreshError.response?.data?.message?.includes('User not found or inactive') ||
            refreshError.response?.data?.message?.includes('Invalid token for'));

        // Show error toast in development mode for refresh errors
        if (import.meta.env.DEV && !isNetworkError) {
          const refreshErrorMessage =
            refreshError.response?.data?.message ||
            refreshError.response?.data?.error ||
            refreshError.message ||
            'Token refresh failed';

          toast.error(refreshErrorMessage, {
            duration: 3000,
            style: {
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: '#ffffff',
              border: '1px solid #b91c1c',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.3), 0 8px 10px -6px rgba(239, 68, 68, 0.2)',
            },
            className: 'error-toast',
          });
        }

        // Only logout if token is truly expired/invalid, not on network errors
        // Network errors should not cause logout - user might be offline temporarily
        if (isTokenExpired && !isNetworkError) {
          const currentPath = window.location.pathname;
          const isOnboardingPage = currentPath.includes('/onboarding');
          const isLandingPageManagement = currentPath.includes('/hero-banner-management') || currentPath.includes('/landing-page');

          // For landing page management and onboarding, don't auto-logout - let component handle it
          // Only auto-logout for other pages when token is truly expired
          if (!isOnboardingPage && !isLandingPageManagement) {
            const currentPath = window.location.pathname;
            const requestUrl = originalRequest.url || '';

            // Get module info for the current page and the failed request
            const pageModule = getModuleInfo(currentPath);
            const requestModule = getModuleInfo(requestUrl);

            // ONLY REDIRECT if the failed request's module matches the current page's module
            // This prevents a background 'user' request from logging out someone in the 'delivery' app
            if (requestModule.expectedRole === pageModule.expectedRole) {
              const { loginPath, tokenKey } = pageModule;
              const returnToParam = `?returnTo=${encodeURIComponent(currentPath)}`;

              const moduleName = tokenKey.replace('_accessToken', '');
              localStorage.removeItem(`${moduleName}_accessToken`);
              localStorage.removeItem(`${moduleName}_authenticated`);
              localStorage.removeItem(`${moduleName}_user`);

              // Also clear generic user keys if it's the user module
              if (moduleName === 'user' || moduleName === 'accessToken') {
                localStorage.removeItem('user');
              }

              window.location.href = `${loginPath}${returnToParam}`;
            } else {
              if (import.meta.env.DEV) {
                console.warn(`[API Interceptor] Token expired for background module '${requestModule.expectedRole}', but keeping current session for '${pageModule.expectedRole}' active.`);
              }
            }
          }
        }

        // For network errors or onboarding page, reject the promise so component can handle it
        // Don't logout on network errors - user might reconnect
        return Promise.reject(refreshError);
      }
    }

    // Handle network errors specifically (backend not running)
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      if (import.meta.env.DEV) {
        const now = Date.now();
        const timeSinceLastError = now - networkErrorState.lastErrorTime;
        const timeSinceLastToast = now - networkErrorState.lastToastTime;

        // Only log console errors if cooldown period has passed
        if (timeSinceLastError >= networkErrorState.COOLDOWN_PERIOD) {
          networkErrorState.errorCount++;
          networkErrorState.lastErrorTime = now;

          // Log error details (only once per cooldown period)
          if (networkErrorState.errorCount === 1) {
            // Network error logging removed - errors handled via toast notifications
          } else {
            // For subsequent errors, show a brief message
            console.warn(`⚠️ Network Error (${networkErrorState.errorCount}x) - Backend still not connected`);
          }
        }

        // Only show toast if cooldown period has passed
        if (timeSinceLastToast >= networkErrorState.TOAST_COOLDOWN_PERIOD) {
          networkErrorState.lastToastTime = now;
          networkErrorState.toastShown = true;

          // Show helpful error message (only once per minute)
          toast.error(`Backend not connected! Start server: cd bakala/backend && npm run dev`, {
            duration: 10000,
            id: 'network-error-toast', // Use ID to prevent duplicate toasts
            style: {
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#ffffff',
              border: '1px solid #b45309',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 10px 25px -5px rgba(245, 158, 11, 0.3), 0 8px 10px -6px rgba(245, 158, 11, 0.2)',
            },
            className: 'network-error-toast',
          });
        }
      }
      return Promise.reject(error);
    }

    // Handle timeout errors (ECONNABORTED)
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      // Timeout errors are usually due to slow backend or network issues
      // Don't spam console with timeout errors, but handle them gracefully
      if (import.meta.env.DEV) {
        const now = Date.now();
        const timeSinceLastError = now - networkErrorState.lastErrorTime;
        const timeSinceLastToast = now - networkErrorState.lastToastTime;

        // Only log console errors if cooldown period has passed
        if (timeSinceLastError >= networkErrorState.COOLDOWN_PERIOD) {
          networkErrorState.errorCount++;
          networkErrorState.lastErrorTime = now;
        }

        // Only show toast if cooldown period has passed
        if (timeSinceLastToast >= networkErrorState.TOAST_COOLDOWN_PERIOD) {
          networkErrorState.lastToastTime = now;

          // Show helpful error message (only once per minute)
          toast.error(`Request timeout - Backend may be slow or not responding. Check server status.`, {
            duration: 8000,
            id: 'timeout-error-toast', // Use ID to prevent duplicate toasts
            style: {
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#ffffff',
              border: '1px solid #b45309',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 10px 25px -5px rgba(245, 158, 11, 0.3), 0 8px 10px -6px rgba(245, 158, 11, 0.2)',
            },
            className: 'timeout-error-toast',
          });
        }
      }
      return Promise.reject(error);
    }

    // Handle 404 errors (route not found)
    if (error.response?.status === 404) {
      if (import.meta.env.DEV) {
        const url = error.config?.url || 'unknown';
        const fullUrl = error.config?.baseURL ? `${error.config.baseURL}${url}` : url;
        // 404 error logging removed - errors handled via toast notifications

        // Show toast for auth routes (important)
        if (url.includes('/auth/') || url.includes('/send-otp') || url.includes('/verify-otp')) {
          toast.error('Auth API endpoint not found. Make sure backend is running on port 5000.', {
            duration: 8000,
            style: {
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: '#ffffff',
              border: '1px solid #b91c1c',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '14px',
              fontWeight: '500',
            },
          });
        }
        // Show toast for restaurant routes (but not for getRestaurantById which can legitimately return 404)
        else if (url.includes('/restaurant/')) {
          // Only show error for critical restaurant endpoints like /restaurant/list
          // Individual restaurant lookups (like /restaurant/:id) can legitimately return 404 if restaurant doesn't exist
          // So we silently handle those 404s
          const isIndividualRestaurantLookup = /\/restaurant\/[a-f0-9]{24}$/i.test(url) ||
            (url.match(/\/restaurant\/[^/]+$/) && !url.includes('/restaurant/list'));

          if (!isIndividualRestaurantLookup && url.includes('/restaurant/list')) {
            toast.error('Restaurant API endpoint not found. Check backend routes.', {
              duration: 5000,
              style: {
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#ffffff',
                border: '1px solid #b91c1c',
                borderRadius: '12px',
                padding: '16px',
                fontSize: '14px',
                fontWeight: '500',
              },
            });
          }
          // Silently handle 404 for individual restaurant lookups (getRestaurantById)
          // These are expected to fail if restaurant doesn't exist in DB
        }
      }
      return Promise.reject(error);
    }

    // Show error toast in development mode only
    if (import.meta.env.DEV) {
      // Ignore canceled requests - don't show toast
      if (axios.isCancel(error) || error.message === 'canceled' || error.name === 'CanceledError') {
        return Promise.reject(error);
      }

      // Extract error messages from various possible locations
      const errorData = error.response?.data;

      // Handle array of error messages (common in validation errors)
      let errorMessages = [];

      if (Array.isArray(errorData?.message)) {
        errorMessages = errorData.message;
      } else if (Array.isArray(errorData?.errors)) {
        errorMessages = errorData.errors.map(err => err.message || err);
      } else if (errorData?.message) {
        errorMessages = [errorData.message];
      } else if (errorData?.error) {
        errorMessages = [errorData.error];
      } else if (errorData?.data?.message) {
        errorMessages = Array.isArray(errorData.data.message)
          ? errorData.data.message
          : [errorData.data.message];
      } else if (error.message) {
        errorMessages = [error.message];
      } else {
        errorMessages = ['An error occurred'];
      }

      // Show beautiful error toast for each error message
      errorMessages.forEach((errorMessage, index) => {
        // Add slight delay for multiple toasts to appear sequentially
        setTimeout(() => {
          toast.error(errorMessage, {
            duration: 5000,
            style: {
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: '#ffffff',
              border: '1px solid #b91c1c',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.3), 0 8px 10px -6px rgba(239, 68, 68, 0.2)',
            },
            className: 'error-toast',
          });
        }, index * 100); // Stagger multiple toasts by 100ms
      });
    }

    // Handle other errors
    return Promise.reject(error);
  }
);

export default apiClient;


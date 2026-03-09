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
  if (!path) return {
    tokenKey: 'user_accessToken',
    expectedRole: 'user',
    refreshEndpoint: '/auth/refresh-token',
    loginPath: '/auth/sign-in'
  };

  // Normalize path: handle absolute URLs by extracting the pathname
  let normalizedPath = path;
  if (path.startsWith('http')) {
    try {
      normalizedPath = new URL(path).pathname;
    } catch (e) {
      // Fallback if URL parsing fails
      const apiIndex = path.indexOf('/api');
      if (apiIndex !== -1) {
        normalizedPath = path.substring(apiIndex);
      }
    }
  }

  // Remove /api prefix if present
  if (normalizedPath.startsWith('/api')) {
    normalizedPath = normalizedPath.substring(4);
  }

  // Ensure leading slash for consistency
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = '/' + normalizedPath;
  }

  // FIX: Handle mobile/hybrid paths like index.html, usermain, cart, etc.
  const isUserPath = normalizedPath === '/' ||
    normalizedPath.toLowerCase().includes('index.html') ||
    normalizedPath.startsWith('/usermain') ||
    normalizedPath.startsWith('/cart') ||
    normalizedPath.startsWith('/profile') ||
    normalizedPath.startsWith('/home') ||
    normalizedPath.startsWith('/orders') ||
    normalizedPath.startsWith('/wallet') ||
    normalizedPath.startsWith('/settings') ||
    normalizedPath.startsWith('/auth');

  if (normalizedPath.startsWith('/admin')) {
    return {
      tokenKey: 'admin_accessToken',
      expectedRole: 'admin',
      refreshEndpoint: '/admin/auth/refresh-token',
      loginPath: '/admin/login'
    };
  } else if (normalizedPath.startsWith('/restaurant') &&
    !normalizedPath.startsWith('/restaurants') &&
    !normalizedPath.startsWith('/restaurant/list') &&
    !normalizedPath.startsWith('/restaurant/under-250') &&
    !normalizedPath.startsWith('/restaurant/offers/public')) {
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
  } else if (isUserPath) {
    return {
      tokenKey: 'user_accessToken',
      expectedRole: 'user',
      refreshEndpoint: '/auth/refresh-token',
      loginPath: '/auth/sign-in'
    };
  } else {
    // Default fallback
    return {
      tokenKey: 'user_accessToken',
      expectedRole: 'user',
      refreshEndpoint: '/auth/refresh-token',
      loginPath: '/auth/sign-in'
    };
  }
}

/**
 * Get the appropriate module token based on the current route or request URL
 * @param {string} requestUrl - Optional URL of the request being made
 * @returns {string|null} - Access token for the current module or null
 */
function getTokenForCurrentRoute(requestUrl = null) {
  const currentPath = window.location.pathname;

  // Determine module based on BOTH current path AND request URL
  let moduleInfo;
  const urlToCheck = requestUrl || currentPath;

  // Use the improved getModuleInfo
  moduleInfo = getModuleInfo(urlToCheck);

  // CRITICAL: If we are physically on a restaurant/admin/delivery page, 
  // prioritize that module's token even for generic-looking requests.
  if (currentPath.startsWith('/restaurant')) moduleInfo = getModuleInfo('/restaurant');
  else if (currentPath.startsWith('/admin')) moduleInfo = getModuleInfo('/admin');
  else if (currentPath.startsWith('/delivery')) moduleInfo = getModuleInfo('/delivery');

  const { tokenKey, expectedRole } = moduleInfo;
  let token = localStorage.getItem(tokenKey);

  // If module-specific token not found, fallback to legacy 'accessToken'
  // BUT only if we aren't strict about the module (user fallback) or if it's explicitly needed
  if (!token && expectedRole === 'user') {
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
    // Get access token for the current module based on route OR request URL (more reliable)
    let accessToken = getTokenForCurrentRoute(config.url);

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

// Module-aware refresh state management to prevent race conditions across apps
const refreshManagers = {
  user: { isRefreshing: false, subscribers: [] },
  restaurant: { isRefreshing: false, subscribers: [] },
  delivery: { isRefreshing: false, subscribers: [] },
  admin: { isRefreshing: false, subscribers: [] }
};

// Helper to get manager for a role
const getRefreshManager = (role) => {
  // Map special roles like 'moderator' to 'admin' base module
  const normalizedRole = ['admin', 'super_admin', 'moderator'].includes(role) ? 'admin' : role;
  if (!refreshManagers[normalizedRole]) return refreshManagers.user;
  return refreshManagers[normalizedRole];
};

const subscribeTokenRefresh = (role, cb) => {
  getRefreshManager(role).subscribers.push(cb);
};

const onRefreshed = (role, accessToken) => {
  const manager = getRefreshManager(role);
  manager.subscribers.forEach((cb) => cb(accessToken));
  manager.subscribers = [];
  manager.isRefreshing = false;

  // Sync to window for cross-module coordination
  if (window.__bakala_refreshing) {
    const r = ['admin', 'super_admin', 'moderator'].includes(role) ? 'admin' : role;
    delete window.__bakala_refreshing[r];
  }
};

const onRefreshFailed = (role, error) => {
  const manager = getRefreshManager(role);
  manager.subscribers.forEach((cb) => cb(null, error));
  manager.subscribers = [];
  manager.isRefreshing = false;

  if (window.__bakala_refreshing) {
    const r = ['admin', 'super_admin', 'moderator'].includes(role) ? 'admin' : role;
    delete window.__bakala_refreshing[r];
  }
};

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

    // Check for access token and refresh token
    const token = response.data?.data?.accessToken || response.data?.accessToken;
    const refreshToken = response.data?.data?.refreshToken || response.data?.refreshToken;

    if (token) {
      const currentPath = window.location.pathname;
      const { tokenKey, expectedRole } = getModuleInfo(currentPath);

      const role = getRoleFromToken(token);

      // Only store the token if the role matches the current module or is a valid fallback
      const isCorrectModule = (expectedRole === 'admin' && ['admin', 'super_admin', 'moderator'].includes(role)) || (role === expectedRole);

      if (role && isCorrectModule) {
        localStorage.setItem(tokenKey, token);
        // CRITICAL SYNC: Also update generic accessToken to prevent stale tokens in legacy components
        localStorage.setItem('accessToken', token);

        // Also store refresh token if provided
        if (refreshToken) {
          localStorage.setItem(`${expectedRole}_refreshToken`, refreshToken);
          localStorage.setItem('refreshToken', refreshToken);
        }
      } else if (role === 'user' && (tokenKey === 'accessToken' || !tokenKey || tokenKey === 'user_accessToken')) {
        // Handle user case specifically to ensure synchronization
        localStorage.setItem('user_accessToken', token);
        localStorage.setItem('accessToken', token);
        if (refreshToken) {
          localStorage.setItem('user_refreshToken', refreshToken);
          localStorage.setItem('refreshToken', refreshToken);
        }
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      const currentAppPath = window.location.pathname;
      const requestUrl = originalRequest.url || '';

      // Determine module and manager
      let moduleInfo = getModuleInfo(requestUrl);
      if (moduleInfo.expectedRole === 'user') {
        const pageInfo = getModuleInfo(currentAppPath);
        if (pageInfo.expectedRole !== 'user') {
          moduleInfo = pageInfo;
        }
      }

      const roleForRefresh = moduleInfo.expectedRole;
      const manager = getRefreshManager(roleForRefresh);

      if (manager.isRefreshing) {
        // Queue the request until token is refreshed for THIS specific module
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh(roleForRefresh, (token, err) => {
            if (err) {
              return reject(err);
            }
            originalRequest.headers.Authorization = `Bearer ${token}`;
            originalRequest._retry = true;
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      manager.isRefreshing = true;

      // Sync to window to prevent race conditions with proactive refresh logic
      if (!window.__bakala_refreshing) window.__bakala_refreshing = {};
      window.__bakala_refreshing[roleForRefresh] = true;

      try {
        const { refreshEndpoint, tokenKey, expectedRole } = moduleInfo;

        // Try to find the refresh token - ONLY use tokens that match expected role
        // This prevents using wrong module's token which causes "Invalid token role" errors
        let refreshToken = localStorage.getItem(`${expectedRole}_refreshToken`);
        
        // Fallback to generic token only if module-specific token not found
        if (!refreshToken) {
          const genericToken = localStorage.getItem('refreshToken');
          // Verify generic token role matches expected role before using it
          if (genericToken) {
            try {
              const tokenParts = genericToken.split('.');
              if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                // Only use generic token if role matches
                if (payload.role === expectedRole || 
                    (expectedRole === 'admin' && ['admin', 'super_admin', 'moderator'].includes(payload.role))) {
                  refreshToken = genericToken;
                }
              }
            } catch (e) {
              // If token decode fails, don't use generic token
              console.warn('[Token Selection] Failed to decode generic token, skipping');
            }
          }
        }

        // Debug logging for restaurant and delivery modules
        if (import.meta.env.DEV && (expectedRole === 'restaurant' || expectedRole === 'delivery')) {
          console.log(`[Refresh Token Debug] Module: ${expectedRole}`, {
            hasModuleToken: !!localStorage.getItem(`${expectedRole}_refreshToken`),
            hasGenericToken: !!localStorage.getItem('refreshToken'),
            hasToken: !!refreshToken,
            allTokens: {
              module: localStorage.getItem(`${expectedRole}_refreshToken`)?.substring(0, 20) + '...',
              generic: localStorage.getItem('refreshToken')?.substring(0, 20) + '...',
            }
          });
        }

        if (!refreshToken || refreshToken.trim() === '' || refreshToken === 'null' || refreshToken === 'undefined') {
          const noTokenError = new Error('Session expired, please log in again');
          noTokenError._isAuthError = true;
          onRefreshFailed(expectedRole, noTokenError); // Clears manager.isRefreshing
          
          // PERMANENT FIX: Restaurant, Delivery, and Admin modules should NOT auto-logout
          // They will handle token refresh through their own mechanisms
          if (expectedRole === 'restaurant' || expectedRole === 'delivery' || expectedRole === 'admin') {
            if (import.meta.env.DEV) {
              console.log(`[Axios Interceptor] Skipping auto-logout for module '${expectedRole}' (permanent fix)`);
            }
            throw noTokenError; // Just throw error, don't logout
          }
          
          // Immediately logout user if no refresh token found (only for user and admin)
          const currentPath = window.location.pathname;
          const pageModule = getModuleInfo(currentPath);
          
          // Only logout if this is the active module
          if (expectedRole === pageModule.expectedRole || 
              (expectedRole === 'user' && pageModule.expectedRole === 'user')) {
            clearModuleAuth(expectedRole);
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            
            const loginPaths = {
              'user': '/auth/sign-in',
              'restaurant': '/restaurant/login',
              'delivery': '/delivery/sign-in',
              'admin': '/admin/login'
            };
            
            const loginPath = loginPaths[expectedRole] || '/auth/sign-in';
            
            // Use setTimeout to avoid navigation during error handling
            setTimeout(() => {
              window.location.href = loginPath;
            }, 100);
          }
          
          throw noTokenError;
        }

        // Ensure header name matches exactly what backend expects
        // Send both uppercase and lowercase versions for maximum compatibility
        const response = await axios.post(
          `${API_BASE_URL}${refreshEndpoint}`,
          {},
          {
            withCredentials: true,
            headers: { 
              'X-Refresh-Token': refreshToken,
              'x-refresh-token': refreshToken // Also send lowercase for compatibility
            }
          }
        );

        // Debug logging for restaurant and delivery modules
        if (import.meta.env.DEV && (expectedRole === 'restaurant' || expectedRole === 'delivery')) {
          console.log(`[Refresh Token Response] Module: ${expectedRole}`, {
            status: response.status,
            hasData: !!response.data,
            dataKeys: response.data ? Object.keys(response.data) : [],
            fullResponse: response.data
          });
        }

        // Handle different response formats
        let accessToken, newRefreshToken;
        if (response.data) {
          if (response.data.data) {
            // Format: { success: true, data: { accessToken, refreshToken } }
            accessToken = response.data.data.accessToken;
            newRefreshToken = response.data.data.refreshToken;
          } else if (response.data.accessToken) {
            // Format: { accessToken, refreshToken }
            accessToken = response.data.accessToken;
            newRefreshToken = response.data.refreshToken;
          }
        }

        if (!accessToken) {
          const formatError = new Error('Invalid refresh token response format');
          formatError._isAuthError = true;
          
          // PERMANENT FIX: Don't logout restaurant/delivery/admin on format errors
          if (expectedRole === 'restaurant' || expectedRole === 'delivery' || expectedRole === 'admin') {
            if (import.meta.env.DEV) {
              console.error(`[Refresh Token] Invalid response format for ${expectedRole}, but not logging out (permanent fix)`);
            }
            onRefreshFailed(expectedRole, formatError);
            throw formatError;
          }
          
          throw formatError;
        }

        if (accessToken) {
          const role = getRoleFromToken(accessToken);
          const isCorrectModule = (expectedRole === 'admin' && ['admin', 'super_admin', 'moderator'].includes(role)) || (role === expectedRole);

          if (!role || !isCorrectModule) {
            const roleError = new Error(`Role mismatch on refreshed token. Expected ${expectedRole}, got ${role}`);
            roleError._isAuthError = true;
            
            // PERMANENT FIX: Don't logout restaurant/delivery/admin on role mismatch
            if (expectedRole === 'restaurant' || expectedRole === 'delivery' || expectedRole === 'admin') {
              if (import.meta.env.DEV) {
                console.error(`[Refresh Token] Role mismatch for ${expectedRole}, but not logging out (permanent fix)`);
              }
              onRefreshFailed(expectedRole, roleError);
              throw roleError;
            }
            
            clearModuleAuth(tokenKey.replace('_accessToken', ''));
            throw roleError;
          }

          localStorage.setItem(tokenKey, accessToken);
          localStorage.setItem('accessToken', accessToken);

          if (newRefreshToken) {
            localStorage.setItem(`${expectedRole}_refreshToken`, newRefreshToken);
            localStorage.setItem('refreshToken', newRefreshToken);
          }

          onRefreshed(expectedRole, accessToken); // Clears manager.isRefreshing

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        const expectedRole = moduleInfo.expectedRole;
        onRefreshFailed(expectedRole, refreshError); // Clears manager.isRefreshing

        const isNetworkError = refreshError.code === 'ERR_NETWORK' || refreshError.message === 'Network Error';
        const isTokenExpired = refreshError._isAuthError || (refreshError.response?.status === 401 &&
          (refreshError.response?.data?.message?.includes('expired') ||
            refreshError.response?.data?.message?.includes('Invalid refresh token') ||
            refreshError.response?.data?.message?.includes('Refresh token not found') ||
            refreshError.response?.data?.message?.includes('Invalid token for')));
        
        // Check if error is specifically about token not found in database
        // Make check case-insensitive and more robust for live environment
        const errorMessage = refreshError.response?.data?.message || refreshError.message || '';
        const errorMessageLower = errorMessage.toLowerCase();
        
        // Check for exact backend error messages (case-insensitive)
        const isTokenNotFoundInDB = refreshError.response?.status === 401 &&
          (errorMessageLower.includes('refresh token not found') ||
           errorMessageLower.includes('refresh token not found in database') ||
           errorMessageLower.includes('token not found') ||
           errorMessage.includes('Refresh token not found') ||
           errorMessage.includes('Refresh token not found in database') ||
           errorMessage.includes('Refresh token not found. Please login again.') ||
           errorMessage.includes('Refresh token not found in database. Please login again.'));

        // Enhanced logging for debugging (works in both dev and production)
        if (refreshError.response?.status === 401) {
          console.warn(`[Axios Interceptor] 401 Error for ${expectedRole}:`, {
            message: errorMessage,
            status: refreshError.response?.status,
            isTokenNotFoundInDB,
            url: refreshError.config?.url
          });
        }

        if (import.meta.env.DEV && !isNetworkError && !isTokenExpired) {
          const msg = errorMessage || 'Token refresh failed';
          if (msg !== 'canceled') toast.error(msg);
        }

        // CRITICAL: If token is not found in database, ALL modules (including restaurant/delivery/admin) MUST logout
        // This ensures security - if admin deletes token from DB, user is logged out
        if (isTokenNotFoundInDB) {
          console.warn(`[Axios Interceptor] Token not found in database for ${expectedRole} - forcing logout for security`, {
            errorMessage,
            expectedRole,
            status: refreshError.response?.status
          });
          
          // CRITICAL: Force logout for ALL modules when token is missing from database
          // This is a security issue - token was deleted from DB, so user MUST logout
          const currentPath = window.location.pathname;
          const pageModule = getModuleInfo(currentPath);
          
          console.warn(`[Axios Interceptor] Executing logout for ${expectedRole} - token missing from DB`, {
            currentPath,
            pageModule: pageModule.expectedRole,
            expectedRole,
            errorMessage
          });
          
          // Always logout when token is missing from database (security requirement)
          clearModuleAuth(expectedRole);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          
          // Also clear module-specific tokens
          localStorage.removeItem(`${expectedRole}_accessToken`);
          localStorage.removeItem(`${expectedRole}_refreshToken`);
          
          // Clear all possible token variations
          ['user', 'restaurant', 'delivery', 'admin'].forEach(module => {
            if (expectedRole === module) {
              localStorage.removeItem(`${module}_accessToken`);
              localStorage.removeItem(`${module}_refreshToken`);
            }
          });
          
          const loginPaths = {
            'user': '/auth/sign-in',
            'restaurant': '/restaurant/login',
            'delivery': '/delivery/sign-in',
            'admin': '/admin/login'
          };
          
          const loginPath = loginPaths[expectedRole] || '/auth/sign-in';
          
          console.warn(`[Axios Interceptor] Redirecting ${expectedRole} to login: ${loginPath}`);
          
          // Use window.location.href for redirect (works reliably in both local and live)
          // Using setTimeout to ensure all cleanup completes first
          setTimeout(() => {
            try {
              window.location.href = loginPath;
            } catch (redirectError) {
              console.error('[Axios Interceptor] Redirect failed, forcing reload:', redirectError);
              window.location.reload();
            }
          }, 100);
          throw refreshError;
        }

        // PERMANENT FIX: Restaurant, Delivery, and Admin should NOT auto-logout for other errors
        // (network errors, signature mismatches, etc.) - but WILL logout if token missing from DB
        if (expectedRole === 'restaurant' || expectedRole === 'delivery' || expectedRole === 'admin') {
          if (import.meta.env.DEV) {
            console.log(`[Axios Interceptor] Refresh failed for ${expectedRole}, but NOT logging out (permanent fix)`, {
              error: refreshError.message,
              isNetworkError,
              isTokenExpired,
              isTokenNotFoundInDB
            });
          }
          // Just throw the error, don't logout (unless token missing from DB - handled above)
          throw refreshError;
        }

        // Only logout if token is truly expired and it matches the current active module page (for user/admin only)
        if (isTokenExpired && !isNetworkError) {
          const currentPath = window.location.pathname;
          const isOnboardingPage = currentPath.includes('/onboarding');

          if (!isOnboardingPage) {
            const pageModule = getModuleInfo(currentPath);
            const requestModule = getModuleInfo(originalRequest.url || '');

            // Strict check: Only logout if we are on a specialized app page
            // AND we just failed to refresh THAT page's module token.
            const isSpecializedApp = ['restaurant', 'delivery', 'admin'].includes(pageModule.expectedRole);
            const isMatchingRequest = requestModule.expectedRole === pageModule.expectedRole;
            const isModuleSpecificRequest = ['restaurant', 'delivery', 'admin'].includes(requestModule.expectedRole);

            // CRITICAL: If the refresh failed for the page's module, we must logout.
            // Also logout if the failed request's module matches the page module.
            if (isMatchingRequest || (isSpecializedApp && (expectedRole === pageModule.expectedRole || isModuleSpecificRequest))) {
              const { loginPath, tokenKey } = pageModule;
              const moduleName = tokenKey.replace('_accessToken', '');

              localStorage.removeItem(`${moduleName}_accessToken`);
              localStorage.removeItem(`${moduleName}_authenticated`);
              localStorage.removeItem(`${moduleName}_user`);
              localStorage.removeItem(`${moduleName}_refreshToken`);
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              localStorage.removeItem('user');

              // Ensure loginPath is correct for the module
              window.location.href = loginPath;
            } else {
              if (import.meta.env.DEV) {
                console.warn(`[API Interceptor] Token expired/refresh failed for module '${expectedRole}', but keeping current session for '${pageModule.expectedRole}' active.`);
              }
            }
          }
        }

        // For network errors or onboarding page, reject the promise so component can handle it
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

/**
 * Token Migration & Synchronization
 * Runs once on load to ensure old/legacy tokens are synced to the new module keys
 * and to prevent "No token" issues in different app modules.
 */
(function migrateTokens() {
  try {
    const legacyToken = localStorage.getItem('accessToken');
    const legacyRefresh = localStorage.getItem('refreshToken');
    const legacyUser = localStorage.getItem('user');

    if (legacyToken) {
      // If we have a legacy token but no specific user token, migrate it
      if (!localStorage.getItem('user_accessToken')) {
        localStorage.setItem('user_accessToken', legacyToken);
        localStorage.setItem('user_authenticated', 'true');
        if (import.meta.env.DEV) console.log('✅ Migrated legacy accessToken to user_accessToken');
      }

      // If we have a legacy refresh token but no specific user refresh token, migrate it
      if (legacyRefresh && !localStorage.getItem('user_refreshToken')) {
        localStorage.setItem('user_refreshToken', legacyRefresh);
        if (import.meta.env.DEV) console.log('✅ Migrated legacy refreshToken to user_refreshToken');
      }

      // If we have legacy user data, sync it to user_user if missing
      if (legacyUser && !localStorage.getItem('user_user')) {
        localStorage.setItem('user_user', legacyUser);
      }
    }

    // Reverse sync: If we have user_accessToken but no legacy accessToken, sync it
    // (Helps components that still rely on the legacy key)
    const userToken = localStorage.getItem('user_accessToken');
    if (userToken && !localStorage.getItem('accessToken')) {
      localStorage.setItem('accessToken', userToken);
      const userRefresh = localStorage.getItem('user_refreshToken');
      if (userRefresh) localStorage.setItem('refreshToken', userRefresh);
    }
  } catch (e) {
    console.error('Error during token migration:', e);
  }
})();

export default apiClient;


/**
 * JWT Token Utilities
 * Decode and extract information from JWT tokens
 */

/**
 * Decode JWT token without verification (client-side only)
 * @param {string} token - JWT token
 * @returns {Object|null} - Decoded token payload or null if invalid
 */
export function decodeToken(token) {
  if (!token) return null;

  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Decode base64url encoded payload
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));

    return decoded;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

/**
 * Get user role from token
 * @param {string} token - JWT token
 * @returns {string|null} - User role or null if not found
 */
export function getRoleFromToken(token) {
  const decoded = decodeToken(token);
  return decoded?.role || null;
}

/**
 * Check if token is expired
 * @param {string} token - JWT token
 * @returns {boolean} - True if expired or invalid
 */
export function isTokenExpired(token) {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;

  // exp is in seconds, Date.now() is in milliseconds
  return decoded.exp * 1000 < Date.now();
}

/**
 * Get user ID from token
 * @param {string} token - JWT token
 * @returns {string|null} - User ID or null if not found
 */
export function getUserIdFromToken(token) {
  const decoded = decodeToken(token);
  return decoded?.userId || decoded?.id || null;
}

/**
 * Check if user has access to a module based on role
 * @param {string} role - User role
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {boolean} - True if user has access
 */
export function hasModuleAccess(role, module) {
  const roleModuleMap = {
    'admin': 'admin',
    'restaurant': 'restaurant',
    'delivery': 'delivery',
    'user': 'user'
  };

  return roleModuleMap[role] === module;
}

/**
 * Get module-specific access token
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {string|null} - Access token or null
 */
export function getModuleToken(module) {
  // If module is specified, it should ONLY return that specific module's token
  // to avoid cross-module token confusion (e.g., customer token used for delivery refresh)
  if (module) {
    return localStorage.getItem(`${module}_accessToken`);
  }

  // Default fallback for general purpose or legacy code
  return localStorage.getItem('accessToken');
}

/**
 * Get current user's role from a specific module's token
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {string|null} - Current user role or null
 */
export function getCurrentUserRole(module = null) {
  // If module is specified, check that module's token
  if (module) {
    const token = getModuleToken(module);
    if (!token) return null;

    if (isTokenExpired(token)) {
      // Token technically expired, but we return the role anyway 
      // to allow the UI to mount and the API interceptor to handle refresh.
      return getRoleFromToken(token);
    }

    return getRoleFromToken(token);
  }

  // Legacy: check all modules and return the first valid role found
  // This is for backward compatibility but should be avoided
  const modules = ['user', 'restaurant', 'delivery', 'admin'];
  for (const mod of modules) {
    const token = getModuleToken(mod);
    if (token && !isTokenExpired(token)) {
      return getRoleFromToken(token);
    }
  }

  return null;
}

/**
 * Check if user is authenticated for a specific module
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @param {boolean} strict - If true, returns false if token is expired. If false (default), returns true if token exists even if expired (to allow background refresh).
 * @returns {boolean} - True if authenticated
 */
export function isModuleAuthenticated(module, strict = false) {
  const token = getModuleToken(module);
  if (!token) return false;

  if (isTokenExpired(token)) {
    // If strict is true, we return false for expired tokens.
    // This is used for AuthRedirect (away from login pages).
    if (strict) return false;

    // If not strict, we return true to allow the ProtectedRoute to stay mounted
    // while the axios interceptor or App.jsx refresh logic handles the refresh.
    // This prevents the synchronous 'flicker' logout.
    return true;
  }

  return true;
}

/**
 * Clear authentication data for a specific module
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 */
export function clearModuleAuth(module) {
  localStorage.removeItem(`${module}_accessToken`);
  localStorage.removeItem(`${module}_refreshToken`);
  localStorage.removeItem(`${module}_authenticated`);
  localStorage.removeItem(`${module}_user`);
  // Also clear any sessionStorage data
  sessionStorage.removeItem(`${module}AuthData`);
}

/**
 * Clear all authentication data for all modules
 */
export function clearAuthData() {
  const modules = ['admin', 'restaurant', 'delivery', 'user'];
  modules.forEach(module => {
    clearModuleAuth(module);
  });
  // Also clear legacy token if it exists
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
}

/**
 * Get time until token expires (in milliseconds)
 * @param {string} token - JWT token
 * @returns {number|null} - Milliseconds until expiration or null if invalid
 */
export function getTokenExpirationTime(token) {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return null;

  // exp is in seconds, Date.now() is in milliseconds
  const expirationTime = decoded.exp * 1000;
  const now = Date.now();

  return expirationTime - now;
}

/**
 * Check if token should be refreshed (expires within threshold)
 * @param {string} token - JWT token
 * @param {number} thresholdMs - Refresh threshold in milliseconds (default: 5 minutes)
 * @returns {boolean} - True if token should be refreshed
 */
export function shouldRefreshToken(token, thresholdMs = 5 * 60 * 1000) {
  if (!token) return false;

  const timeUntilExpiry = getTokenExpirationTime(token);
  if (timeUntilExpiry === null) return true; // Invalid token, should refresh

  // Refresh if token expires within threshold
  return timeUntilExpiry <= thresholdMs;
}

// Track last refresh attempt time per module to prevent spam
const lastRefreshAttempt = {};

/**
 * Proactively refresh token for a module if needed
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {Promise<boolean>} - True if refresh was successful or not needed
 */
export async function proactiveTokenRefresh(module) {
  const token = getModuleToken(module);
  if (!token) return false;

  // CRITICAL: Check if refresh token exists before attempting refresh
  // If refresh token is missing, user is logged out - don't attempt refresh
  const refreshToken = localStorage.getItem(`${module}_refreshToken`) ||
    localStorage.getItem('refreshToken');
  
  if (!refreshToken || refreshToken.trim() === '' || refreshToken === 'null' || refreshToken === 'undefined') {
    if (import.meta.env.DEV) {
      console.log(`[Proactive Refresh] No refresh token for ${module}, skipping (user logged out)`);
    }
    return false; // User is logged out, don't attempt refresh
  }

  // Check if token needs refresh (expires within 5 minutes)
  if (!shouldRefreshToken(token, 5 * 60 * 1000)) {
    return true; // Token is still valid, no refresh needed
  }

  // DEBOUNCING: Prevent multiple simultaneous refresh attempts
  // If we tried to refresh in the last 30 seconds, skip this attempt
  const now = Date.now();
  const lastAttempt = lastRefreshAttempt[module] || 0;
  const timeSinceLastAttempt = now - lastAttempt;
  const COOLDOWN_PERIOD = 30 * 1000; // 30 seconds cooldown

  if (timeSinceLastAttempt < COOLDOWN_PERIOD) {
    if (import.meta.env.DEV) {
      console.log(`[Proactive Refresh] ${module} refresh skipped - cooldown period (${Math.round((COOLDOWN_PERIOD - timeSinceLastAttempt) / 1000)}s remaining)`);
    }
    return true; // Skip refresh, still in cooldown
  }

  // Update last attempt time
  lastRefreshAttempt[module] = now;

  try {
    // Determine refresh endpoint based on module
    const refreshEndpoints = {
      'admin': '/admin/auth/refresh-token',
      'restaurant': '/restaurant/auth/refresh-token',
      'delivery': '/delivery/auth/refresh-token',
      'user': '/auth/refresh-token'
    };

    const refreshEndpoint = refreshEndpoints[module];
    if (!refreshEndpoint) {
      console.warn(`No refresh endpoint for module: ${module}`);
      return false;
    }

    // CRITICAL: If this module is already being refreshed by the axios interceptor, 
    // skip proactive refresh to prevent race conditions (rotating refresh tokens).
    const normalizedModule = ['admin', 'super_admin', 'moderator'].includes(module) ? 'admin' : module;
    if (window.__bakala_refreshing && window.__bakala_refreshing[normalizedModule]) {
      if (import.meta.env.DEV) console.log(`[Proactive Refresh] ${module} is already refreshing via interceptor, skipping.`);
      return true;
    }

    // Set refreshing flag
    if (!window.__bakala_refreshing) window.__bakala_refreshing = {};
    window.__bakala_refreshing[normalizedModule] = true;

    // Import axios and API_BASE_URL dynamically
    const { default: axios } = await import('axios');
    const { API_BASE_URL } = await import('../api/config.js');

    // Refresh token already checked at the beginning of function
    // Use the refreshToken variable from the early check

    // Call refresh endpoint with credentials and refresh token header (for hybrid app/WebView support)
    const response = await axios.post(
      `${API_BASE_URL}${refreshEndpoint}`,
      {},
      {
        withCredentials: true,
        headers: { 'X-Refresh-Token': refreshToken }
      }
    );

    const { accessToken, refreshToken: newRefreshToken } = response.data.data || response.data;

    if (accessToken) {
      // Verify role matches
      // Use 'admin' check for all admin-like roles to be consistent with getModuleInfo
      const role = getRoleFromToken(accessToken);
      const isCorrectModule = (module === 'admin' && ['admin', 'super_admin', 'moderator'].includes(role)) || (role === module);

      if (isCorrectModule) {
        // Store new access token
        localStorage.setItem(`${module}_accessToken`, accessToken);
        // CRITICAL SYNC: Also update generic accessToken
        localStorage.setItem('accessToken', accessToken);

        // If backend returned a new refresh token, store it as well
        if (newRefreshToken) {
          localStorage.setItem(`${module}_refreshToken`, newRefreshToken);
          localStorage.setItem('refreshToken', newRefreshToken);
        }

        console.log(`✅ [Proactive Refresh] Tokens refreshed for ${module}`);
        // Reset cooldown on successful refresh
        lastRefreshAttempt[module] = 0;
        return true;
      } else {
        console.warn(`[Proactive Refresh] Role mismatch for ${module}: expected ${module}, got ${role}`);
        return false;
      }
    }

    return false;
  } catch (error) {
    // Clear refreshing flag
    const normalizedModule = ['admin', 'super_admin', 'moderator'].includes(module) ? 'admin' : module;
    if (window.__bakala_refreshing) delete window.__bakala_refreshing[normalizedModule];

    // On error, extend cooldown to prevent spam (wait 60 seconds before retry)
    lastRefreshAttempt[module] = Date.now();

    // Don't log network errors as they're expected when offline
    if (error.code !== 'ERR_NETWORK' && error.message !== 'Network Error') {
      if (import.meta.env.DEV) {
        console.warn(`[Proactive Refresh] Failed to refresh token for ${module}:`, error.message);
        console.log(`[Proactive Refresh] Cooldown extended to 60s for ${module} due to error`);
      }
    }
    return false;
  } finally {
    const normalizedModule = ['admin', 'super_admin', 'moderator'].includes(module) ? 'admin' : module;
    if (window.__bakala_refreshing) delete window.__bakala_refreshing[normalizedModule];
  }
}

/**
 * Check if user has a refresh token and logout if missing
 * This ensures users without refresh tokens are automatically logged out
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {boolean} - True if user has refresh token, false if logged out
 */
export function checkAndLogoutIfNoRefreshToken(module) {
  // PERMANENT FIX: Restaurant, Delivery, and Admin modules should NOT auto-logout
  // They will handle token refresh through their own mechanisms
  if (module === 'restaurant' || module === 'delivery' || module === 'admin') {
    if (import.meta.env.DEV) {
      console.log(`[Auth Check] Skipping auto-logout check for module '${module}' (permanent fix)`);
    }
    return true; // Always return true to prevent logout
  }

  // Get refresh token for the module
  const refreshToken = localStorage.getItem(`${module}_refreshToken`) ||
    localStorage.getItem('refreshToken') ||
    localStorage.getItem('user_refreshToken') ||
    localStorage.getItem('restaurant_refreshToken') ||
    localStorage.getItem('delivery_refreshToken') ||
    localStorage.getItem('admin_refreshToken');

  // If no refresh token found, logout the user (only for user and admin modules)
  if (!refreshToken || refreshToken.trim() === '' || refreshToken === 'null' || refreshToken === 'undefined') {
    if (import.meta.env.DEV) {
      console.warn(`[Auth Check] No refresh token found for module '${module}'. Logging out...`);
    }

    // Clear all auth data for this module
    clearModuleAuth(module);

    // Also clear generic tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');

    // Determine login path based on module
    const loginPaths = {
      'user': '/auth/sign-in',
      'restaurant': '/restaurant/login',
      'delivery': '/delivery/sign-in',
      'admin': '/admin/login'
    };

    const loginPath = loginPaths[module] || '/auth/sign-in';
    const currentPath = window.location.pathname;

    // Dispatch auth change event
    window.dispatchEvent(new Event(`${module}AuthChanged`));
    window.dispatchEvent(new Event('userAuthChanged'));

    // Redirect to login page
    // Use setTimeout to avoid navigation during render
    setTimeout(() => {
      if (window.location.pathname !== loginPath && !window.location.pathname.includes('/auth/')) {
        window.location.href = `${loginPath}?returnTo=${encodeURIComponent(currentPath)}`;
      }
    }, 100);

    return false;
  }

  return true;
}

/**
 * Check all active modules for refresh tokens and logout if missing
 * This is called on app initialization to ensure all users have valid refresh tokens
 */
export function checkAllModulesForRefreshTokens() {
  const modules = ['user', 'restaurant', 'delivery', 'admin'];
  const currentPath = window.location.pathname;

  // Determine which module the user is currently on
  let activeModule = 'user'; // default
  if (currentPath.startsWith('/restaurant')) activeModule = 'restaurant';
  else if (currentPath.startsWith('/delivery')) activeModule = 'delivery';
  else if (currentPath.startsWith('/admin')) activeModule = 'admin';

  // Check the active module first
  const hasRefreshToken = checkAndLogoutIfNoRefreshToken(activeModule);

  // If active module has no refresh token, it will redirect, so we can return early
  if (!hasRefreshToken) {
    return false;
  }

  // For other modules, just clear their data if they don't have refresh tokens
  // (but don't redirect since user is not on those pages)
  modules.forEach(module => {
    if (module !== activeModule) {
      const moduleRefreshToken = localStorage.getItem(`${module}_refreshToken`) ||
        localStorage.getItem('refreshToken');

      if (!moduleRefreshToken || moduleRefreshToken.trim() === '' || 
          moduleRefreshToken === 'null' || moduleRefreshToken === 'undefined') {
        // Clear stale auth data for inactive modules
        clearModuleAuth(module);
      }
    }
  });

  return true;
}

/**
 * Set authentication data for a specific module
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @param {string} token - Access token
 * @param {Object} user - User data
 * @throws {Error} If localStorage is not available or quota exceeded
 */
export function setAuthData(module, token, user) {
  try {
    // Check if localStorage is available
    if (typeof Storage === 'undefined' || !localStorage) {
      throw new Error('localStorage is not available');
    }

    // Validate inputs
    if (!module || !token) {
      throw new Error(`Invalid parameters: module=${module}, token=${!!token}`);
    }

    console.log(`[setAuthData] Storing auth for module: ${module}`, {
      hasToken: !!token,
      tokenLength: token?.length,
      hasUser: !!user
    });

    // Store module-specific token (don't clear other modules)
    const tokenKey = `${module}_accessToken`;
    const authKey = `${module}_authenticated`;
    const userKey = `${module}_user`;

    localStorage.setItem(tokenKey, token);
    localStorage.setItem(authKey, 'true');

    // SYNC: Also update legacy generic key to keep all modules in sync
    localStorage.setItem('accessToken', token);

    // Store refresh token if provided (e.g., as response.data.refreshToken)
    const refreshToken = user?.refreshToken || (typeof token === 'object' ? token.refreshToken : null);
    if (refreshToken) {
      localStorage.setItem(`${module}_refreshToken`, refreshToken);
      localStorage.setItem('refreshToken', refreshToken); // SYNC: Generic key
    } else if (typeof arguments[3] === 'string') {
      // Allow passing refreshToken as 4th argument if needed
      const rToken = arguments[3];
      localStorage.setItem(`${module}_refreshToken`, rToken);
      localStorage.setItem('refreshToken', rToken); // SYNC: Generic key
    }

    if (user) {
      try {
        localStorage.setItem(userKey, JSON.stringify(user));
      } catch (userError) {
        console.warn('Failed to store user data, but token was stored:', userError);
        // Don't throw - token storage is more important
      }
    }

    // Verify the token was stored correctly
    const storedToken = localStorage.getItem(tokenKey);
    const storedAuth = localStorage.getItem(authKey);

    if (storedToken !== token) {
      console.error(`[setAuthData] Token mismatch:`, {
        expected: token?.substring(0, 20) + '...',
        stored: storedToken?.substring(0, 20) + '...'
      });
      throw new Error(`Token storage verification failed for module: ${module}`);
    }

    if (storedAuth !== 'true') {
      console.error(`[setAuthData] Auth flag mismatch:`, {
        expected: 'true',
        stored: storedAuth
      });
      throw new Error(`Authentication flag storage failed for module: ${module}`);
    }

    console.log(`[setAuthData] Successfully stored auth data for ${module}`);
  } catch (error) {
    // If quota exceeded, try to clear some space
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.warn('localStorage quota exceeded. Attempting to clear old data...');
      // Clear legacy tokens
      try {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        // Retry storing
        localStorage.setItem(`${module}_accessToken`, token);
        localStorage.setItem(`${module}_authenticated`, 'true');
        if (user) {
          localStorage.setItem(`${module}_user`, JSON.stringify(user));
        }

        // Verify again after retry
        const storedToken = localStorage.getItem(`${module}_accessToken`);
        if (storedToken !== token) {
          throw new Error('Token storage failed even after clearing space');
        }
      } catch (retryError) {
        console.error('Failed to store auth data after clearing space:', retryError);
        throw new Error('Unable to store authentication data. Please clear browser storage and try again.');
      }
    } else {
      console.error('[setAuthData] Error storing auth data:', error);
      throw error;
    }
  }
}


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
  return localStorage.getItem(`${module}_accessToken`);
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
 * @returns {boolean} - True if authenticated
 */
export function isModuleAuthenticated(module) {
  const token = getModuleToken(module);
  if (!token) return false;

  if (isTokenExpired(token)) {
    // If token is expired, we still return true to allow the ProtectedRoute to render.
    // The axios interceptor or App.jsx refresh logic will handle the actual refresh.
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

/**
 * Proactively refresh token for a module if needed
 * @param {string} module - Module name (admin, restaurant, delivery, user)
 * @returns {Promise<boolean>} - True if refresh was successful or not needed
 */
export async function proactiveTokenRefresh(module) {
  const token = getModuleToken(module);
  if (!token) return false;

  // Check if token needs refresh (expires within 5 minutes)
  if (!shouldRefreshToken(token, 5 * 60 * 1000)) {
    return true; // Token is still valid, no refresh needed
  }

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

    // Import axios and API_BASE_URL dynamically
    const { default: axios } = await import('axios');
    const { API_BASE_URL } = await import('../api/config.js');

    // Call refresh endpoint with credentials
    const response = await axios.post(
      `${API_BASE_URL}${refreshEndpoint}`,
      {},
      { withCredentials: true }
    );

    const { accessToken } = response.data.data || response.data;

    if (accessToken) {
      // Verify role matches
      const role = getRoleFromToken(accessToken);
      if (role === module) {
        // Store new token
        localStorage.setItem(`${module}_accessToken`, accessToken);
        console.log(`✅ [Proactive Refresh] Token refreshed for ${module}`);
        return true;
      } else {
        console.warn(`[Proactive Refresh] Role mismatch for ${module}: expected ${module}, got ${role}`);
        return false;
      }
    }

    return false;
  } catch (error) {
    // Don't log network errors as they're expected when offline
    if (error.code !== 'ERR_NETWORK' && error.message !== 'Network Error') {
      console.warn(`[Proactive Refresh] Failed to refresh token for ${module}:`, error.message);
    }
    return false;
  }
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


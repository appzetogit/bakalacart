/**
 * Global Google Maps API Cache Utility
 * Prevents duplicate API calls across all components to reduce billing costs
 * 
 * IMPORTANT: This cache is shared across ALL components to prevent duplicate requests
 */

// Global cache for Directions API calls
const directionsCache = new Map(); // "lat1,lng1|lat2,lng2|mode" -> {result, timestamp}
const geocodingCache = new Map(); // "lat,lng" -> {result, timestamp}

// Cache configuration
const DIRECTIONS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes (increased from 5)
const GEOCODING_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_SIZE = 500; // Maximum cache entries to prevent memory issues

// Track last API call timestamps for throttling
const lastDirectionsCall = new Map(); // "lat1,lng1|lat2,lng2" -> timestamp
const lastGeocodingCall = new Map(); // "lat,lng" -> timestamp

// Throttling configuration
const DIRECTIONS_THROTTLE_MS = 5000; // Minimum 5 seconds between same route requests
const GEOCODING_THROTTLE_MS = 2000; // Minimum 2 seconds between same geocoding requests

/**
 * Round coordinates for cache key (reduces cache misses for similar locations)
 * @param {number} coord - Coordinate value
 * @param {number} precision - Decimal places (default: 4 = ~11 meters)
 * @returns {number} Rounded coordinate
 */
function roundCoord(coord, precision = 4) {
  return Math.round(coord * Math.pow(10, precision)) / Math.pow(10, precision);
}

/**
 * Create cache key for Directions API
 * @param {Object} origin - {lat, lng}
 * @param {Object} destination - {lat, lng}
 * @param {string} travelMode - Travel mode (optional)
 * @returns {string} Cache key
 */
function createDirectionsCacheKey(origin, destination, travelMode = 'DRIVING') {
  const originKey = `${roundCoord(origin.lat)},${roundCoord(origin.lng)}`;
  const destKey = `${roundCoord(destination.lat)},${roundCoord(destination.lng)}`;
  return `${originKey}|${destKey}|${travelMode}`;
}

/**
 * Create cache key for Geocoding API
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} Cache key
 */
function createGeocodingCacheKey(lat, lng) {
  return `${roundCoord(lat, 6)},${roundCoord(lng, 6)}`; // Higher precision for geocoding
}

/**
 * Clean old cache entries to prevent memory issues
 */
function cleanOldCacheEntries() {
  const now = Date.now();
  
  // Clean Directions cache
  for (const [key, value] of directionsCache.entries()) {
    if (now - value.timestamp > DIRECTIONS_CACHE_TTL_MS) {
      directionsCache.delete(key);
    }
  }
  
  // Clean Geocoding cache
  for (const [key, value] of geocodingCache.entries()) {
    if (now - value.timestamp > GEOCODING_CACHE_TTL_MS) {
      geocodingCache.delete(key);
    }
  }
  
  // Limit cache size
  if (directionsCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(directionsCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp); // Sort by timestamp
    const toDelete = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    toDelete.forEach(([key]) => directionsCache.delete(key));
  }
  
  if (geocodingCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(geocodingCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    toDelete.forEach(([key]) => geocodingCache.delete(key));
  }
}

/**
 * Get cached Directions API result
 * @param {Object} origin - {lat, lng}
 * @param {Object} destination - {lat, lng}
 * @param {string} travelMode - Travel mode (optional)
 * @returns {Object|null} Cached result or null
 */
export function getCachedDirections(origin, destination, travelMode = 'DRIVING') {
  if (!origin || !destination || !origin.lat || !origin.lng || !destination.lat || !destination.lng) {
    return null;
  }
  
  const cacheKey = createDirectionsCacheKey(origin, destination, travelMode);
  const cached = directionsCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < DIRECTIONS_CACHE_TTL_MS) {
    console.log('✅ Using cached Directions API result');
    return cached.result;
  }
  
  return null;
}

/**
 * Cache Directions API result
 * @param {Object} origin - {lat, lng}
 * @param {Object} destination - {lat, lng}
 * @param {Object} result - Directions API result
 * @param {string} travelMode - Travel mode (optional)
 */
export function cacheDirections(origin, destination, result, travelMode = 'DRIVING') {
  if (!origin || !destination || !result) return;
  
  const cacheKey = createDirectionsCacheKey(origin, destination, travelMode);
  directionsCache.set(cacheKey, {
    result: result,
    timestamp: Date.now()
  });
  
  // Clean old entries periodically
  if (directionsCache.size % 10 === 0) {
    cleanOldCacheEntries();
  }
}

/**
 * Check if Directions API call should be throttled
 * @param {Object} origin - {lat, lng}
 * @param {Object} destination - {lat, lng}
 * @returns {boolean} True if should be throttled
 */
export function shouldThrottleDirections(origin, destination) {
  if (!origin || !destination) return false;
  
  const throttleKey = `${roundCoord(origin.lat)},${roundCoord(origin.lng)}|${roundCoord(destination.lat)},${roundCoord(destination.lng)}`;
  const lastCall = lastDirectionsCall.get(throttleKey);
  const now = Date.now();
  
  if (lastCall && (now - lastCall) < DIRECTIONS_THROTTLE_MS) {
    return true;
  }
  
  lastDirectionsCall.set(throttleKey, now);
  return false;
}

/**
 * Get cached Geocoding API result
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Object|null} Cached result or null
 */
export function getCachedGeocoding(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return null;
  }
  
  const cacheKey = createGeocodingCacheKey(lat, lng);
  const cached = geocodingCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < GEOCODING_CACHE_TTL_MS) {
    console.log('✅ Using cached Geocoding API result');
    return cached.result;
  }
  
  return null;
}

/**
 * Cache Geocoding API result
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} result - Geocoding API result
 */
export function cacheGeocoding(lat, lng, result) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !result) return;
  
  const cacheKey = createGeocodingCacheKey(lat, lng);
  geocodingCache.set(cacheKey, {
    result: result,
    timestamp: Date.now()
  });
  
  // Clean old entries periodically
  if (geocodingCache.size % 10 === 0) {
    cleanOldCacheEntries();
  }
}

/**
 * Check if Geocoding API call should be throttled
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} True if should be throttled
 */
export function shouldThrottleGeocoding(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  
  const throttleKey = createGeocodingCacheKey(lat, lng);
  const lastCall = lastGeocodingCall.get(throttleKey);
  const now = Date.now();
  
  if (lastCall && (now - lastCall) < GEOCODING_THROTTLE_MS) {
    return true;
  }
  
  lastGeocodingCall.set(throttleKey, now);
  return false;
}

/**
 * Clear all caches (useful for testing or memory management)
 */
export function clearAllCaches() {
  directionsCache.clear();
  geocodingCache.clear();
  lastDirectionsCall.clear();
  lastGeocodingCall.clear();
  console.log('🗑️ All Google Maps API caches cleared');
}

/**
 * Get cache statistics (for debugging)
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  return {
    directionsCacheSize: directionsCache.size,
    geocodingCacheSize: geocodingCache.size,
    lastDirectionsCalls: lastDirectionsCall.size,
    lastGeocodingCalls: lastGeocodingCall.size
  };
}

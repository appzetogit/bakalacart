/**
 * Restaurant Management Utility Functions
 * Centralized management for restaurant details across the restaurant module
 * Mock data removed - using API data only
 */

// Empty restaurant data structure
const EMPTY_RESTAURANT_DATA = {
  restaurantName: {
    english: "",
    bengali: "",
    arabic: "",
    spanish: ""
  },
  phoneNumber: "",
  address: "",
  logo: null,
  cover: null,
  metaTitle: "",
  metaDescription: "",
  metaImage: null,
  rating: 0,
  totalRatings: 0
}

const RESTAURANT_STORAGE_KEY = 'restaurant_data'

/**
 * Get restaurant data from localStorage
 * @returns {Object} - Restaurant data object
 */
export const getRestaurantData = () => {
  try {
    const saved = localStorage.getItem(RESTAURANT_STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
    // Return empty data instead of default mock data
    return EMPTY_RESTAURANT_DATA
  } catch (error) {
    console.error('Error reading restaurant data from localStorage:', error)
    return EMPTY_RESTAURANT_DATA
  }
}

/**
 * Save restaurant data to localStorage
 * @param {Object} restaurantData - Restaurant data object
 */
export const setRestaurantData = (restaurantData) => {
  try {
    localStorage.setItem(RESTAURANT_STORAGE_KEY, JSON.stringify(restaurantData))
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('restaurantDataUpdated'))
    // Trigger storage event for cross-tab updates
    window.dispatchEvent(new Event('storage'))
  } catch (error) {
    console.error('Error saving restaurant data to localStorage:', error)
  }
}

/**
 * Update restaurant data (merge with existing)
 * @param {Object} updates - Partial restaurant data to update
 * @returns {Object} - Updated restaurant data
 */
export const updateRestaurantData = (updates) => {
  const currentData = getRestaurantData()
  const updatedData = {
    ...currentData,
    ...updates,
    // Merge restaurantName object if it exists
    restaurantName: updates.restaurantName 
      ? { ...currentData.restaurantName, ...updates.restaurantName }
      : currentData.restaurantName
  }
  setRestaurantData(updatedData)
  return updatedData
}


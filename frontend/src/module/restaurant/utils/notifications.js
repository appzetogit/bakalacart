/**
 * Notifications Utility Functions
 * Centralized management for notifications
 */

import { getTransactionsByType, getTransactionsByStatus } from './walletState'

const RESTAURANT_NOTIFICATIONS_KEY = 'restaurant_notifications'

/**
 * Get all notifications from localStorage
 * @returns {Array} - Array of notifications
 */
export const getRestaurantNotifications = () => {
  try {
    const saved = localStorage.getItem(RESTAURANT_NOTIFICATIONS_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
    return []
  } catch (error) {
    console.error('Error reading restaurant notifications from localStorage:', error)
    return []
  }
}

/**
 * Save notifications to localStorage
 * @param {Array} notifications - Array of notifications
 */
export const saveRestaurantNotifications = (notifications) => {
  try {
    localStorage.setItem(RESTAURANT_NOTIFICATIONS_KEY, JSON.stringify(notifications))
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('restaurantNotificationsUpdated'))
  } catch (error) {
    console.error('Error saving restaurant notifications to localStorage:', error)
  }
}

/**
 * Add a new notification
 * @param {Object} notification - Notification object
 */
export const addRestaurantNotification = (notification) => {
  try {
    const notifications = getRestaurantNotifications()
    const newNotification = {
      id: Date.now() + Math.random(), // Unique ID
      read: false,
      createdAt: new Date().toISOString(),
      type: notification.type || 'info',
      title: notification.title || 'Notification',
      message: notification.message || notification.description || '',
      ...notification
    }
    console.log('➕ Adding notification:', newNotification)
    notifications.unshift(newNotification)
    // Keep only last 100 notifications to prevent localStorage overflow
    if (notifications.length > 100) {
      notifications.splice(100)
    }
    saveRestaurantNotifications(notifications)
    console.log('✅ Saved notifications, total count:', notifications.length)
    return newNotification
  } catch (error) {
    console.error('❌ Error adding notification:', error)
    return null
  }
}

/**
 * Delete a notification by ID
 * @param {number|string} notificationId - Notification ID
 */
export const deleteRestaurantNotification = (notificationId) => {
  const notifications = getRestaurantNotifications()
  const filtered = notifications.filter(n => n.id !== notificationId)
  saveRestaurantNotifications(filtered)
}

/**
 * Clear all notifications
 */
export const clearAllRestaurantNotifications = () => {
  saveRestaurantNotifications([])
}

/**
 * Mark notification as read
 * @param {number|string} notificationId - Notification ID
 */
export const markRestaurantNotificationAsRead = (notificationId) => {
  const notifications = getRestaurantNotifications()
  const notification = notifications.find(n => n.id === notificationId)
  if (notification) {
    notification.read = true
    saveRestaurantNotifications(notifications)
  }
}

/**
 * Get unread notification count
 * @returns {number} - Count of unread notifications
 */
export const getUnreadNotificationCount = () => {
  try {
    const notifications = getRestaurantNotifications()
    const unreadCount = notifications.filter(n => !n.read).length
    
    // Also count wallet transactions for notifications (legacy support)
    const paymentTransactions = getTransactionsByType("payment").slice(0, 3)
    if (paymentTransactions.length > 0) {
      return unreadCount + 1 // First payment notification is unread
    }
    
    return unreadCount
  } catch (error) {
    console.error('Error getting unread notification count:', error)
    return 0
  }
}


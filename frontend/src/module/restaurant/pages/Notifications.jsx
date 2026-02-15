import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, X, Bell, Package, CheckCircle, AlertCircle, Info, Trash2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  getRestaurantNotifications,
  deleteRestaurantNotification,
  clearAllRestaurantNotifications,
  markRestaurantNotificationAsRead
} from "../utils/notifications"

export default function Notifications() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])

  // Load notifications on mount and listen for updates
  useEffect(() => {
    const loadNotifications = () => {
      const allNotifications = getRestaurantNotifications()
      console.log('📬 Loaded notifications:', allNotifications.length, 'total')
      setNotifications(allNotifications)
    }

    // Initial load
    loadNotifications()

    // Listen for notification updates
    const handleUpdate = () => {
      console.log('🔄 Notification update event received')
      loadNotifications()
    }

    window.addEventListener('restaurantNotificationsUpdated', handleUpdate)
    window.addEventListener('storage', handleUpdate)

    // Check for updates every 2 seconds to ensure real-time sync
    const interval = setInterval(() => {
      loadNotifications()
    }, 2000)

    return () => {
      window.removeEventListener('restaurantNotificationsUpdated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
      clearInterval(interval)
    }
  }, [])

  // Format time ago
  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Just now'

    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)

    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`

    return date.toLocaleDateString()
  }

  // Get notification icon and color based on type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'order':
        return { icon: Package, color: 'bg-orange-500' }
      case 'success':
        return { icon: CheckCircle, color: 'bg-green-500' }
      case 'alert':
        return { icon: AlertCircle, color: 'bg-yellow-500' }
      case 'info':
        return { icon: Info, color: 'bg-blue-500' }
      default:
        return { icon: Bell, color: 'bg-gray-500' }
    }
  }

  // Handle delete notification
  const handleDeleteNotification = (notificationId) => {
    deleteRestaurantNotification(notificationId)
    setNotifications(getRestaurantNotifications())
    toast.success('Notification deleted')
  }

  // Handle clear all
  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all notifications?')) {
      clearAllRestaurantNotifications()
      setNotifications([])
      toast.success('All notifications cleared')
    }
  }

  // Handle notification click (mark as read)
  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markRestaurantNotificationAsRead(notification.id)
      setNotifications(getRestaurantNotifications())
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/restaurant")}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </button>
          <h1 className="text-base font-semibold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <span className="bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {unreadCount} New
            </span>
          )}
        </div>
        {notifications.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Clear All
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <div className="flex-1 px-4 pt-4 pb-28 overflow-y-auto">
        {notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const { icon: Icon, color } = getNotificationIcon(notification.type)
              return (
                <Card
                  key={notification.id}
                  className={`bg-white shadow-sm border transition-all cursor-pointer ${!notification.read ? 'border-l-4 border-l-orange-500' : 'border-gray-100'
                    }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`${color} p-2 rounded-full flex-shrink-0`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className={`font-semibold text-sm ${!notification.read ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                            {notification.title || 'Notification'}
                          </h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteNotification(notification.id)
                            }}
                            className="p-1 rounded-full hover:bg-gray-100 flex-shrink-0 transition-colors"
                            aria-label="Delete notification"
                          >
                            <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                          </button>
                        </div>
                        <p className="text-gray-600 text-sm mb-2 leading-relaxed">
                          {notification.message || notification.description || ''}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-gray-400 text-xs">
                            {formatTimeAgo(notification.createdAt)}
                          </p>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-base">No notifications</p>
            <p className="text-gray-400 text-sm mt-1">You're all caught up!</p>
          </div>
        )}
      </div>
    </div>
  )
}

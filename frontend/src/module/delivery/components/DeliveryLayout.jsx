import { useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import BottomNavigation from "./BottomNavigation"
import { getUnreadDeliveryNotificationCount } from "../utils/deliveryNotifications"
import { useDeliveryNotifications } from "../hooks/useDeliveryNotifications"

export default function DeliveryLayout({ 
  children, 
  showGig = false,
  showPocket = false,
  onHomeClick,
  onGigClick
}) {
  const location = useLocation()
  const [requestBadgeCount, setRequestBadgeCount] = useState(() => 
    getUnreadDeliveryNotificationCount()
  )
  
  // Initialize delivery notifications hook - this ensures sound plays on all pages when order is assigned
  // The hook handles socket connection and plays sound when admin assigns order
  useDeliveryNotifications()

  // Update badge count when location changes
  useEffect(() => {
    setRequestBadgeCount(getUnreadDeliveryNotificationCount())
    
    // Listen for notification updates
    const handleNotificationUpdate = () => {
      setRequestBadgeCount(getUnreadDeliveryNotificationCount())
    }
    
    window.addEventListener('deliveryNotificationsUpdated', handleNotificationUpdate)
    window.addEventListener('storage', handleNotificationUpdate)
    
    return () => {
      window.removeEventListener('deliveryNotificationsUpdated', handleNotificationUpdate)
      window.removeEventListener('storage', handleNotificationUpdate)
    }
  }, [location.pathname])

  // Pages where bottom navigation should be shown
  const showBottomNav = [
    '/delivery',
    '/delivery/orders',
    '/delivery/requests',
    '/delivery/trip-history',
    '/delivery/profile'
  ].includes(location.pathname)

  return (
    <>
      {children}
      {showBottomNav && (
        <BottomNavigation
          showGig={showGig}
          showPocket={showPocket}
          onHomeClick={onHomeClick}
          onGigClick={onGigClick}
          requestBadgeCount={requestBadgeCount}
        />
      )}
    </>
  )
}


import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  Search,
  Mic,
  MoreVertical,
  ChevronRight,
  Star,
  RotateCcw,
  AlertCircle,
  Loader2,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  X,
  MapPin,
  Navigation,
  Camera,
  IndianRupee,
  Eye
} from "lucide-react"
import { deliveryAPI, uploadAPI } from "@/lib/api"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"

export default function MyOrders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("pending")
  const [activeBillUploadOrder, setActiveBillUploadOrder] = useState(null)

  // Rating & Review State
  const [showRatingPopup, setShowRatingPopup] = useState(false)
  const [selectedOrderForRating, setSelectedOrderForRating] = useState(null)
  const [ratingValue, setRatingValue] = useState(5)
  const [reviewText, setReviewText] = useState("")
  const [submittingRating, setSubmittingRating] = useState(false)

  // Order Details Dialog State
  const [showOrderDetailsDialog, setShowOrderDetailsDialog] = useState(false)
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState(null)
  const [showMenuForOrder, setShowMenuForOrder] = useState(null) // Track which order's menu is open

  // Fetch orders from API
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true)

        let ordersData = []

        if (activeTab === "pending") {
          // Fetch active assigned orders for pending tab
          console.log('🔄 Fetching active assigned orders...')
          const response = await deliveryAPI.getOrders({
            includeDelivered: false,
            limit: 100
          })

          if (response?.data?.success && response?.data?.data?.orders) {
            ordersData = response.data.data.orders || []
            console.log('✅ Found active orders:', ordersData.length)
          }
        } else {
          // Fetch all orders (delivered/cancelled) using Trip History API
          console.log('🔄 Fetching order history...')
          const response = await deliveryAPI.getTripHistory({
            period: 'monthly',
            date: new Date().toISOString().split('T')[0],
            status: activeTab === "delivered" ? "Completed" : activeTab === "cancelled" ? "Cancelled" : "ALL TRIPS",
            limit: 1000
          })

          if (response?.data?.success && response?.data?.data?.trips) {
            ordersData = response.data.data.trips || []
            console.log(`✅ Found ${activeTab} orders:`, ordersData.length)
            // Debug: Log first few orders to check their status
            if (ordersData.length > 0) {
              console.log('📋 Sample orders from API:', ordersData.slice(0, 3).map(o => ({
                orderId: o.orderId,
                status: o.status,
                deliveryState: o.deliveryState
              })))
            }
          } else if (response?.data?.data?.orders) {
            ordersData = response.data.data.orders || []
            console.log(`✅ Found ${activeTab} orders (from orders field):`, ordersData.length)
          } else {
            console.warn('⚠️ No trips or orders found in API response:', response?.data)
          }
        }

        setOrders(ordersData)
      } catch (error) {
        console.error('❌ Error fetching orders:', error)
        const errorMessage = error?.response?.data?.message || error?.message || 'Failed to load orders'
        toast.error(errorMessage)
        setOrders([])
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [activeTab])

  // Format date like "06 Jan, 11:57AM"
  const formatOrderDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const month = date.toLocaleDateString('en-IN', { month: 'short' })
    const hours = date.getHours()
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${day} ${month}, ${displayHours}:${minutes}${ampm}`
  }

  // Get restaurant location/address - Show full pinned address (formattedAddress)
  const getRestaurantLocation = (order) => {
    // Priority 1: Use direct snapshot fields from the order object
    if (order.restaurantAddress) return order.restaurantAddress.trim()
    if (order.restaurantLocation?.address) return order.restaurantLocation.address.trim()
    if (order.restaurantLocation?.formattedAddress) return order.restaurantLocation.formattedAddress.trim()

    // Priority 2: Use specific address fields from populated restaurantId.location
    if (order.restaurantId?.location) {
      const loc = order.restaurantId.location

      // Check full address string first
      if (loc.address && loc.address.trim() !== '' && loc.address.trim() !== 'Location not available') {
        return loc.address.trim()
      }

      // Check formatted address from maps
      if (loc.formattedAddress && loc.formattedAddress.trim() !== '' && loc.formattedAddress.trim() !== 'Select location') {
        const isCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(loc.formattedAddress.trim())
        if (!isCoordinates) return loc.formattedAddress.trim()
      }
    }

    // Priority 3: Build from address components as fallback
    if (order.restaurantId?.location) {
      const loc = order.restaurantId.location
      const parts = []

      // Add street/address line info
      if (loc.addressLine1) parts.push(loc.addressLine1.trim())
      else if (loc.street) parts.push(loc.street.trim())

      if (loc.addressLine2) parts.push(loc.addressLine2.trim())
      if (loc.area) parts.push(loc.area.trim())
      if (loc.city) parts.push(loc.city.trim())
      if (loc.state) parts.push(loc.state.trim())

      const pin = loc.pincode || loc.zipCode || loc.postalCode
      if (pin) parts.push(pin.toString().trim())

      if (parts.length > 0) return parts.join(', ')
    }

    // Priority 4: Final fallbacks
    if (order.restaurantId?.address) return order.restaurantId.address.trim()

    // Last resort: show customer city/state if absolutely nothing else (better than empty)
    if (order.address?.city) {
      return order.address.city + (order.address.state ? ', ' + order.address.state : '')
    }

    return 'Location not available'
  }

  // Get restaurant image
  const getRestaurantImage = (order) => {
    if (order.items && order.items.length > 0 && order.items[0].image) {
      return order.items[0].image
    }
    if (order.restaurantId?.profileImage?.url) {
      return order.restaurantId.profileImage.url
    }
    return "https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?auto=format&fit=crop&w=100&q=80"
  }

  // Check if payment failed
  const isPaymentFailed = (order) => {
    return order.payment?.status === 'failed' || order.payment?.status === 'pending'
  }

  // Get order status text
  const getOrderStatus = (order) => {
    const status = order.status || order.orderStatus
    if (status === 'delivered') return 'Delivered'
    if (status === 'completed') return 'Delivered'
    if (status === 'out_for_delivery') return 'Out for Delivery'
    if (status === 'ready') return 'Ready'
    if (status === 'preparing') return 'Preparing'
    if (status === 'accepted') return 'Accepted'
    if (status === 'cancelled') return 'Cancelled'
    return status || 'Pending'
  }

  // Check if order is active/assigned
  const isActiveOrder = (order) => {
    const status = order.status || order.orderStatus
    const deliveryPhase = order.deliveryState?.currentPhase
    return (
      status !== 'delivered' &&
      status !== 'completed' &&
      status !== 'cancelled' &&
      deliveryPhase !== 'completed'
    )
  }

  // Check if order is accepted by delivery boy - Hierarchical (anything after acceptance)
  const isAcceptedByDeliveryBoy = (order) => {
    const status = order.deliveryState?.status || order.status;
    const phase = order.deliveryState?.currentPhase;
    return (
      status === 'accepted' ||
      status === 'reached_pickup' ||
      status === 'order_confirmed' ||
      status === 'reached_drop' ||
      status === 'delivered' ||
      status === 'completed' ||
      [
        'en_route_to_pickup',
        'at_pickup',
        'en_route_to_delivery',
        'at_delivery',
        'delivered',
        'completed'
      ].includes(phase)
    );
  }

  // Check if reached pickup confirmed - Hierarchical (anything after reached pickup)
  const isReachedPickup = (order) => {
    const status = order.deliveryState?.status || order.status;
    const phase = order.deliveryState?.currentPhase;
    return (
      status === 'reached_pickup' ||
      status === 'order_confirmed' ||
      status === 'reached_drop' ||
      status === 'delivered' ||
      status === 'completed' ||
      [
        'at_pickup',
        'en_route_to_delivery',
        'at_delivery',
        'delivered',
        'completed'
      ].includes(phase)
    );
  }

  // Check if order picked up - Hierarchical (anything after pickup)
  const isOrderPickedUp = (order) => {
    const status = order.deliveryState?.status || order.status;
    const phase = order.deliveryState?.currentPhase;
    return (
      status === 'order_confirmed' ||
      status === 'reached_drop' ||
      status === 'delivered' ||
      status === 'completed' ||
      [
        'en_route_to_delivery',
        'at_delivery',
        'delivered',
        'completed'
      ].includes(phase) ||
      phase === 'picked_up'
    );
  }

  // Check if reached drop - Hierarchical (anything after reached drop)
  const isReachedDrop = (order) => {
    const status = order.deliveryState?.status || order.status;
    const phase = order.deliveryState?.currentPhase;
    return (
      status === 'reached_drop' ||
      status === 'delivered' ||
      status === 'completed' ||
      [
        'at_delivery',
        'delivered',
        'completed'
      ].includes(phase)
    );
  }

  // Check if order delivered - Hierarchical (anything after delivery)
  const isOrderDelivered = (order) => {
    const status = order.deliveryState?.status || order.status;
    const phase = order.deliveryState?.currentPhase;
    return (
      status === 'delivered' ||
      status === 'completed' ||
      [
        'delivered',
        'completed'
      ].includes(phase)
    );
  }

  // Filter orders by search query and tab
  const filteredOrders = orders.filter(order => {
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const restaurantName = (order.restaurantName || order.restaurant?.name || order.restaurantId?.name || '').toLowerCase()
      const itemNames = (order.items || []).map(item => item.name?.toLowerCase() || '').join(' ')
      const orderId = (order.orderId || order._id || '').toLowerCase()
      if (!restaurantName.includes(query) && !itemNames.includes(query) && !orderId.includes(query)) {
        return false
      }
    }

    // Filter by tab
    if (activeTab === "pending") {
      return isActiveOrder(order)
    } else if (activeTab === "delivered") {
      // Check multiple status fields and formats
      const status = order.status || order.orderStatus || ''
      const deliveryStatus = order.deliveryState?.status || ''
      const deliveryPhase = order.deliveryState?.currentPhase || ''
      
      // Trip History API returns "Completed" (capital C), regular orders use lowercase
      const normalizedStatus = status.toLowerCase()
      const normalizedDeliveryStatus = deliveryStatus.toLowerCase()
      
      const isDelivered = (
        normalizedStatus === 'delivered' ||
        normalizedStatus === 'completed' ||
        status === 'Completed' || // Trip History format
        normalizedDeliveryStatus === 'delivered' ||
        normalizedDeliveryStatus === 'completed' ||
        deliveryPhase === 'delivered' ||
        deliveryPhase === 'completed' ||
        isOrderDelivered(order) // Use helper function as fallback
      )
      
      // Debug logging for delivered tab
      if (!isDelivered && orders.length > 0) {
        console.log('🔍 Order filtered out from delivered:', {
          orderId: order.orderId || order._id,
          status,
          deliveryStatus,
          deliveryPhase,
          normalizedStatus,
          normalizedDeliveryStatus
        })
      }
      
      return isDelivered
    } else if (activeTab === "cancelled") {
      const status = order.status || order.orderStatus || ''
      const deliveryStatus = order.deliveryState?.status || ''
      
      // Trip History API returns "Cancelled" (capital C), regular orders use lowercase
      return (
        status === 'cancelled' ||
        status === 'Cancelled' ||
        deliveryStatus === 'cancelled' ||
        deliveryStatus === 'Cancelled'
      )
    }

    return true
  })

  const handleOrderClick = (order) => {
    const orderId = order.orderId || order._id
    if (orderId) {
      navigate(`/delivery/order/${orderId}`)
    }
  }

  // Handle accept order
  const handleAcceptOrder = async (order) => {
    const orderId = order.orderId || order._id
    if (!orderId) {
      toast.error('Order ID not found')
      return
    }

    let currentLocation = null
    try {
      // Get current location with fallback
      try {
        // First try to get from localStorage (saved by DeliveryHome.jsx) for immediate response
        const savedLocation = localStorage.getItem('deliveryBoyLastLocation')
        if (savedLocation) {
          try {
            const parsed = JSON.parse(savedLocation)
            if (Array.isArray(parsed) && parsed.length === 2) {
              currentLocation = parsed
              console.log('📍 Using saved location from localStorage:', currentLocation)
            }
          } catch (e) { /* ignore parse error */ }
        }

        // Then try fresh location if GPS is available
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 8000, // Reduced timeout for faster fallback
            enableHighAccuracy: true
          })
        }).catch(err => {
          console.warn('⚠️ High accuracy GPS failed, trying low accuracy...', err)
          return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              enableHighAccuracy: false
            })
          })
        })
        currentLocation = [position.coords.latitude, position.coords.longitude]
        console.log('📍 Got fresh location:', currentLocation)
      } catch (locErr) {
        console.error('❌ Failed to get live location:', locErr)
        // If currentLocation was already set from localStorage, we keep it
        // otherwise it remains null and backend will fallback to profile
      }

      console.log('📦 Calling acceptOrder API with:', {
        orderId,
        location: currentLocation ? `${currentLocation[0]}, ${currentLocation[1]}` : 'fallback to profile'
      })

      const response = await deliveryAPI.acceptOrder(orderId, {
        lat: currentLocation ? currentLocation[0] : null,
        lng: currentLocation ? currentLocation[1] : null
      })

      if (response.data?.success) {
        toast.success('Order accepted successfully!')
        // Refresh orders
        const fetchResponse = await deliveryAPI.getOrders({
          includeDelivered: false,
          limit: 100
        })
        if (fetchResponse?.data?.success && fetchResponse?.data?.data?.orders) {
          setOrders(fetchResponse.data.data.orders || [])
        }
        // Removed auto-navigation to stay on orders page for the sequential workflow
      } else {
        toast.error(response.data?.message || 'Failed to accept order')
      }
    } catch (error) {
      console.error('Error accepting order:', error)
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        orderId: orderId,
        location: currentLocation || 'Not available'
      })

      // Show more detailed error message
      const errorMessage = error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to accept order'
      toast.error(`Error: ${errorMessage}`)
    }
  }

  // Handle reject order
  const handleRejectOrder = async (order) => {
    const orderId = order.orderId || order._id
    if (!orderId) {
      toast.error('Order ID not found')
      return
    }

    try {
      const response = await deliveryAPI.denyOrder(orderId, {
        reason: 'Not available'
      })

      if (response.data?.success) {
        toast.success('Order rejected')
        // Refresh orders
        const fetchResponse = await deliveryAPI.getOrders({
          includeDelivered: false,
          limit: 100
        })
        if (fetchResponse?.data?.success && fetchResponse?.data?.data?.orders) {
          setOrders(fetchResponse.data.data.orders || [])
        }
      } else {
        toast.error(response.data?.message || 'Failed to reject order')
      }
    } catch (error) {
      console.error('Error rejecting order:', error)
      toast.error(error.response?.data?.message || 'Failed to reject order')
    }
  }

  // Reusable Swipe Button Component
  const SwipeButton = ({ label, onComplete, color = "bg-green-600", progressColor = "bg-green-500", icon = <ArrowRight className="w-5 h-5 text-white" /> }) => {
    const [progress, setProgress] = useState(0)
    const [isAnimating, setIsAnimating] = useState(false)
    const buttonRef = useRef(null)
    const startX = useRef(0)
    const startY = useRef(0)
    const isSwiping = useRef(false)

    const handleStart = (clientX, clientY) => {
      startX.current = clientX
      startY.current = clientY
      isSwiping.current = false
      setIsAnimating(false)
      setProgress(0)
    }

    const handleMove = (clientX, clientY) => {
      if (!startX.current) return
      const deltaX = clientX - startX.current
      const deltaY = clientY - startY.current

      // Horizontal swipe detection
      if (deltaX > 5 && deltaX > Math.abs(deltaY)) {
        isSwiping.current = true
        const buttonWidth = buttonRef.current?.offsetWidth || 300
        const circleWidth = 48
        const maxSwipe = buttonWidth - circleWidth - 8
        const newProgress = Math.min(Math.max(deltaX / maxSwipe, 0), 1)
        setProgress(newProgress)
      }
    }

    const handleEnd = () => {
      if (!isSwiping.current) {
        setProgress(0)
        startX.current = 0
        return
      }
      if (progress > 0.75) {
        setIsAnimating(true)
        setProgress(1)
        setTimeout(() => {
          onComplete()
          setTimeout(() => {
            setProgress(0)
            setIsAnimating(false)
          }, 300)
        }, 200)
      } else {
        setProgress(0)
      }
      isSwiping.current = false
      startX.current = 0
    }

    return (
      <div className="relative w-full h-full">
        <motion.div
          ref={buttonRef}
          className={`relative w-full h-full ${color} rounded-xl overflow-hidden`}
          style={{ touchAction: 'pan-x' }}
          onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={handleEnd}
          onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
          onMouseMove={(e) => {
            if (e.buttons === 1) handleMove(e.clientX, e.clientY)
          }}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
        >
          <motion.div
            className={`absolute inset-0 ${progressColor} rounded-xl`}
            animate={{ width: `${progress * 100}%` }}
            transition={isAnimating ? { type: "spring", stiffness: 200, damping: 25 } : { duration: 0 }}
          />
          <div className="relative flex items-center h-full px-1">
            <motion.div
              className="w-12 h-12 bg-gray-900 rounded-lg flex items-center justify-center shrink-0 relative z-20 shadow-xl"
              animate={{ x: progress * (buttonRef.current ? (buttonRef.current.offsetWidth - 56) : 240) }}
              transition={isAnimating ? { type: "spring", stiffness: 300, damping: 30 } : { duration: 0 }}
            >
              {icon}
            </motion.div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-white font-bold text-xs uppercase tracking-widest">{label}</span>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  // 1. Swipeable Accept/Reject Button (Integrated into one green bar)
  const ActionButton = ({ order, onAccept, onReject }) => (
    <div className="relative w-full overflow-hidden rounded-xl h-14 flex items-center bg-green-600 shadow-lg">
      <div className="flex-1 h-full min-w-0">
        <SwipeButton
          label="Accept Order"
          onComplete={() => onAccept(order)}
          color="bg-transparent"
          progressColor="bg-green-500"
          icon={<Check className="w-5 h-5 text-white" />}
        />
      </div>
      <div className="w-[1px] h-8 bg-white/20" />
      <button
        onClick={(e) => {
          e.stopPropagation()
          onReject(order)
        }}
        className="px-6 h-full text-white font-bold text-xs uppercase tracking-widest hover:bg-black/10 transition-colors shrink-0"
      >
        Reject
      </button>
    </div>
  )

  // 2. Swipeable Reached Pickup Button
  const ReachedPickupButton = ({ order, onReachedPickup }) => (
    <SwipeButton
      label="Reached Pickup"
      onComplete={() => onReachedPickup(order)}
      color="bg-green-600"
      progressColor="bg-green-500"
      icon={<MapPin className="w-5 h-5 text-white" />}
    />
  )

  // State for bill image upload
  const [billImages, setBillImages] = useState({}) // { orderId: imageUrl }
  const [uploadingBills, setUploadingBills] = useState({}) // { orderId: true/false }
  const fileInputRefs = useRef(null)

  // Handle reached pickup
  const handleReachedPickup = async (order) => {
    const orderId = order.orderId || order._id
    if (!orderId) {
      toast.error('Order ID not found')
      return
    }

    try {
      const response = await deliveryAPI.confirmReachedPickup(orderId)

      if (response.data?.success) {
        toast.success('Reached pickup confirmed!')
        // Refresh orders
        const fetchResponse = await deliveryAPI.getOrders({
          includeDelivered: false,
          limit: 100
        })
        if (fetchResponse?.data?.success && fetchResponse?.data?.data?.orders) {
          setOrders(fetchResponse.data.data.orders || [])
        }
      } else {
        toast.error(response.data?.message || 'Failed to confirm reached pickup')
      }
    } catch (error) {
      console.error('Error confirming reached pickup:', error)
      toast.error(error.response?.data?.message || 'Failed to confirm reached pickup')
    }
  }

  // Handle bill image capture/upload
  const handleBillImageCapture = async (order, e) => {
    e.stopPropagation()
    const orderId = order.orderId || order._id

    // Check if Flutter handler is available
    if (window.flutter_inappwebview && typeof window.flutter_inappwebview.callHandler === 'function') {
      try {
        const result = await window.flutter_inappwebview.callHandler('openCamera', {
          source: 'camera',
          accept: 'image/*',
          multiple: false,
          quality: 0.8
        })

        if (result && result.success && result.file) {
          await handleBillImageUpload(order, result.file)
        }
      } catch (error) {
        console.error('Error with Flutter camera:', error)
        // Fallback to file input
        setActiveBillUploadOrder(order)
        setTimeout(() => fileInputRefs.current?.click(), 100)
      }
    } else {
      // Fallback to file input
      setActiveBillUploadOrder(order)
      setTimeout(() => fileInputRefs.current?.click(), 100)
    }
  }

  // Handle bill image file selection
  const handleBillImageSelect = async (order, e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB')
      return
    }

    await handleBillImageUpload(order, file)
  }

  // Upload bill image
  const handleBillImageUpload = async (order, file) => {
    const orderId = order.orderId || order._id
    setUploadingBills(prev => ({ ...prev, [orderId]: true }))

    try {
      const response = await uploadAPI.uploadMedia(file, {
        folder: 'appzeto/delivery/bills'
      })

      if (response?.data?.success && response?.data?.data?.url) {
        setBillImages(prev => ({ ...prev, [orderId]: response.data.data.url }))
        toast.success('Bill image uploaded!')
      } else {
        throw new Error('Upload failed')
      }
    } catch (error) {
      console.error('Error uploading bill:', error)
      toast.error('Failed to upload bill image')
    } finally {
      setUploadingBills(prev => ({ ...prev, [orderId]: false }))
    }
  }


  // Handle order pickup (after bill upload)
  const handleOrderPickup = async (order) => {
    const orderId = order.orderId || order._id
    if (!orderId) {
      toast.error('Order ID not found')
      return
    }

    const billImageUrl = billImages[orderId]
    if (!billImageUrl) {
      toast.error('Please upload bill image first')
      return
    }

    try {
      const response = await deliveryAPI.confirmOrderId(orderId, order.orderId || orderId, {}, {
        billImageUrl
      })

      if (response.data?.success) {
        toast.success('Order picked up!')
        // Refresh orders
        const fetchResponse = await deliveryAPI.getOrders({
          includeDelivered: false,
          limit: 100
        })
        if (fetchResponse?.data?.success && fetchResponse?.data?.data?.orders) {
          setOrders(fetchResponse.data.data.orders || [])
        }
      } else {
        toast.error(response.data?.message || 'Failed to confirm order pickup')
      }
    } catch (error) {
      console.error('Error confirming order pickup:', error)
      toast.error(error.response?.data?.message || 'Failed to confirm order pickup')
    }
  }

  // Handle reached drop
  const handleReachedDrop = async (order) => {
    const orderId = order.orderId || order._id
    if (!orderId) {
      toast.error('Order ID not found')
      return
    }

    try {
      const response = await deliveryAPI.confirmReachedDrop(orderId)

      if (response.data?.success) {
        toast.success('Reached drop confirmed!')
        // Refresh orders
        const fetchResponse = await deliveryAPI.getOrders({
          includeDelivered: false,
          limit: 100
        })
        if (fetchResponse?.data?.success && fetchResponse?.data?.data?.orders) {
          setOrders(fetchResponse.data.data.orders || [])
        }
      } else {
        toast.error(response.data?.message || 'Failed to confirm reached drop')
      }
    } catch (error) {
      console.error('Error confirming reached drop:', error)
      toast.error(error.response?.data?.message || 'Failed to confirm reached drop')
    }
  }

  // Handle order delivered
  const handleOrderDelivered = async (order) => {
    const orderId = order.orderId || order._id
    if (!orderId) {
      toast.error('Order ID not found')
      return
    }

    try {
      // Instead of completing, we show the rating popup first
      setSelectedOrderForRating(order)
      setShowRatingPopup(true)
    } catch (error) {
      console.error('Error opening rating popup:', error)
      toast.error('Something went wrong')
    }
  }

  // Handle Rating Submission
  const handleRatingSubmit = async () => {
    if (!selectedOrderForRating) return

    setSubmittingRating(true)
    try {
      const orderId = selectedOrderForRating.orderId || selectedOrderForRating._id
      const response = await deliveryAPI.completeDelivery(orderId, ratingValue, reviewText)

      if (response.data?.success) {
        const earnings = response.data.data?.earnings?.amount || response.data.data?.totalEarning || 0
        toast.success('Review submitted! Order completed.')

        setShowRatingPopup(false)
        navigate('/delivery/order-completed', {
          state: {
            earnings: earnings,
            orderId: selectedOrderForRating.orderId || orderId
          }
        })
      } else {
        toast.error(response.data?.message || 'Failed to submit review')
      }
    } catch (error) {
      console.error('Error submitting rating:', error)
      toast.error('Failed to submit review. Please try again.')
    } finally {
      setSubmittingRating(false)
    }
  }

  // Handle location button click - navigate to DeliveryHome with order data (restaurant location)
  const handleRestaurantLocationClick = async (order, e) => {
    e.stopPropagation()

    try {
      // Get current location
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000,
          enableHighAccuracy: true
        })
      })

      const currentLocation = [position.coords.latitude, position.coords.longitude]

      // Prepare order data for DeliveryHome (restaurant route)
      const orderData = {
        id: order.orderId || order._id,
        orderId: order.orderId,
        name: order.restaurantName || order.restaurantId?.name || 'Restaurant',
        address: getRestaurantLocation(order),
        lat: order.restaurantId?.location?.coordinates?.[1] || order.restaurantId?.location?.latitude,
        lng: order.restaurantId?.location?.coordinates?.[0] || order.restaurantId?.location?.longitude,
        customerName: order.userId?.name || 'Customer',
        customerAddress: order.address?.formattedAddress || order.address?.street || 'Customer address',
        customerLat: order.address?.location?.coordinates?.[1] || order.address?.location?.latitude,
        customerLng: order.address?.location?.coordinates?.[0] || order.address?.location?.longitude,
        items: order.items || [],
        total: order.pricing?.total || 0,
        paymentMethod: order.payment?.method || 'razorpay',
        orderStatus: order.status || 'preparing',
        deliveryPhase: order.deliveryState?.currentPhase || 'en_route_to_pickup',
        distance: order.assignmentInfo?.distance || null,
        pickupDistance: order.assignmentInfo?.distance || null,
        estimatedEarnings: order.pricing?.deliveryFee || 0
      }

      // Store order data in localStorage for DeliveryHome to use
      localStorage.setItem('deliveryActiveOrder', JSON.stringify({
        restaurantInfo: orderData,
        showMap: true,
        showRoute: true,
        showRoutePath: true, // Enable route path display
        hasDirectionsAPI: true,
        acceptedAt: new Date().toISOString(),
        currentLocation: currentLocation,
        navigationMode: 'restaurant', // Route to restaurant
        shouldShowPolyline: true, // Flag to show polyline
        enableLiveTracking: true // Enable live tracking
      }))

      // Navigate to DeliveryHome
      navigate('/delivery')
    } catch (error) {
      console.error('Error getting location:', error)
      toast.error('Location not available. Please enable location services.')
    }
  }

  // Handle customer location button click - navigate to DeliveryHome with customer route
  const handleCustomerLocationClick = async (order, e) => {
    e.stopPropagation()

    try {
      // Get current location
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000,
          enableHighAccuracy: true
        })
      })

      const currentLocation = [position.coords.latitude, position.coords.longitude]

      // Prepare order data for DeliveryHome (customer route)
      const orderData = {
        id: order.orderId || order._id,
        orderId: order.orderId,
        name: order.restaurantName || order.restaurantId?.name || 'Restaurant',
        address: getRestaurantLocation(order),
        lat: order.restaurantId?.location?.coordinates?.[1] || order.restaurantId?.location?.latitude,
        lng: order.restaurantId?.location?.coordinates?.[0] || order.restaurantId?.location?.longitude,
        customerName: order.userId?.name || 'Customer',
        customerAddress: order.address?.formattedAddress || order.address?.street || 'Customer address',
        customerLat: order.address?.location?.coordinates?.[1] || order.address?.location?.latitude,
        customerLng: order.address?.location?.coordinates?.[0] || order.address?.location?.longitude,
        items: order.items || [],
        total: order.pricing?.total || 0,
        paymentMethod: order.payment?.method || 'razorpay',
        orderStatus: order.status || 'preparing',
        deliveryPhase: order.deliveryState?.currentPhase || 'en_route_to_delivery',
        distance: order.assignmentInfo?.distance || null,
        estimatedEarnings: order.pricing?.deliveryFee || 0
      }

      // Store order data in localStorage for DeliveryHome to use
      localStorage.setItem('deliveryActiveOrder', JSON.stringify({
        restaurantInfo: orderData,
        showMap: true,
        showRoute: true,
        hasDirectionsAPI: true,
        acceptedAt: new Date().toISOString(),
        currentLocation: currentLocation,
        navigationMode: 'customer' // Route to customer
      }))

      // Navigate to DeliveryHome
      navigate('/delivery')
    } catch (error) {
      console.error('Error getting location:', error)
      toast.error('Location not available. Please enable location services.')
    }
  }

  // No swipeable action button needed anymore, replaced by ActionButton

  // 3. Swipeable Order Pickup Button
  const OrderPickupButton = ({ order, onPickup, billImageUrl, isUploading, onCameraClick }) => {
    const orderId = order.orderId || order._id

    return (
      <div className="space-y-3">
        <div className="flex gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onCameraClick(order, e)
            }}
            disabled={isUploading}
            className={`flex-1 flex items-center justify-center gap-2 p-3.5 rounded-xl border-2 border-dashed transition-all ${billImageUrl ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 bg-gray-50 text-gray-500 hover:border-orange-500'
              }`}
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Camera className="w-5 h-5" />
                <span>{billImageUrl ? 'Update Bill' : 'Upload Bill Image'}</span>
              </>
            )}
          </button>
        </div>
        <SwipeButton
          label="Confirm Order Pickup"
          onComplete={() => {
            if (billImageUrl) onPickup(order)
            else toast.error('Please upload bill image first')
          }}
          color={billImageUrl ? "bg-green-600" : "bg-gray-300"}
          progressColor={billImageUrl ? "bg-green-500" : "bg-gray-400"}
          icon={<Package className="w-5 h-5 text-white" />}
        />
      </div>
    )
  }

  // 4. Swipeable Reached Drop Button
  const ReachedDropButton = ({ order, onReachedDrop }) => (
    <SwipeButton
      label="Reached Drop"
      onComplete={() => onReachedDrop(order)}
      color="bg-green-600"
      progressColor="bg-green-500"
      icon={<Navigation className="w-5 h-5 text-white" />}
    />
  )

  // 5. Swipeable Order Delivered Button
  const OrderDeliveredButton = ({ order, onDelivered }) => {
    const paymentMethod = (order.payment?.method || '').toLowerCase()
    const isCOD = paymentMethod === 'cash' || paymentMethod === 'cod'
    const total = order.pricing?.total || 0

    return (
      <div className="space-y-3">
        {isCOD && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Collect from customer (COD)</span>
              </div>
              <span className="text-lg font-bold text-amber-700">
                ₹{total.toFixed(2)}
              </span>
            </div>
          </div>
        )}
        <SwipeButton
          label="Mark as Delivered"
          onComplete={() => onDelivered(order)}
          color="bg-green-600"
          progressColor="bg-green-500"
          icon={<CheckCircle2 className="w-5 h-5 text-white" />}
        />
      </div>
    )
  }

  // Complete Button Component (with earnings)
  const CompleteButton = ({ order, earnings }) => {
    return (
      <button
        onClick={async () => {
          toast.success(`Order completed! Earnings: ₹${earnings.toFixed(2)}`)
          const fetchResponse = await deliveryAPI.getOrders({
            includeDelivered: false,
            limit: 100
          })
          if (fetchResponse?.data?.success && fetchResponse?.data?.data?.orders) {
            setOrders(fetchResponse.data.data.orders || [])
          }
        }}
        className="w-full h-14 rounded-xl bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold text-base flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
      >
        <CheckCircle2 className="w-5 h-5" />
        <span>Complete - Earnings: ₹{earnings.toFixed(2)}</span>
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      {/* Header */}
      <div className="bg-white p-4 flex items-center shadow-sm sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="ml-4 text-xl font-semibold text-gray-800">Orders</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-[73px] z-10">
        <div className="flex">
          <button
            onClick={() => setActiveTab("pending")}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors relative ${activeTab === "pending"
              ? "text-orange-600"
              : "text-gray-600"
              }`}
          >
            Pending
            {activeTab === "pending" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600" />
            )}
            {activeTab === "pending" && filteredOrders.length > 0 && (
              <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                {filteredOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("delivered")}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors relative ${activeTab === "delivered"
              ? "text-green-600"
              : "text-gray-600"
              }`}
          >
            Delivered
            {activeTab === "delivered" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("cancelled")}
            className={`flex-1 py-3 px-4 text-center font-medium transition-colors relative ${activeTab === "cancelled"
              ? "text-red-600"
              : "text-gray-600"
              }`}
          >
            Cancelled
            {activeTab === "cancelled" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />
            )}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 bg-white">
        <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
          <Search className="w-5 h-5 text-orange-500" />
          <input
            type="text"
            placeholder="Search by order ID, restaurant or dish"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 ml-3 outline-none text-gray-600 placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="ml-2 p-1 hover:bg-gray-100 rounded-full"
            >
              <XCircle className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Orders List */}
      <div className="px-4 py-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-4" />
            <p className="text-gray-600">Loading orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Package className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery ? "No orders found" : `No ${activeTab} orders`}
            </h3>
            <p className="text-gray-600 text-sm text-center">
              {searchQuery
                ? "Try searching with different keywords"
                : activeTab === "pending"
                  ? "You don't have any active assigned orders"
                  : `You don't have any ${activeTab} orders yet`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const restaurantName = order.restaurantName || order.restaurantId?.name || 'Restaurant'
              const restaurantLocation = getRestaurantLocation(order)
              const restaurantImage = getRestaurantImage(order)
              const orderDate = formatOrderDate(order.createdAt)
              const orderStatus = getOrderStatus(order)
              const orderPrice = order.pricing?.total || order.total || 0
              const paymentFailed = isPaymentFailed(order)
              const isDelivered = order.status === 'delivered' || order.status === 'completed'
              const isCancelled = order.status === 'cancelled'
              const isActive = isActiveOrder(order)
              const rating = order.rating || order.deliveryState?.rating || null
              const orderId = order.orderId || order._id || 'N/A'

              return (
                <div
                  key={order._id || order.orderId || Math.random()}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Active Order Badge */}
                  {isActive && activeTab === "pending" && (
                    <div className="bg-orange-50 border-b border-orange-200 px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-orange-600" />
                        <span className="text-xs font-semibold text-orange-600">Active Assigned Order</span>
                      </div>
                    </div>
                  )}

                  {/* Card Header: Restaurant Info */}
                  <div className="flex items-start justify-between p-4 pb-2">
                    <div className="flex gap-3 flex-1">
                      {/* Restaurant/Food Image */}
                      <div className="w-14 h-14 rounded-lg bg-gray-200 overflow-hidden shrink-0">
                        <img
                          src={restaurantImage}
                          alt={restaurantName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = "https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?auto=format&fit=crop&w=100&q=80"
                          }}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-800 text-lg leading-tight truncate">{restaurantName}</h3>
                          {/* Location Button - Show for pickup phase */}
                          {isActive && activeTab === "pending" && isAcceptedByDeliveryBoy(order) && !isOrderPickedUp(order) && (
                            <button
                              onClick={(e) => handleRestaurantLocationClick(order, e)}
                              className="p-1.5 hover:bg-green-50 rounded-full transition-colors shrink-0"
                              title="View restaurant location on map"
                            >
                              <MapPin className="w-4 h-4 text-green-600" />
                            </button>
                          )}
                          {/* Location Button - Show for drop phase */}
                          {isActive && activeTab === "pending" && isOrderPickedUp(order) && !isReachedDrop(order) && (
                            <button
                              onClick={(e) => handleCustomerLocationClick(order, e)}
                              className="p-1.5 hover:bg-blue-50 rounded-full transition-colors shrink-0"
                              title="View customer location on map"
                            >
                              <MapPin className="w-4 h-4 text-blue-600" />
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {(() => {
                            // Priority 1: Show restaurant pin location (formattedAddress) if available
                            const loc = order.restaurantId?.location || order.restaurantLocation
                            
                            if (loc?.formattedAddress && loc.formattedAddress.trim() !== '' && loc.formattedAddress.trim() !== 'Select location') {
                              // Check if it's coordinates, skip if so
                              const isCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(loc.formattedAddress.trim())
                              if (!isCoordinates) {
                                return loc.formattedAddress.trim()
                              }
                            }
                            
                            // Priority 2: Build from address components
                            if (loc) {
                              const parts = []
                              if (loc.addressLine1) parts.push(loc.addressLine1.trim())
                              else if (loc.street) parts.push(loc.street.trim())
                              
                              if (loc.addressLine2) parts.push(loc.addressLine2.trim())
                              if (loc.area) parts.push(loc.area.trim())
                              if (loc.city) parts.push(loc.city.trim())
                              if (loc.state) parts.push(loc.state.trim())
                              
                              const pin = loc.pincode || loc.zipCode || loc.postalCode
                              if (pin) parts.push(pin.toString().trim())
                              
                              if (parts.length > 0) {
                                return parts.join(', ')
                              }
                              
                              // Check address field
                              if (loc.address && loc.address.trim() !== '' && loc.address.trim() !== 'Location not available') {
                                return loc.address.trim()
                              }
                            }
                            
                            // Priority 3: Use getRestaurantLocation helper
                            const helperLocation = getRestaurantLocation(order)
                            if (helperLocation && helperLocation !== 'Location not available') {
                              return helperLocation
                            }
                            
                            return 'Location not available'
                          })()}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Order ID: {orderId}</p>
                      </div>
                    </div>

                    <div className="relative">
                      <button
                        className="p-1 hover:bg-gray-100 rounded-full shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowMenuForOrder(showMenuForOrder === orderId ? null : orderId)
                        }}
                      >
                        <MoreVertical className="w-5 h-5 text-gray-400" />
                      </button>
                      
                      {/* Dropdown Menu */}
                      {showMenuForOrder === orderId && (
                        <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-xl z-50 min-w-[150px]">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              // Close menu first
                              setShowMenuForOrder(null)
                              
                              // Navigate to order details page
                              const orderIdToNavigate = order.orderId || order._id || orderId
                              console.log('🔍 View Details clicked for order:', orderIdToNavigate, order)
                              
                              if (orderIdToNavigate) {
                                const path = `/delivery/order-details/${orderIdToNavigate}`
                                console.log('📍 Navigating to:', path)
                                
                                // Use setTimeout to ensure menu closes before navigation
                                setTimeout(() => {
                                  navigate(path, { replace: false })
                                }, 50)
                              } else {
                                console.error('❌ Order ID not found:', order)
                                toast.error('Order ID not found')
                              }
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            View Details
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Separator */}
                  {activeTab !== "delivered" && (
                  <div className="border-t border-dashed border-gray-200 mx-4 my-1"></div>
                  )}

                  {/* Items List - Hidden for delivered orders */}
                  {activeTab !== "delivered" && (
                  <div className="px-4 py-2">
                    {order.items && order.items.length > 0 ? (
                      order.items.map((item, idx) => (
                        <div key={item._id || item.itemId || idx} className="flex items-center justify-between gap-2 mt-2 first:mt-0">
                          <div className="flex items-center gap-2 flex-1">
                            <div className={`w-4 h-4 border ${item.isVeg ? 'border-green-600' : 'border-red-600'} flex items-center justify-center p-[2px] shrink-0`}>
                              <div className={`w-full h-full rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`}></div>
                            </div>
                            <span className="text-sm text-gray-700 font-medium">
                              {item.quantity || 1} x {item.name}
                            </span>
                          </div>
                          {item.price && (
                            <span className="text-sm text-gray-600 font-medium">
                              ₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No items listed</p>
                    )}
                  </div>
                  )}

                  {/* Order Details - Show full details for delivered orders */}
                  {activeTab === "delivered" && (
                    <>
                      <div className="border-t border-dashed border-gray-200 mx-4 my-2"></div>
                      
                      {/* Customer Details - Hidden */}
                      {false && (
                      <div className="px-4 py-2 space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-semibold text-gray-600 min-w-[80px]">Customer:</span>
                          <span className="text-xs text-gray-800">{order.userId?.name || order.customer || 'N/A'}</span>
                        </div>
                        
                        {order.address && (
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-semibold text-gray-600 min-w-[80px]">Address:</span>
                            <div className="flex-1">
                              {order.address.formattedAddress ? (
                                <span className="text-xs text-gray-800">{order.address.formattedAddress}</span>
                              ) : (
                                <div className="text-xs text-gray-800">
                                  {order.address.street && <div>{order.address.street}</div>}
                                  {(order.address.area || order.address.city) && (
                                    <div>{[order.address.area, order.address.city].filter(Boolean).join(', ')}</div>
                                  )}
                                  {(order.address.state || order.address.pincode || order.address.zipCode) && (
                                    <div>{[order.address.state, order.address.pincode || order.address.zipCode].filter(Boolean).join(' - ')}</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {order.userId?.phone && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-600 min-w-[80px]">Phone:</span>
                            <span className="text-xs text-gray-800">{order.userId.phone}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-600 min-w-[80px]">Payment:</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            (order.payment?.method || order.paymentMethod || '').toLowerCase() === 'cash' || 
                            (order.payment?.method || order.paymentMethod || '').toLowerCase() === 'cod'
                              ? 'bg-amber-100 text-amber-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {(() => {
                              const paymentMethod = (order.payment?.method || order.paymentMethod || 'razorpay').toLowerCase()
                              if (paymentMethod === 'cash' || paymentMethod === 'cod') {
                                return 'COD'
                              }
                              return 'Online'
                            })()}
                          </span>
                        </div>
                        
                        {order.deliveredAt && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-600 min-w-[80px]">Delivered:</span>
                            <span className="text-xs text-gray-800">{formatOrderDate(order.deliveredAt)}</span>
                          </div>
                        )}
                      </div>
                      )}

                    </>
                  )}

                  {/* Date and Price */}
                  {activeTab === "delivered" ? (
                    <div className="px-4 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-green-600">
                          {orderStatus}
                        </span>
                        {(() => {
                          const earnings = order.pricing?.deliveryFee || order.estimatedEarnings || order.earnings || 0
                          return (
                            <span className="text-green-600 font-bold text-lg">
                              Earnings: ₹{Number(earnings).toFixed(2)}
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-2 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400">Order placed on {orderDate}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs font-medium ${isDelivered ? 'text-green-600' :
                            isCancelled ? 'text-red-600' :
                              'text-orange-600'
                            }`}>
                            {orderStatus}
                          </span>
                          {isActive && activeTab === "pending" && (
                            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm font-semibold text-gray-800">₹{orderPrice.toFixed(2)}</span>
                        <ChevronRight className="w-4 h-4 text-gray-400 ml-1" />
                      </div>
                    </div>
                  )}

                  {/* Separator */}
                  <div className="border-t border-gray-100 mx-4"></div>

                  {/* Card Footer: Actions */}
                  <div className="px-4 py-3">
                    {/* Swipeable Action Button - Only for active pending orders */}
                    {isActive && activeTab === "pending" ? (
                      // Phase 1: Order not accepted yet - show Accept/Reject button
                      !isAcceptedByDeliveryBoy(order) ? (
                        <ActionButton
                          order={order}
                          onAccept={handleAcceptOrder}
                          onReject={handleRejectOrder}
                        />
                      ) : // Phase 2: Accepted but not reached pickup - show Reached Pickup button
                        !isReachedPickup(order) ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <ReachedPickupButton
                                order={order}
                                onReachedPickup={handleReachedPickup}
                              />
                            </div>
                            <button
                              onClick={(e) => handleRestaurantLocationClick(order, e)}
                              className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center text-green-600 shadow-sm border border-green-100"
                              title="View restaurant location"
                            >
                              <MapPin className="w-6 h-6" />
                            </button>
                          </div>
                        ) : // Phase 3: Reached pickup but not picked up - show Order Pickup with bill upload
                          !isOrderPickedUp(order) ? (
                            <OrderPickupButton
                              order={order}
                              onPickup={handleOrderPickup}
                              billImageUrl={billImages[order.orderId || order._id]}
                              isUploading={uploadingBills[order.orderId || order._id]}
                              onCameraClick={handleBillImageCapture}
                            />
                          ) : // Phase 4: Picked up but not reached drop - show Reached Drop button with Location Icon
                            !isReachedDrop(order) ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1">
                                  <ReachedDropButton
                                    order={order}
                                    onReachedDrop={handleReachedDrop}
                                  />
                                </div>
                                <button
                                  onClick={(e) => handleCustomerLocationClick(order, e)}
                                  className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-blue-100"
                                  title="View customer location"
                                >
                                  <MapPin className="w-6 h-6" />
                                </button>
                              </div>
                            ) : // Phase 5: Reached drop but not delivered - show Order Delivered
                              !isOrderDelivered(order) ? (
                                <OrderDeliveredButton
                                  order={order}
                                  onDelivered={handleOrderDelivered}
                                />
                              ) : // Phase 6: Delivered - show Complete button with earnings
                                (
                                  <CompleteButton
                                    order={order}
                                    earnings={order.pricing?.deliveryFee || order.estimatedEarnings || 0}
                                  />
                                )
                    ) : paymentFailed ? (
                      <div className="flex items-center gap-2">
                        <div className="bg-red-100 p-1 rounded-full">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        </div>
                        <span className="text-xs font-semibold text-red-500">Payment failed</span>
                      </div>
                    ) : isDelivered && rating ? (
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-800">You rated</span>
                          <div className="flex bg-yellow-400 text-white px-1 rounded text-[10px] items-center gap-0.5 h-4">
                            {rating}<Star className="w-2 h-2 fill-current" />
                          </div>
                        </div>
                      </div>
                    ) : !isCancelled ? (
                      // Removed Reorder button as per user request
                      // Hide status for delivered orders (already shown at top)
                      activeTab !== "delivered" ? (
                      <div className="flex items-center justify-center py-2">
                        <span className="text-sm text-gray-600">{orderStatus}</span>
                      </div>
                      ) : null
                    ) : (
                      <div>
                        <span className="text-sm text-gray-800">{orderStatus}</span>
                      </div>
        )}
      </div>

      {/* Close menu when clicking outside */}
      {showMenuForOrder && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenuForOrder(null)}
        />
      )}
    </div>
  )
})}
          </div>
        )}
      </div>

      {/* Order Details Dialog */}
      <Dialog open={showOrderDetailsDialog} onOpenChange={setShowOrderDetailsDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {selectedOrderForDetails && (
            <>
              <DialogHeader>
                <DialogTitle>Order Details</DialogTitle>
                <DialogDescription>
                  Order ID: {selectedOrderForDetails.orderId || selectedOrderForDetails._id || 'N/A'}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 mt-4">
                {/* Order Time */}
                <div className="border-b pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-700">Order Placed</span>
                  </div>
                  <p className="text-sm text-gray-600 ml-6">
                    {formatOrderDate(selectedOrderForDetails.createdAt)}
                  </p>
                </div>

                {/* Customer Details - Hidden */}
                {false && (
                <>
                <div className="border-b pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-700">Customer Details</span>
                  </div>
                  <div className="ml-6 space-y-1">
                    <p className="text-sm text-gray-800">
                      <span className="font-medium">Name:</span> {selectedOrderForDetails.userId?.name || selectedOrderForDetails.customer || 'N/A'}
                    </p>
                    {selectedOrderForDetails.userId?.phone && (
                      <p className="text-sm text-gray-800">
                        <span className="font-medium">Phone:</span> {selectedOrderForDetails.userId.phone}
                      </p>
                    )}
                  </div>
                </div>

                {selectedOrderForDetails.address && (
                  <div className="border-b pb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-semibold text-gray-700">Customer Address</span>
                    </div>
                    <div className="ml-6">
                      {selectedOrderForDetails.address.formattedAddress ? (
                        <p className="text-sm text-gray-800">{selectedOrderForDetails.address.formattedAddress}</p>
                      ) : (
                        <div className="text-sm text-gray-800 space-y-1">
                          {selectedOrderForDetails.address.street && (
                            <p>{selectedOrderForDetails.address.street}</p>
                          )}
                          {(selectedOrderForDetails.address.area || selectedOrderForDetails.address.city) && (
                            <p>{[selectedOrderForDetails.address.area, selectedOrderForDetails.address.city].filter(Boolean).join(', ')}</p>
                          )}
                          {(selectedOrderForDetails.address.state || selectedOrderForDetails.address.pincode || selectedOrderForDetails.address.zipCode) && (
                            <p>{[selectedOrderForDetails.address.state, selectedOrderForDetails.address.pincode || selectedOrderForDetails.address.zipCode].filter(Boolean).join(' - ')}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                </>
                )}

                {/* Restaurant Details */}
                <div className="border-b pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Navigation className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-semibold text-gray-700">Restaurant Details</span>
                  </div>
                  <div className="ml-6 space-y-1">
                    <p className="text-sm text-gray-800">
                      <span className="font-medium">Name:</span> {selectedOrderForDetails.restaurantName || selectedOrderForDetails.restaurantId?.name || selectedOrderForDetails.restaurant || 'N/A'}
                    </p>
                    <div>
                      <span className="font-medium text-sm text-gray-800">Address: </span>
                      {(() => {
                        const loc = selectedOrderForDetails.restaurantId?.location || selectedOrderForDetails.restaurantLocation
                        if (loc?.formattedAddress) {
                          return <span className="text-sm text-gray-800">{loc.formattedAddress}</span>
                        }
                        if (loc?.addressLine1) {
                          return (
                            <span className="text-sm text-gray-800">
                              {loc.addressLine1}
                              {loc.addressLine2 && `, ${loc.addressLine2}`}
                              {loc.area && `, ${loc.area}`}
                              {loc.city && `, ${loc.city}`}
                              {loc.state && `, ${loc.state}`}
                              {loc.pincode && ` - ${loc.pincode}`}
                            </span>
                          )
                        }
                        return <span className="text-sm text-gray-500">Location not available</span>
                      })()}
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                {selectedOrderForDetails.items && selectedOrderForDetails.items.length > 0 && (
                  <div className="border-b pb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-4 h-4 text-orange-500" />
                      <span className="text-sm font-semibold text-gray-700">Order Items</span>
                    </div>
                    <div className="ml-6 space-y-2">
                      {selectedOrderForDetails.items.map((item, idx) => (
                        <div key={item._id || item.itemId || idx} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 border ${item.isVeg ? 'border-green-600' : 'border-red-600'} flex items-center justify-center p-[1px] shrink-0`}>
                              <div className={`w-full h-full rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`}></div>
                            </div>
                            <span className="text-sm text-gray-800">
                              {item.quantity || 1} x {item.name}
                            </span>
                          </div>
                          {item.price && (
                            <span className="text-sm text-gray-600 font-medium">
                              ₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Delivery Time */}
                {selectedOrderForDetails.deliveredAt && (
                  <div className="border-b pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-semibold text-gray-700">Delivered At</span>
                    </div>
                    <p className="text-sm text-gray-600 ml-6">
                      {formatOrderDate(selectedOrderForDetails.deliveredAt)}
                    </p>
                  </div>
                )}

                {/* Earnings */}
                {(selectedOrderForDetails.pricing?.deliveryFee || selectedOrderForDetails.estimatedEarnings) && (
                  <div className="border-b pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <IndianRupee className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-semibold text-gray-700">Earnings</span>
                    </div>
                    <p className="text-sm text-green-600 font-semibold ml-6">
                      ₹{(selectedOrderForDetails.pricing?.deliveryFee || selectedOrderForDetails.estimatedEarnings || 0).toFixed(2)}
                    </p>
                  </div>
                )}

                {/* Payment Method */}
                <div className="border-b pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-700">Payment Mode</span>
                  </div>
                  <div className="ml-6">
                    <span className={`text-sm font-medium px-3 py-1 rounded-full inline-block ${
                      (() => {
                        const paymentMethod = (selectedOrderForDetails.payment?.method || selectedOrderForDetails.paymentMethod || 'razorpay').toLowerCase()
                        return paymentMethod === 'cash' || paymentMethod === 'cod'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-100 text-green-700'
                      })()
                    }`}>
                      {(() => {
                        const paymentMethod = (selectedOrderForDetails.payment?.method || selectedOrderForDetails.paymentMethod || 'razorpay').toLowerCase()
                        if (paymentMethod === 'cash' || paymentMethod === 'cod') {
                          return 'COD'
                        }
                        return 'Online'
                      })()}
                    </span>
                  </div>
                </div>

                {/* Price Breakdown */}
                {selectedOrderForDetails.pricing && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-gray-700">Price Breakdown</span>
                    </div>
                    <div className="ml-6 space-y-1">
                      {/* Only show Subtotal if it exists and is greater than 0 */}
                      {selectedOrderForDetails.pricing.subtotal != null && Number(selectedOrderForDetails.pricing.subtotal) > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Subtotal:</span>
                          <span className="text-gray-800">₹{Number(selectedOrderForDetails.pricing.subtotal).toFixed(2)}</span>
                        </div>
                      )}
                      {/* Only show Delivery Fee if it exists and is greater than 0 */}
                      {selectedOrderForDetails.pricing.deliveryFee != null && Number(selectedOrderForDetails.pricing.deliveryFee) > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Delivery Fee:</span>
                          <span className="text-green-600 font-medium">₹{Number(selectedOrderForDetails.pricing.deliveryFee).toFixed(2)}</span>
                        </div>
                      )}
                      {/* Only show Tax if it exists and is greater than 0 */}
                      {selectedOrderForDetails.pricing.tax != null && Number(selectedOrderForDetails.pricing.tax) > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Tax:</span>
                          <span className="text-gray-800">₹{Number(selectedOrderForDetails.pricing.tax).toFixed(2)}</span>
                        </div>
                      )}
                      {/* Only show Discount if it exists and is greater than 0 */}
                      {selectedOrderForDetails.pricing.discount != null && Number(selectedOrderForDetails.pricing.discount) > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Discount:</span>
                          <span className="text-red-600">-₹{Number(selectedOrderForDetails.pricing.discount).toFixed(2)}</span>
                        </div>
                      )}
                      {/* Always show Total */}
                      <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t border-gray-200">
                        <span className="text-gray-800">Total:</span>
                        <span className="text-gray-900">₹{(selectedOrderForDetails.pricing.total || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Rating & Review Modal */}
      <AnimatePresence>
        {showRatingPopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => !submittingRating && setShowRatingPopup(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-2">Rate Your Delivery</h2>
              <p className="text-gray-500 text-sm mb-6">How was your experience with this delivery?</p>

              {/* Star Rating */}
              <div className="flex justify-center gap-3 mb-8">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRatingValue(star)}
                    className="p-1 transition-transform active:scale-90"
                  >
                    <Star
                      className={`w-10 h-10 ${ratingValue >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                        }`}
                    />
                  </button>
                ))}
              </div>

              {/* Review Text */}
              <textarea
                placeholder="Write a brief review (optional)"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                className="w-full h-24 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-500 transition-colors resize-none mb-6"
              />

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  disabled={submittingRating}
                  onClick={() => setShowRatingPopup(false)}
                  className="flex-1 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl active:scale-95 transition-all"
                >
                  Skip
                </button>
                <button
                  disabled={submittingRating}
                  onClick={handleRatingSubmit}
                  className="flex-1 py-3.5 bg-green-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {submittingRating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Review'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Input File Ref for Bill (Hidden) */}
      <input
        ref={fileInputRefs}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          if (activeBillUploadOrder) {
            handleBillImageSelect(activeBillUploadOrder, e)
            setActiveBillUploadOrder(null)
          }
        }}
        className="hidden"
      />
    </div>
  )
}

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
  Eye,
  MessageSquare,
  Send,
  Plus,
  Phone,
  FileText
} from "lucide-react"
import { deliveryAPI, uploadAPI } from "@/lib/api"
import { API_BASE_URL } from "@/lib/api/config"
import { toast } from "sonner"
import { openCameraWithFallback, openGalleryWithFallback } from "@/lib/utils/flutterCamera"
import { motion, AnimatePresence } from "framer-motion"
import io from "socket.io-client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

export default function MyOrders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("pending")
  const [activeBillUploadOrder, setActiveBillUploadOrder] = useState(null)
  const [showBillImageSourceMenu, setShowBillImageSourceMenu] = useState(null) // orderId or null

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

  // Chat State
  const [chatOpen, setChatOpen] = useState(false)
  const [selectedOrderForChat, setSelectedOrderForChat] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [newMessage, setNewMessage] = useState("")
  const [chatSocket, setChatSocket] = useState(null)
  const chatMessagesEndRef = useRef(null)
  const chatInputRef = useRef(null)
  const chatInputContainerRef = useRef(null)

  // Socket URL for delivery namespace
  const SOCKET_URL = API_BASE_URL.replace('/api', '')

  // Helper functions for chat history
  const getChatHistoryKey = (orderId) => {
    return `delivery_chat_${orderId}`
  }

  const loadChatHistory = (orderId) => {
    try {
      const key = getChatHistoryKey(orderId)
      const saved = localStorage.getItem(key)
      if (saved) {
        const messages = JSON.parse(saved)
        console.log(`📜 Loaded ${messages.length} messages from history for order ${orderId}`)
        return messages
      }
    } catch (error) {
      console.error('Error loading chat history:', error)
    }
    return []
  }

  const saveChatHistory = (orderId, messages) => {
    try {
      const key = getChatHistoryKey(orderId)
      localStorage.setItem(key, JSON.stringify(messages))
      console.log(`💾 Saved ${messages.length} messages to history for order ${orderId}`)
    } catch (error) {
      console.error('Error saving chat history:', error)
    }
  }

  // Handle hardware back button for all popups/dialogs
  useEffect(() => {
    const isUIOpen = chatOpen || showRatingPopup || showOrderDetailsDialog || showBillImageSourceMenu || showMenuForOrder;

    if (isUIOpen) {
      window.history.pushState({ popup: true }, "");
    }

    const handlePopState = () => {
      if (isUIOpen) {
        setChatOpen(false);
        setShowRatingPopup(false);
        setShowOrderDetailsDialog(false);
        setShowBillImageSourceMenu(null);
        setShowMenuForOrder(null);
        console.log('🔙 Back button detected: Closing MyOrders UI elements');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [chatOpen, showRatingPopup, showOrderDetailsDialog, showBillImageSourceMenu, showMenuForOrder]);

  // Initialize Socket for Chat
  useEffect(() => {
    if (!chatOpen || !selectedOrderForChat) return

    const orderId = selectedOrderForChat.orderId || selectedOrderForChat._id
    if (!orderId) return

    let socket = null

    // Initialize socket connection
    const initializeSocket = async () => {
      try {
        // Get current delivery partner's ID from profile
        const profileResponse = await deliveryAPI.getProfile()
        const deliveryPartnerId = profileResponse?.data?.data?.profile?._id ||
          profileResponse?.data?.data?.profile?.id ||
          profileResponse?.data?.data?._id

        if (!deliveryPartnerId) {
          console.error('❌ Delivery partner ID not found in profile')
          toast.error('Unable to connect to chat. Please try again.')
          return
        }

        console.log('✅ Delivery partner ID:', deliveryPartnerId)

        // Connect to delivery socket namespace
        socket = io(`${SOCKET_URL}/delivery`, {
          transports: ['websocket', 'polling']
        })

        socket.on('connect', () => {
          console.log('✅ Connected to delivery chat socket')
          // Join delivery room with current delivery partner's ID
          socket.emit('join-delivery', deliveryPartnerId.toString())
          console.log('✅ Joined delivery room:', deliveryPartnerId.toString())

          // CRITICAL: Also join order room to receive messages from user
          // Join with both orderId formats (ORD-xxx and MongoDB _id) for compatibility
          const orderIdString = selectedOrderForChat.orderId || orderId
          const orderMongoId = selectedOrderForChat._id || orderId

          if (orderIdString) {
            socket.emit('join-order-room', orderIdString)
            console.log('✅ Joined order room with orderId string:', orderIdString)
          }

          if (orderMongoId && orderMongoId !== orderIdString) {
            socket.emit('join-order-room', orderMongoId)
            console.log('✅ Also joined order room with MongoDB _id:', orderMongoId)
          }
        })

        // Single message handler to avoid duplicates
        const handleIncomingMessage = (data, source) => {
          console.log(`📩 New chat message received (${source}):`, data)
          console.log('🔍 Order matching check:', {
            receivedOrderId: data.orderId,
            receivedOrderMongoId: data.orderMongoId,
            currentOrderId: orderId,
            selectedOrderId: selectedOrderForChat._id,
            selectedOrderIdString: selectedOrderForChat.orderId,
            sender: data.sender
          })

          // Get all possible order identifiers from the selected order
          const possibleOrderIds = [
            orderId,
            selectedOrderForChat._id,
            selectedOrderForChat.orderId,
            String(orderId),
            String(selectedOrderForChat._id),
            String(selectedOrderForChat.orderId)
          ].filter(Boolean) // Remove null/undefined

          // Get all possible order identifiers from the received message
          const receivedOrderIds = [
            data.orderId,
            data.orderMongoId,
            String(data.orderId),
            String(data.orderMongoId)
          ].filter(Boolean) // Remove null/undefined

          // Check if any received orderId matches any possible orderId
          const orderIdMatch = possibleOrderIds.some(possibleId =>
            receivedOrderIds.some(receivedId => {
              // Exact match
              if (possibleId === receivedId) return true
              // String comparison
              if (String(possibleId) === String(receivedId)) return true
              // Case-insensitive string comparison
              if (String(possibleId).toLowerCase() === String(receivedId).toLowerCase()) return true
              return false
            })
          )

          // If message is from user and we're in a chat, accept it regardless of orderId match
          // This is because user messages should always be shown when chat is open
          const isUserMessage = data.sender === 'user'

          console.log('🔍 OrderId match check:', {
            orderIdMatch,
            isUserMessage,
            chatOpen,
            hasSelectedOrder: !!selectedOrderForChat,
            possibleOrderIds,
            receivedOrderIds
          })

          // Accept message if:
          // 1. OrderId matches exactly, OR
          // 2. It's a user message and chat is open (we trust the backend to send correct messages to the right delivery partner room)
          // Since backend filters by delivery partner room, if message reaches here and it's from user, it's likely for current order
          const shouldAcceptMessage = orderIdMatch || (isUserMessage && chatOpen && selectedOrderForChat && data.sender === 'user')

          console.log('🔍 Should accept message:', shouldAcceptMessage, {
            reason: orderIdMatch ? 'orderId match' : (isUserMessage && chatOpen && selectedOrderForChat ? 'user message in open chat' : 'no match')
          })

          if (shouldAcceptMessage) {
            console.log('✅ Message matches current order, adding to chat')
            setChatMessages(prev => {
              // Check if message already exists to avoid duplicates
              // Check by exact match first (message + timestamp + sender)
              const exactMatch = prev.some(msg => {
                const msgKey = `${msg.message}_${msg.timestamp}_${msg.sender}`
                const dataKey = `${data.message}_${data.timestamp}_${data.sender}`
                return msgKey === dataKey
              })

              if (exactMatch) {
                console.log('⚠️ Exact duplicate message detected, skipping')
                return prev
              }

              // Also check for near-duplicates: same message content and sender within 2 seconds
              // This handles cases where server timestamp differs slightly from client timestamp
              const nearDuplicate = prev.some(msg => {
                if (msg.message === data.message && msg.sender === data.sender) {
                  const timeDiff = Math.abs(msg.timestamp - data.timestamp)
                  if (timeDiff < 2000) { // Within 2 seconds
                    return true
                  }
                }
                return false
              })

              if (nearDuplicate) {
                console.log('⚠️ Near-duplicate message detected (same content within 2s), skipping')
                return prev
              }

              console.log('✅ Adding new message to chat')
              return [...prev, data]
            })
          } else {
            console.log('⚠️ Message rejected - orderId does not match:', {
              receivedOrderId: data.orderId,
              receivedOrderMongoId: data.orderMongoId,
              currentOrderId: orderId,
              selectedOrderId: selectedOrderForChat._id,
              selectedOrderIdString: selectedOrderForChat.orderId,
              possibleOrderIds,
              receivedOrderIds,
              sender: data.sender,
              chatOpen,
              hasSelectedOrder: !!selectedOrderForChat
            })
          }
        }

        // Listen to both events but use single handler to prevent duplicates
        socket.on('chat-message', (data) => handleIncomingMessage(data, 'chat-message'))
        socket.on('receive-chat-message', (data) => handleIncomingMessage(data, 'receive-chat-message'))

        // Listen for room join confirmation
        socket.on('delivery-room-joined', (data) => {
          console.log('✅ Delivery room joined successfully:', data)
        })

        socket.on('connect_error', (error) => {
          console.error('❌ Socket connection error:', error)
          toast.error('Failed to connect to chat. Please try again.')
        })

        setChatSocket(socket)
      } catch (error) {
        console.error('❌ Error initializing socket:', error)
        toast.error('Failed to initialize chat. Please try again.')
      }
    }

    initializeSocket()

    return () => {
      if (socket) {
        socket.disconnect()
        setChatSocket(null)
      }
    }
  }, [chatOpen, selectedOrderForChat])

  // Save chat history whenever messages change
  useEffect(() => {
    if (selectedOrderForChat && chatMessages.length > 0) {
      const orderId = selectedOrderForChat.orderId || selectedOrderForChat._id
      if (orderId) {
        saveChatHistory(orderId, chatMessages)
      }
    }
  }, [chatMessages, selectedOrderForChat])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages])

  // Handle opening chat
  const handleOpenChat = (order) => {
    const orderId = order.orderId || order._id
    setSelectedOrderForChat(order)
    setChatOpen(true)

    // Load chat history for this order
    if (orderId) {
      const history = loadChatHistory(orderId)
      setChatMessages(history)
      console.log(`📜 Loaded ${history.length} messages from history`)
    } else {
      setChatMessages([])
    }

    setNewMessage("")
  }

  // Handle closing chat
  const handleCloseChat = () => {
    setChatOpen(false)
    setSelectedOrderForChat(null)
    // Don't clear messages - they're saved in history and will be reloaded when chat reopens
    // setChatMessages([]) // Removed - keep messages for history
    setNewMessage("")
    if (chatSocket) {
      chatSocket.disconnect()
      setChatSocket(null)
    }
  }

  // Handle sending message
  const handleSendMessage = () => {
    if (!newMessage.trim() || !chatSocket || !selectedOrderForChat) {
      console.warn('⚠️ Cannot send message:', {
        hasMessage: !!newMessage.trim(),
        hasSocket: !!chatSocket,
        hasOrder: !!selectedOrderForChat
      });
      return;
    }

    const orderId = selectedOrderForChat.orderId || selectedOrderForChat._id
    if (!orderId) {
      console.error('❌ No orderId available to send message');
      toast.error('Unable to send message. Order ID not found.');
      return;
    }

    // Check if socket is connected
    if (!chatSocket.connected) {
      console.error('❌ Socket not connected, attempting to reconnect...');
      chatSocket.connect();
      toast.error('Reconnecting to chat...');
      return;
    }

    const messageText = newMessage.trim()
    const messageTimestamp = Date.now()

    console.log('💬 Sending delivery message:', {
      orderId: orderId,
      message: messageText,
      socketConnected: chatSocket.connected,
      deliveryPartnerId: selectedOrderForChat.deliveryPartnerId ||
        selectedOrderForChat.assignmentInfo?.deliveryPartnerId
    });

    // Send message to server
    chatSocket.emit('send-chat-message', {
      orderId: orderId,
      message: messageText,
      deliveryPartnerId: selectedOrderForChat.deliveryPartnerId ||
        selectedOrderForChat.assignmentInfo?.deliveryPartnerId,
      timestamp: messageTimestamp
    });

    console.log('✅ Message sent to server');

    // Don't add message optimistically - wait for server echo to avoid duplicates
    // The server will echo the message back through socket, and it will be added via handleIncomingMessage
    setNewMessage("")
  }

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
            // Debug: Log estimated earnings for first order
            if (ordersData.length > 0) {
              console.log('💰 First order earnings:', {
                orderId: ordersData[0].orderId,
                estimatedEarnings: ordersData[0].estimatedEarnings,
                assignmentInfo: ordersData[0].assignmentInfo,
                distance: ordersData[0].estimatedEarnings?.distance || ordersData[0].assignmentInfo?.distance
              })
            }
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
            // Debug: Log first few orders to check their status and earnings
            if (ordersData.length > 0) {
              console.log('📋 Sample orders from API:', ordersData.slice(0, 3).map(o => ({
                orderId: o.orderId,
                status: o.status,
                deliveryState: o.deliveryState,
                earnings: o.amount || o.earnings || o.pricing?.deliveryFee
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
  const cameraInputRefs = useRef({})
  const galleryInputRefs = useRef({})

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

  // Handle bill image capture/upload - Show menu on mobile, direct gallery on desktop
  const handleBillImageCapture = async (order, e) => {
    e.stopPropagation()
    e.preventDefault()
    const orderId = order.orderId || order._id

    // Initialize refs if not exists
    if (!cameraInputRefs.current[orderId]) {
      cameraInputRefs.current[orderId] = { current: null }
    }
    if (!galleryInputRefs.current[orderId]) {
      galleryInputRefs.current[orderId] = { current: null }
    }

    // Check if mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

    if (isMobile) {
      // Show menu on mobile
      setShowBillImageSourceMenu(orderId)
      setActiveBillUploadOrder(order)
    } else {
      // On desktop, directly open gallery
      const file = await openGalleryWithFallback(
        { accept: 'image/*', multiple: false, quality: 0.8 },
        () => galleryInputRefs.current[orderId]?.current?.click()
      )
      if (file) {
        await handleBillImageUpload(order, file)
      }
    }
  }

  // Handle bill image file selection
  const handleBillImageSelect = async (order, e) => {
    const file = e.target.files?.[0]
    if (!file) {
      // Clear activeBillUploadOrder if no file selected
      setActiveBillUploadOrder(null)
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      setActiveBillUploadOrder(null)
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB')
      setActiveBillUploadOrder(null)
      return
    }

    await handleBillImageUpload(order, file)

    // Clear inputs and activeBillUploadOrder after successful upload
    const orderId = order.orderId || order._id
    if (cameraInputRefs.current[orderId]?.current) {
      cameraInputRefs.current[orderId].current.value = ''
    }
    if (galleryInputRefs.current[orderId]?.current) {
      galleryInputRefs.current[orderId].current.value = ''
    }
    if (fileInputRefs.current) {
      fileInputRefs.current.value = ''
    }
    setActiveBillUploadOrder(null)
  }

  // Upload bill image
  const handleBillImageUpload = async (order, file) => {
    if (!file) {
      console.error('❌ No file provided for bill upload')
      return
    }

    const orderId = order.orderId || order._id
    if (!orderId) {
      console.error('❌ No order ID found')
      return
    }

    setUploadingBills(prev => ({ ...prev, [orderId]: true }))

    try {
      console.log('📸 Uploading bill image for order:', orderId, { fileName: file.name, fileSize: file.size, fileType: file.type })

      const response = await uploadAPI.uploadMedia(file, {
        folder: 'appzeto/delivery/bills'
      })

      console.log('📸 Bill upload response:', response?.data)

      if (response?.data?.success && response?.data?.data?.url) {
        const imageUrl = response.data.data.url
        setBillImages(prev => ({ ...prev, [orderId]: imageUrl }))
        toast.success('Bill image uploaded!')
        console.log('✅ Bill image uploaded successfully:', imageUrl)
      } else {
        console.error('❌ Upload failed - invalid response:', response?.data)
        throw new Error('Upload failed - invalid response')
      }
    } catch (error) {
      console.error('❌ Error uploading bill:', error)
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      })
      toast.error(error.response?.data?.message || 'Failed to upload bill image. Please try again.')
    } finally {
      setUploadingBills(prev => ({ ...prev, [orderId]: false }))
    }
  }


  // Handle order pickup (bill upload requirement removed)
  const handleOrderPickup = async (order) => {
    const orderId = order.orderId || order._id
    if (!orderId) {
      toast.error('Order ID not found')
      return
    }

    try {
      const response = await deliveryAPI.confirmOrderId(orderId, order.orderId || orderId, {})

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
  // Handle restaurant location click - Show polyline from delivery boy's live location to restaurant
  const handleRestaurantLocationClick = async (order, e) => {
    e.stopPropagation()
    e.preventDefault()

    // Prevent navigation for cancelled or delivered orders
    const orderStatus = order.status || ''
    if (orderStatus === 'cancelled' || orderStatus === 'Cancelled' || orderStatus === 'delivered' || orderStatus === 'completed') {
      toast.error('Cannot view location for cancelled or delivered orders')
      return
    }

    try {
      // Get current live location
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

      // Store order data in localStorage for DeliveryHome
      // Set shouldShowPolyline to true only when location icon is clicked
      localStorage.setItem('deliveryActiveOrder', JSON.stringify({
        restaurantInfo: orderData,
        showMap: true,
        showRoute: true,
        showRoutePath: true,
        hasDirectionsAPI: true,
        currentLocation: currentLocation,
        navigationMode: 'restaurant', // Route to restaurant
        shouldShowPolyline: true, // Show polyline when location icon is clicked
        enableLiveTracking: true
      }))

      // Navigate to DeliveryHome
      navigate('/delivery')
    } catch (error) {
      console.error('Error getting location:', error)
      toast.error('Location not available. Please enable location services.')
    }
  }

  // Handle customer location click - Show polyline from delivery boy's live location to customer
  const handleCustomerLocationClick = async (order, e) => {
    e.stopPropagation()
    e.preventDefault()

    // Prevent navigation for cancelled or delivered orders
    const orderStatus = order.status || ''
    if (orderStatus === 'cancelled' || orderStatus === 'Cancelled' || orderStatus === 'delivered' || orderStatus === 'completed') {
      toast.error('Cannot view location for cancelled or delivered orders')
      return
    }

    try {
      // Get current live location
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

      // Store order data in localStorage for DeliveryHome
      // Set shouldShowPolyline to true only when location icon is clicked
      localStorage.setItem('deliveryActiveOrder', JSON.stringify({
        restaurantInfo: orderData,
        showMap: true,
        showRoute: true,
        showRoutePath: true,
        hasDirectionsAPI: true,
        currentLocation: currentLocation,
        navigationMode: 'customer', // Route to customer
        shouldShowPolyline: true // Show polyline when location icon is clicked
      }))

      // Navigate to DeliveryHome
      navigate('/delivery')
    } catch (error) {
      console.error('Error getting location:', error)
      toast.error('Location not available. Please enable location services.')
    }
  }

  // No swipeable action button needed anymore, replaced by ActionButton

  // 3. Swipeable Order Pickup Button (Bill upload requirement removed)
  const OrderPickupButton = ({ order, onPickup }) => {
    return (
      <SwipeButton
        label="Confirm Order Pickup"
        onComplete={() => onPickup(order)}
        color="bg-green-600"
        progressColor="bg-green-500"
        icon={<Package className="w-5 h-5 text-white" />}
      />
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

              // Calculate estimated earnings from commission rules
              const estimatedEarnings = order.estimatedEarnings?.totalEarning ||
                (typeof order.estimatedEarnings === 'number' ? order.estimatedEarnings : null) ||
                order.pricing?.deliveryFee ||
                order.earnings ||
                0
              const deliveryDistance = order.estimatedEarnings?.distance ||
                order.assignmentInfo?.distance ||
                order.deliveryDistance ||
                null

              // Debug log for first order
              if (order === filteredOrders[0]) {
                console.log('🔍 Order earnings debug:', {
                  orderId: order.orderId,
                  estimatedEarnings: order.estimatedEarnings,
                  calculatedEarnings: estimatedEarnings,
                  distance: deliveryDistance,
                  assignmentInfo: order.assignmentInfo
                })
              }

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
                          {isActive && activeTab === "pending" && isAcceptedByDeliveryBoy(order) && !isOrderPickedUp(order) && !isCancelled && (
                            <button
                              onClick={(e) => handleRestaurantLocationClick(order, e)}
                              className="p-1.5 hover:bg-green-50 rounded-full transition-colors shrink-0"
                              title="View restaurant location on map"
                            >
                              <MapPin className="w-4 h-4 text-green-600" />
                            </button>
                          )}
                          {/* Location Button - Show for drop phase */}
                          {isActive && activeTab === "pending" && isOrderPickedUp(order) && !isReachedDrop(order) && !isCancelled && (
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

                  {/* Customer Address Section - Show for active orders */}
                  {isActive && activeTab === "pending" && (
                    <div className="px-4 py-3 border-t border-dashed border-gray-200">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-gray-700 mb-1">Delivery Address</p>
                          {order.address ? (
                            <div className="space-y-1">
                              {order.address.formattedAddress ? (
                                <p className="text-xs text-gray-800">{order.address.formattedAddress}</p>
                              ) : (
                                <>
                                  {order.address.street && (
                                    <p className="text-xs text-gray-800">{order.address.street}</p>
                                  )}
                                  {(order.address.area || order.address.city) && (
                                    <p className="text-xs text-gray-600">
                                      {[order.address.area, order.address.city].filter(Boolean).join(', ')}
                                    </p>
                                  )}
                                  {(order.address.state || order.address.pincode || order.address.zipCode) && (
                                    <p className="text-xs text-gray-600">
                                      {[order.address.state, order.address.pincode || order.address.zipCode].filter(Boolean).join(' - ')}
                                    </p>
                                  )}
                                </>
                              )}
                              {order.deliveryAddressDetails && (
                                <p className="text-xs text-blue-600 font-medium mt-1">
                                  <span className="font-semibold">Additional:</span> {order.deliveryAddressDetails}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">Address not available</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Separator */}
                  {activeTab !== "delivered" && (
                    <div className="border-t border-dashed border-gray-200 mx-4 my-1"></div>
                  )}

                  {/* Items List - Hidden for delivered orders */}
                  {activeTab !== "delivered" && (
                    <div className="px-4 py-2">
                      {order.items && order.items.length > 0 ? (
                        order.items.map((item, idx) => (
                          <div key={item._id || item.itemId || idx} className="mt-2 first:mt-0">
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 border ${item.isVeg ? 'border-green-600' : 'border-red-600'} flex items-center justify-center p-[2px] shrink-0`}>
                                <div className={`w-full h-full rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`}></div>
                              </div>
                              <span className="text-sm text-gray-700 font-medium flex-1">
                                {item.quantity || 1} x {item.name}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-[10px] text-gray-500 italic mt-0.5 ml-6 leading-tight border-l border-gray-200 pl-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No items listed</p>
                      )}

                      {order.note && (
                        <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-2">
                          <div className="bg-blue-100 p-1 rounded-full shrink-0">
                            <FileText className="w-3 h-3 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-blue-800 uppercase tracking-tight mb-0.5">Instructions from Customer:</p>
                            <p className="text-xs text-blue-900 leading-tight">{order.note}</p>
                          </div>
                        </div>
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
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${(order.payment?.method || order.paymentMethod || '').toLowerCase() === 'cash' ||
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

                  {/* Date and Earnings */}
                  {activeTab === "delivered" ? (
                    <div className="px-4 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-green-600">
                          {orderStatus}
                        </span>
                        {(() => {
                          // For delivered orders, get earnings from settlement (amount field from trip history)
                          // Trip history API returns earnings in 'amount' field from OrderSettlement
                          const earnings = order.amount ||
                            order.settlement?.deliveryPartnerEarning?.totalEarning ||
                            order.deliveryPartnerEarning?.totalEarning ||
                            order.pricing?.deliveryFee ||
                            order.estimatedEarnings?.totalEarning ||
                            order.estimatedEarnings ||
                            order.earnings ||
                            0
                          return (
                            <span className="text-green-600 font-bold text-lg">
                              Earnings: ₹{Number(earnings).toFixed(2)}
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-2">
                      <div className="flex items-center justify-between mb-2">
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
                      </div>
                      {/* Estimated Earnings Display - Show for pending orders */}
                      {activeTab === "pending" && (
                        <div className="mt-2 pt-2 border-t border-gray-100 bg-green-50 rounded-lg p-2">
                          {estimatedEarnings > 0 ? (
                            <>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <IndianRupee className="w-4 h-4 text-green-600" />
                                  <span className="text-sm font-semibold text-gray-700">Estimated Earnings:</span>
                                </div>
                                <span className="text-green-600 font-bold text-lg">
                                  ₹{Number(estimatedEarnings).toFixed(2)}
                                </span>
                              </div>
                              {deliveryDistance && (
                                <div className="flex items-center justify-between mt-1.5">
                                  <span className="text-xs text-gray-600">Distance:</span>
                                  <span className="text-xs text-gray-700 font-medium">
                                    {Number(deliveryDistance).toFixed(2)} km
                                  </span>
                                </div>
                              )}

                              {/* Action Icons: Call, Chat, Location - Hide when REACHED PICKUP button is visible */}
                              {/* REACHED PICKUP button shows when: isAcceptedByDeliveryBoy(order) && !isReachedPickup(order) && !isCancelled */}
                              {/* So we hide icons when that same condition is true */}
                              {(() => {
                                // Check if REACHED PICKUP button would be showing (same condition as button)
                                const isShowingReachedPickupButton = isAcceptedByDeliveryBoy(order) &&
                                  !isReachedPickup(order) &&
                                  !isCancelled &&
                                  isActive &&
                                  activeTab === "pending"

                                // Only show icons if order is accepted but REACHED PICKUP button is NOT showing
                                return isAcceptedByDeliveryBoy(order) &&
                                  !isReachedPickup(order) &&
                                  !isOrderPickedUp(order) &&
                                  !isShowingReachedPickupButton
                              })() && (
                                  <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-gray-200">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        // Try multiple possible fields for customer phone number
                                        const userPhone = order.userId?.phone ||
                                          order.userId?.phoneNumber ||
                                          order.userPhone ||
                                          order.address?.phone ||
                                          order.customerPhone ||
                                          order.user?.phone

                                        if (userPhone) {
                                          // Remove any spaces, dashes, or special characters except +
                                          const cleanPhone = userPhone.replace(/[\s\-\(\)]/g, '')
                                          // Ensure phone number starts with +91 for Indian numbers if it doesn't have country code
                                          let phoneToCall = cleanPhone
                                          if (!cleanPhone.startsWith('+') && cleanPhone.length === 10) {
                                            phoneToCall = `+91${cleanPhone}`
                                          } else if (!cleanPhone.startsWith('+') && cleanPhone.startsWith('91') && cleanPhone.length === 12) {
                                            phoneToCall = `+${cleanPhone}`
                                          } else if (!cleanPhone.startsWith('+')) {
                                            phoneToCall = cleanPhone
                                          }

                                          console.log('📞 Calling customer:', phoneToCall)
                                          window.location.href = `tel:${phoneToCall}`
                                        } else {
                                          console.error('❌ Customer phone number not found in order:', {
                                            orderId: order.orderId || order._id,
                                            userId: order.userId,
                                            userPhone: order.userPhone,
                                            address: order.address
                                          })
                                          toast.error('Customer phone number not available')
                                        }
                                      }}
                                      className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 hover:bg-green-200 transition-colors"
                                      title="Call customer"
                                    >
                                      <Phone className="w-5 h-5" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleOpenChat(order)
                                      }}
                                      className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 hover:bg-purple-200 transition-colors"
                                      title="Chat with customer"
                                    >
                                      <MessageSquare className="w-5 h-5" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleCustomerLocationClick(order, e)
                                      }}
                                      className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-200 transition-colors"
                                      title="View customer location"
                                    >
                                      <MapPin className="w-5 h-5" />
                                    </button>
                                  </div>
                                )}
                            </>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <IndianRupee className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-500">Calculating earnings...</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
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
                        !isReachedPickup(order) && !isCancelled ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <ReachedPickupButton
                                order={order}
                                onReachedPickup={handleReachedPickup}
                              />
                            </div>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                // Get user phone number
                                const userPhone = order?.userId?.phone ||
                                  order?.userPhone ||
                                  order?.address?.phone ||
                                  order?.customerPhone ||
                                  null

                                // If phone not found, try to fetch order details from backend
                                if (!userPhone && order.orderId) {
                                  try {
                                    const response = await deliveryAPI.getOrderDetails(order.orderId)
                                    if (response.data?.success && response.data.data?.order) {
                                      const orderData = response.data.data.order
                                      const phone = orderData.userId?.phone || orderData.userPhone || null
                                      if (phone) {
                                        // Clean the phone number
                                        let cleanPhone = String(phone).replace(/[\s\-\(\)]/g, '')
                                        if (!cleanPhone.startsWith('+') && cleanPhone.length === 10) {
                                          cleanPhone = `+91${cleanPhone}`
                                        } else if (!cleanPhone.startsWith('+') && cleanPhone.startsWith('91') && cleanPhone.length === 12) {
                                          cleanPhone = `+${cleanPhone}`
                                        }
                                        console.log('📞 Calling customer:', cleanPhone)
                                        window.location.href = `tel:${cleanPhone}`
                                        return
                                      }
                                    }
                                  } catch (error) {
                                    console.error('Error fetching order details for phone:', error)
                                  }
                                }

                                if (userPhone) {
                                  // Clean the phone number (remove spaces, dashes, etc. but keep +)
                                  let cleanPhone = String(userPhone).replace(/[\s\-\(\)]/g, '')
                                  // Ensure phone number starts with +91 for Indian numbers if it doesn't have country code
                                  if (!cleanPhone.startsWith('+') && cleanPhone.length === 10) {
                                    cleanPhone = `+91${cleanPhone}`
                                  } else if (!cleanPhone.startsWith('+') && cleanPhone.startsWith('91') && cleanPhone.length === 12) {
                                    cleanPhone = `+${cleanPhone}`
                                  }
                                  console.log('📞 Calling customer:', cleanPhone)
                                  window.location.href = `tel:${cleanPhone}`
                                } else {
                                  toast.error('Customer phone number not available')
                                }
                              }}
                              className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center text-green-600 shadow-sm border border-green-100 hover:bg-green-100 transition-colors"
                              title="Call customer"
                            >
                              <Phone className="w-6 h-6" />
                            </button>
                            <button
                              onClick={(e) => handleRestaurantLocationClick(order, e)}
                              className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center text-green-600 shadow-sm border border-green-100"
                              title="View restaurant location"
                            >
                              <MapPin className="w-6 h-6" />
                            </button>
                          </div>
                        ) : // Phase 3: Reached pickup but not picked up - show Order Pickup with bill upload
                          !isOrderPickedUp(order) && !isCancelled ? (
                            <OrderPickupButton
                              order={order}
                              onPickup={handleOrderPickup}
                            />
                          ) : // Phase 4: Picked up but not reached drop - show Reached Drop button
                            !isReachedDrop(order) && !isCancelled ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1">
                                  <ReachedDropButton
                                    order={order}
                                    onReachedDrop={handleReachedDrop}
                                  />
                                </div>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    // Get user phone number
                                    const userPhone = order?.userId?.phone ||
                                      order?.userPhone ||
                                      order?.address?.phone ||
                                      null

                                    // If phone not found, try to fetch order details from backend
                                    if (!userPhone && order.orderId) {
                                      try {
                                        const response = await deliveryAPI.getOrderDetails(order.orderId)
                                        if (response.data?.success && response.data.data?.order) {
                                          const orderData = response.data.data.order
                                          const phone = orderData.userId?.phone || orderData.userPhone || null
                                          if (phone) {
                                            // Clean the phone number
                                            let cleanPhone = String(phone).replace(/[\s\-\(\)]/g, '')
                                            if (!cleanPhone.startsWith('+') && cleanPhone.length === 10) {
                                              cleanPhone = `+91${cleanPhone}`
                                            } else if (!cleanPhone.startsWith('+') && cleanPhone.startsWith('91') && cleanPhone.length === 12) {
                                              cleanPhone = `+${cleanPhone}`
                                            }
                                            console.log('📞 Calling customer:', cleanPhone)
                                            window.location.href = `tel:${cleanPhone}`
                                            return
                                          }
                                        }
                                      } catch (error) {
                                        console.error('Error fetching order details for phone:', error)
                                      }
                                    }

                                    if (userPhone) {
                                      // Clean the phone number (remove spaces, dashes, etc. but keep +)
                                      let cleanPhone = String(userPhone).replace(/[\s\-\(\)]/g, '')
                                      // Ensure phone number starts with +91 for Indian numbers if it doesn't have country code
                                      if (!cleanPhone.startsWith('+') && cleanPhone.length === 10) {
                                        cleanPhone = `+91${cleanPhone}`
                                      } else if (!cleanPhone.startsWith('+') && cleanPhone.startsWith('91') && cleanPhone.length === 12) {
                                        cleanPhone = `+${cleanPhone}`
                                      }
                                      console.log('📞 Calling customer:', cleanPhone)
                                      window.location.href = `tel:${cleanPhone}`
                                    } else {
                                      toast.error('Customer phone number not available')
                                    }
                                  }}
                                  className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-blue-100 hover:bg-blue-100 transition-colors"
                                  title="Call customer"
                                >
                                  <Phone className="w-6 h-6" />
                                </button>
                                <button
                                  onClick={(e) => handleCustomerLocationClick(order, e)}
                                  className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-blue-100 hover:bg-blue-100 transition-colors"
                                  title="View customer location on map"
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

                {/* Earnings - Show actual earnings from settlement for delivered orders */}
                {(() => {
                  // For delivered orders, get actual earnings from settlement (amount field from trip history)
                  // For pending orders, show estimated earnings
                  const actualEarnings = selectedOrderForDetails.amount ||
                    selectedOrderForDetails.settlement?.deliveryPartnerEarning?.totalEarning ||
                    selectedOrderForDetails.deliveryPartnerEarning?.totalEarning ||
                    selectedOrderForDetails.pricing?.deliveryFee ||
                    selectedOrderForDetails.estimatedEarnings?.totalEarning ||
                    selectedOrderForDetails.estimatedEarnings ||
                    0

                  if (actualEarnings > 0) {
                    return (
                      <div className="border-b pb-3">
                        <div className="flex items-center gap-2 mb-1">
                          <IndianRupee className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-semibold text-gray-700">
                            {selectedOrderForDetails.status === 'Completed' || selectedOrderForDetails.status === 'Delivered' ? 'Earnings' : 'Estimated Earnings'}
                          </span>
                        </div>
                        <p className="text-sm text-green-600 font-semibold ml-6">
                          ₹{Number(actualEarnings).toFixed(2)}
                        </p>
                        {/* Show earnings breakdown if available from settlement */}
                        {selectedOrderForDetails.settlement?.deliveryPartnerEarning && (
                          <div className="ml-6 mt-2 space-y-1 text-xs text-gray-600">
                            <div className="flex justify-between">
                              <span>Base Payout:</span>
                              <span>₹{Number(selectedOrderForDetails.settlement.deliveryPartnerEarning.basePayout || 0).toFixed(2)}</span>
                            </div>
                            {selectedOrderForDetails.settlement.deliveryPartnerEarning.distanceCommission > 0 && (
                              <div className="flex justify-between">
                                <span>Distance Commission:</span>
                                <span>₹{Number(selectedOrderForDetails.settlement.deliveryPartnerEarning.distanceCommission || 0).toFixed(2)}</span>
                              </div>
                            )}
                            {selectedOrderForDetails.settlement.deliveryPartnerEarning.distance > 0 && (
                              <div className="flex justify-between">
                                <span>Distance:</span>
                                <span>{Number(selectedOrderForDetails.settlement.deliveryPartnerEarning.distance || 0).toFixed(2)} km</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Payment Method */}
                <div className="border-b pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-700">Payment Mode</span>
                  </div>
                  <div className="ml-6">
                    <span className={`text-sm font-medium px-3 py-1 rounded-full inline-block ${(() => {
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

                {/* Price Breakdown - Hidden for delivery partners */}
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

      {/* Input File Refs for Bill (Hidden) - Camera and Gallery */}
      {orders.map((order) => {
        const orderId = order.orderId || order._id
        // Initialize refs if not exists
        if (!cameraInputRefs.current[orderId]) {
          cameraInputRefs.current[orderId] = { current: null }
        }
        if (!galleryInputRefs.current[orderId]) {
          galleryInputRefs.current[orderId] = { current: null }
        }

        return (
          <div key={orderId}>
            <input
              ref={cameraInputRefs.current[orderId]}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                if (activeBillUploadOrder && (activeBillUploadOrder.orderId || activeBillUploadOrder._id) === orderId) {
                  handleBillImageSelect(activeBillUploadOrder, e)
                  setActiveBillUploadOrder(null)
                }
              }}
              className="hidden"
              id={`bill-camera-${orderId}`}
            />
            <input
              ref={galleryInputRefs.current[orderId]}
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (activeBillUploadOrder && (activeBillUploadOrder.orderId || activeBillUploadOrder._id) === orderId) {
                  handleBillImageSelect(activeBillUploadOrder, e)
                  setActiveBillUploadOrder(null)
                }
              }}
              className="hidden"
              id={`bill-gallery-${orderId}`}
            />
          </div>
        )
      })}

      {/* Image Source Menu Modal - Mobile only */}
      <AnimatePresence>
        {showBillImageSourceMenu && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 z-[9999]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowBillImageSourceMenu(null)
                setActiveBillUploadOrder(null)
              }}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[10000] shadow-2xl"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="p-4">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                  Select Image Source
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={async () => {
                      const orderId = showBillImageSourceMenu
                      const order = activeBillUploadOrder

                      if (!order) {
                        setShowBillImageSourceMenu(null)
                        setActiveBillUploadOrder(null)
                        return
                      }

                      // Close menu first
                      setShowBillImageSourceMenu(null)

                      // Try Flutter camera first
                      const file = await openCameraWithFallback(
                        { source: 'camera', accept: 'image/*', multiple: false, quality: 0.8 },
                        () => {
                          // Fallback: Keep activeBillUploadOrder set for onChange handler
                          setTimeout(() => {
                            cameraInputRefs.current[orderId]?.current?.click()
                          }, 100)
                        }
                      )

                      // If Flutter camera returned a file, process it
                      if (file) {
                        setActiveBillUploadOrder(null) // Clear after successful Flutter upload
                        await handleBillImageUpload(order, file)
                      }
                      // If file is null, fallback callback will trigger file input
                      // and onChange handler will process it
                    }}
                    className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <Camera className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-900">Take Photo</p>
                      <p className="text-sm text-gray-500">Use camera to capture bill</p>
                    </div>
                  </button>
                  <button
                    onClick={async () => {
                      const orderId = showBillImageSourceMenu
                      const order = activeBillUploadOrder

                      if (!order) {
                        setShowBillImageSourceMenu(null)
                        setActiveBillUploadOrder(null)
                        return
                      }

                      // Close menu first
                      setShowBillImageSourceMenu(null)

                      // Try Flutter gallery first
                      const file = await openGalleryWithFallback(
                        { accept: 'image/*', multiple: false, quality: 0.8 },
                        () => {
                          // Fallback: Keep activeBillUploadOrder set for onChange handler
                          setTimeout(() => {
                            galleryInputRefs.current[orderId]?.current?.click()
                          }, 100)
                        }
                      )

                      // If Flutter gallery returned a file, process it
                      if (file) {
                        setActiveBillUploadOrder(null) // Clear after successful Flutter upload
                        await handleBillImageUpload(order, file)
                      }
                      // If file is null, fallback callback will trigger file input
                      // and onChange handler will process it
                    }}
                    className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Plus className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-900">Choose from Gallery</p>
                      <p className="text-sm text-gray-500">Select existing photo</p>
                    </div>
                  </button>
                </div>
                <button
                  onClick={() => {
                    setShowBillImageSourceMenu(null)
                    setActiveBillUploadOrder(null)
                  }}
                  className="w-full mt-4 py-3 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Chat Modal */}
      <Dialog open={chatOpen} onOpenChange={(open) => {
        if (!open) {
          handleCloseChat()
        } else {
          setChatOpen(true)
        }
      }}>
        <DialogContent className="max-w-full sm:max-w-[500px] h-[600px] sm:h-[700px] p-0 flex flex-col">
          <DialogHeader className="p-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <DialogTitle className="font-semibold text-gray-900 dark:text-white">
                    Chat with Customer
                  </DialogTitle>
                  <DialogDescription className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Order: {selectedOrderForChat?.orderId || selectedOrderForChat?._id}
                  </DialogDescription>
                </div>
              </div>
              <button
                onClick={handleCloseChat}
                className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
                aria-label="Close chat"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </DialogHeader>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-[#0a0a0a] scroll-smooth">
            {chatMessages.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-gray-400" />
                </div>
                <h4 className="text-gray-900 dark:text-white font-medium">Start a conversation</h4>
                <p className="text-gray-500 dark:text-gray-400 text-sm max-w-[200px] mx-auto">
                  Communicate with the customer about delivery instructions or updates.
                </p>
              </div>
            ) : (
              chatMessages.map((msg, index) => {
                const isDelivery = msg.sender === 'delivery'
                return (
                  <div
                    key={index}
                    className={`flex ${isDelivery ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${isDelivery
                        ? 'bg-purple-600 text-white rounded-br-none'
                        : 'bg-white dark:bg-[#1a1a1a] text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-800 rounded-bl-none'
                        }`}
                    >
                      <p>{msg.message}</p>
                      <p
                        className={`text-[10px] mt-1 text-right ${isDelivery ? 'text-purple-100' : 'text-gray-400 dark:text-gray-500'
                          }`}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={chatMessagesEndRef} />
          </div>

          {/* Input Area - Always visible when focused */}
          <div
            ref={chatInputContainerRef}
            className="p-3 bg-white dark:bg-[#1a1a1a] border-t border-gray-200 dark:border-gray-800 sticky bottom-0 z-10"
          >
            <div className="flex items-end gap-2">
              <Textarea
                ref={chatInputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onFocus={(e) => {
                  // Ensure input is visible when keyboard appears
                  setTimeout(() => {
                    if (chatInputContainerRef.current) {
                      chatInputContainerRef.current.scrollIntoView({
                        behavior: 'smooth',
                        block: 'end',
                        inline: 'nearest'
                      });
                    }
                    // Also scroll the input itself into view
                    e.target.scrollIntoView({
                      behavior: 'smooth',
                      block: 'center',
                      inline: 'nearest'
                    });
                  }, 300); // Delay to account for keyboard animation
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder="Type your message..."
                className="flex-1 min-h-[60px] max-h-[120px] resize-none bg-gray-50 dark:bg-[#0a0a0a] border border-gray-300 dark:border-gray-700 focus:border-purple-500 dark:focus:border-purple-500 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-lg"
                rows={2}
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                className="w-12 h-12 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors flex-shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}  

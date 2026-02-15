import { useParams, Link, useSearchParams } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { io } from "socket.io-client" // Import io
import { API_BASE_URL } from "@/lib/api/config" // Import API_BASE_URL
import {
  ArrowLeft,
  RefreshCw,
  Phone,
  ChevronRight,
  MapPin,
  Home as HomeIcon,
  X,
  Check,
  Shield,
  Receipt,
  CircleSlash,
  Loader2
} from "lucide-react"
import AnimatedPage from "../../components/AnimatedPage"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useOrders } from "../../context/OrdersContext"
import { useProfile } from "../../context/ProfileContext"
import { orderAPI, restaurantAPI } from "@/lib/api"
import circleIcon from "@/assets/circleicon.png"

// Get Socket URL from API_BASE_URL (remove /api)
const SOCKET_URL = API_BASE_URL.replace('/api', '');

// Animated checkmark component
const AnimatedCheckmark = ({ delay = 0 }) => (
  <motion.svg
    width="80"
    height="80"
    viewBox="0 0 80 80"
    initial="hidden"
    animate="visible"
    className="mx-auto"
  >
    <motion.circle
      cx="40"
      cy="40"
      r="36"
      fill="none"
      stroke="#22c55e"
      strokeWidth="4"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    />
    <motion.path
      d="M24 40 L35 51 L56 30"
      fill="none"
      stroke="#22c55e"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.4, delay: delay + 0.4, ease: "easeOut" }}
    />
  </motion.svg>
)


// Section item component
const SectionItem = ({ icon: Icon, title, subtitle, onClick, showArrow = true, rightContent }) => (
  <motion.button
    onClick={onClick}
    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left border-b border-dashed border-gray-200 last:border-0"
    whileTap={{ scale: 0.99 }}
  >
    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
      <Icon className="w-5 h-5 text-gray-600" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-gray-900 truncate">{title}</p>
      {subtitle && <p className="text-sm text-gray-500 truncate">{subtitle}</p>}
    </div>
    {rightContent || (showArrow && <ChevronRight className="w-5 h-5 text-gray-400" />)}
  </motion.button>
)

export default function OrderTracking() {
  const { orderId } = useParams()
  const [searchParams] = useSearchParams()
  const confirmed = searchParams.get("confirmed") === "true"
  const { getOrderById } = useOrders()
  const { profile, getDefaultAddress } = useProfile()

  // State for order data
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showConfirmation, setShowConfirmation] = useState(confirmed)
  const [orderStatus, setOrderStatus] = useState('placed')
  const [estimatedTime, setEstimatedTime] = useState(29)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancellationReason, setCancellationReason] = useState("")
  const [isCancelling, setIsCancelling] = useState(false)
  const [socket, setSocket] = useState(null)

  const defaultAddress = getDefaultAddress()


  // Initialize Socket for Chat
  useEffect(() => {
    if (!orderId) return;

    // Connect to socket
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ Connected to chat socket');
      // Join order room to listen for messages and tracking
      // Join with orderId from params (could be ORD-xxx or MongoDB _id)
      newSocket.emit('join-order-tracking', orderId);
      console.log('✅ Joined order room with orderId:', orderId);
      
      // Also join with order._id if available and different from orderId
      // This ensures we receive messages sent to either format
      if (order?._id && order._id !== orderId) {
        newSocket.emit('join-order-tracking', order._id);
        console.log('✅ Also joined order room with MongoDB _id:', order._id);
      }
      
      // Also join with order.orderId if available and different
      if (order?.orderId && order.orderId !== orderId && order.orderId !== order._id) {
        newSocket.emit('join-order-tracking', order.orderId);
        console.log('✅ Also joined order room with orderId string:', order.orderId);
      }
    });
    
    // Handle connection errors
    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      toast.error('Failed to connect to chat. Please try again.');
    });
    
    // Handle disconnection
    newSocket.on('disconnect', (reason) => {
      console.warn('⚠️ Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected the socket, try to reconnect
        newSocket.connect();
      }
    });


    return () => {
      newSocket.disconnect();
    };
  }, [orderId]);

  // Join additional order room when order is loaded (for MongoDB _id format)
  useEffect(() => {
    if (!socket || !order) return;

    // Join with all possible orderId formats to ensure we receive all messages
    const orderIds = [
      order._id,
      order.orderId,
      orderId
    ].filter(Boolean).filter((id, index, self) => self.indexOf(id) === index); // Remove duplicates

    orderIds.forEach(id => {
      if (id && id !== orderId) {
        socket.emit('join-order-tracking', id);
        console.log('✅ Also joined order room with:', id);
      }
    });
  }, [socket, order?._id, order?.orderId, orderId]);


  // Poll for order updates (especially when delivery partner accepts)
  // Only poll if delivery partner is not yet assigned to avoid unnecessary updates
  useEffect(() => {
    if (!orderId || !order) return;

    // Skip polling if delivery partner is already assigned and accepted
    const currentDeliveryStatus = order?.deliveryState?.status;
    const currentPhase = order?.deliveryState?.currentPhase;
    const hasDeliveryPartner = currentDeliveryStatus === 'accepted' ||
      currentPhase === 'en_route_to_pickup' ||
      currentPhase === 'at_pickup' ||
      currentPhase === 'en_route_to_delivery';

    // If delivery partner is assigned, reduce polling frequency to 30 seconds
    // If not assigned, poll every 5 seconds to detect assignment
    const pollInterval = hasDeliveryPartner ? 30000 : 5000;

    const interval = setInterval(async () => {
      try {
        const response = await orderAPI.getOrderDetails(orderId);
        if (response.data?.success && response.data.data?.order) {
          const apiOrder = response.data.data.order;

          // Check if delivery state changed (e.g., status became 'accepted')
          const newDeliveryStatus = apiOrder.deliveryState?.status;
          const newPhase = apiOrder.deliveryState?.currentPhase;
          const newOrderStatus = apiOrder.status;
          const currentOrderStatus = order?.status;

          // Check if order was cancelled
          if (newOrderStatus === 'cancelled' && currentOrderStatus !== 'cancelled') {
            setOrderStatus('cancelled');
          }

          // Only update if status actually changed
          if (newDeliveryStatus === 'accepted' ||
            (newDeliveryStatus !== currentDeliveryStatus) ||
            (newPhase !== currentPhase) ||
            (newOrderStatus !== currentOrderStatus)) {
            console.log('🔄 Order status updated:', {
              oldStatus: currentDeliveryStatus,
              newStatus: newDeliveryStatus,
              oldPhase: currentPhase,
              newPhase: newPhase
            });

            // Re-fetch and update order (same logic as initial fetch)
            let restaurantCoords = null;
            if (apiOrder.restaurantId?.location?.coordinates &&
              Array.isArray(apiOrder.restaurantId.location.coordinates) &&
              apiOrder.restaurantId.location.coordinates.length >= 2) {
              restaurantCoords = apiOrder.restaurantId.location.coordinates;
            } else if (typeof apiOrder.restaurantId === 'string') {
              try {
                const restaurantResponse = await restaurantAPI.getRestaurantById(apiOrder.restaurantId);
                if (restaurantResponse?.data?.success && restaurantResponse.data.data?.restaurant) {
                  const restaurant = restaurantResponse.data.data.restaurant;
                  if (restaurant.location?.coordinates && Array.isArray(restaurant.location.coordinates) && restaurant.location.coordinates.length >= 2) {
                    restaurantCoords = restaurant.location.coordinates;
                  }
                }
              } catch (err) {
                console.error('❌ Error fetching restaurant details:', err);
              }
            }

            const transformedOrder = {
              ...apiOrder,
              restaurantLocation: restaurantCoords ? {
                coordinates: restaurantCoords
              } : order.restaurantLocation,
              deliveryPartnerId: apiOrder.deliveryPartnerId?._id || apiOrder.deliveryPartnerId || apiOrder.assignmentInfo?.deliveryPartnerId || null,
              assignmentInfo: apiOrder.assignmentInfo || null,
              deliveryState: apiOrder.deliveryState || null
            };

            setOrder(transformedOrder);
          }
        }
      } catch (err) {
        console.error('Error polling order updates:', err);
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [orderId, order?.deliveryState?.status, order?.deliveryState?.currentPhase]);

  // Fetch order from API if not found in context
  useEffect(() => {
    const fetchOrder = async () => {
      // First try to get from context (localStorage)
      const contextOrder = getOrderById(orderId)
      if (contextOrder) {
        // Ensure restaurant location is available in context order
        if (!contextOrder.restaurantLocation?.coordinates && contextOrder.restaurantId?.location?.coordinates) {
          contextOrder.restaurantLocation = {
            coordinates: contextOrder.restaurantId.location.coordinates
          };
        }
        // Also ensure restaurantId is present
        if (!contextOrder.restaurantId && contextOrder.restaurant) {
          // Try to preserve restaurantId if it exists
          console.log('⚠️ Context order missing restaurantId, will fetch from API');
        }
        setOrder(contextOrder)
        setLoading(false)
        return
      }

      // If not in context, fetch from API
      try {
        setLoading(true)
        setError(null)

        const response = await orderAPI.getOrderDetails(orderId)

        if (response.data?.success && response.data.data?.order) {
          const apiOrder = response.data.data.order

          // Log full API response structure for debugging
          console.log('🔍 Full API Order Response:', {
            orderId: apiOrder.orderId || apiOrder._id,
            hasRestaurantId: !!apiOrder.restaurantId,
            restaurantIdType: typeof apiOrder.restaurantId,
            restaurantIdKeys: apiOrder.restaurantId ? Object.keys(apiOrder.restaurantId) : [],
            restaurantIdLocation: apiOrder.restaurantId?.location,
            restaurantIdLocationKeys: apiOrder.restaurantId?.location ? Object.keys(apiOrder.restaurantId.location) : [],
            restaurantIdCoordinates: apiOrder.restaurantId?.location?.coordinates,
            fullRestaurantId: apiOrder.restaurantId
          });

          // Extract restaurant location coordinates with multiple fallbacks
          let restaurantCoords = null;

          // Priority 1: restaurantId.location.coordinates (GeoJSON format: [lng, lat])
          if (apiOrder.restaurantId?.location?.coordinates &&
            Array.isArray(apiOrder.restaurantId.location.coordinates) &&
            apiOrder.restaurantId.location.coordinates.length >= 2) {
            restaurantCoords = apiOrder.restaurantId.location.coordinates;
            console.log('✅ Found coordinates in restaurantId.location.coordinates:', restaurantCoords);
          }
          // Priority 2: restaurantId.location with latitude/longitude properties
          else if (apiOrder.restaurantId?.location?.latitude && apiOrder.restaurantId?.location?.longitude) {
            restaurantCoords = [apiOrder.restaurantId.location.longitude, apiOrder.restaurantId.location.latitude];
            console.log('✅ Found coordinates in restaurantId.location (lat/lng):', restaurantCoords);
          }
          // Priority 3: Check if restaurantId is a string ID and fetch restaurant details
          else if (typeof apiOrder.restaurantId === 'string') {
            console.log('⚠️ restaurantId is a string ID, fetching restaurant details...', apiOrder.restaurantId);
            try {
              const restaurantResponse = await restaurantAPI.getRestaurantById(apiOrder.restaurantId);
              if (restaurantResponse?.data?.success && restaurantResponse.data.data?.restaurant) {
                const restaurant = restaurantResponse.data.data.restaurant;
                if (restaurant.location?.coordinates && Array.isArray(restaurant.location.coordinates) && restaurant.location.coordinates.length >= 2) {
                  restaurantCoords = restaurant.location.coordinates;
                  console.log('✅ Fetched restaurant coordinates from API:', restaurantCoords);
                }
              }
            } catch (err) {
              console.error('❌ Error fetching restaurant details:', err);
            }
          }
          // Priority 4: Check nested restaurant data
          else if (apiOrder.restaurant?.location?.coordinates) {
            restaurantCoords = apiOrder.restaurant.location.coordinates;
            console.log('✅ Found coordinates in restaurant.location.coordinates:', restaurantCoords);
          }

          console.log('📍 Final restaurant coordinates:', restaurantCoords);
          console.log('📍 Customer coordinates:', apiOrder.address?.location?.coordinates);

          // Extract restaurant phone with fallbacks
          const restaurantPhone =
            apiOrder.restaurantId?.primaryContactNumber ||
            apiOrder.restaurantId?.phone ||
            apiOrder.restaurantId?.ownerPhone ||
            apiOrder.restaurantPhone ||
            '';
          
          // Debug logging for restaurant phone
          if (!restaurantPhone) {
            console.warn('⚠️ Restaurant phone not found:', {
              hasRestaurantId: !!apiOrder.restaurantId,
              restaurantIdType: typeof apiOrder.restaurantId,
              restaurantIdKeys: apiOrder.restaurantId ? Object.keys(apiOrder.restaurantId) : [],
              restaurantIdPhone: apiOrder.restaurantId?.phone,
              restaurantIdOwnerPhone: apiOrder.restaurantId?.ownerPhone,
              restaurantPhone: apiOrder.restaurantPhone
            });
          }

          // Transform API order to match component structure
          const transformedOrder = {
            id: apiOrder.orderId || apiOrder._id,
            restaurant: apiOrder.restaurantName || 'Restaurant',
            restaurantId: apiOrder.restaurantId || null, // Include restaurantId for location access
            restaurantPhone: restaurantPhone,
            userId: apiOrder.userId || null, // Include user data for phone number
            userName: apiOrder.userName || apiOrder.userId?.name || apiOrder.userId?.fullName || '',
            userPhone: apiOrder.userPhone || apiOrder.userId?.phone || '',
            address: {
              street: apiOrder.address?.street || '',
              city: apiOrder.address?.city || '',
              state: apiOrder.address?.state || '',
              zipCode: apiOrder.address?.zipCode || '',
              additionalDetails: apiOrder.address?.additionalDetails || '',
              formattedAddress: apiOrder.address?.formattedAddress ||
                (apiOrder.address?.street && apiOrder.address?.city
                  ? `${apiOrder.address.street}${apiOrder.address.additionalDetails ? `, ${apiOrder.address.additionalDetails}` : ''}, ${apiOrder.address.city}${apiOrder.address.state ? `, ${apiOrder.address.state}` : ''}${apiOrder.address.zipCode ? ` ${apiOrder.address.zipCode}` : ''}`
                  : apiOrder.address?.city || ''),
              coordinates: apiOrder.address?.location?.coordinates || null
            },
            restaurantLocation: {
              coordinates: restaurantCoords
            },
            items: apiOrder.items?.map(item => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price
            })) || [],
            total: apiOrder.pricing?.total || 0,
            status: apiOrder.status || 'pending',
          deliveryPartner: apiOrder.deliveryPartnerId ? {
            name: apiOrder.deliveryPartnerId.name || 'Delivery Partner',
            phone: apiOrder.deliveryPartnerId.phone || apiOrder.deliveryPartnerId.phoneNumber || null,
            avatar: null
          } : null,
            deliveryPartnerId: apiOrder.deliveryPartnerId?._id || apiOrder.deliveryPartnerId || apiOrder.assignmentInfo?.deliveryPartnerId || null,
            assignmentInfo: apiOrder.assignmentInfo || null,
            tracking: apiOrder.tracking || {},
            deliveryState: apiOrder.deliveryState || null,
            billImageUrl: apiOrder.billImageUrl || null
          }

          setOrder(transformedOrder)

          // Update orderStatus based on API order status
          if (apiOrder.status === 'cancelled') {
            setOrderStatus('cancelled');
          } else if (apiOrder.status === 'preparing') {
            setOrderStatus('preparing');
          } else if (apiOrder.status === 'ready') {
            setOrderStatus('pickup');
          } else if (apiOrder.status === 'out_for_delivery') {
            setOrderStatus('pickup');
          } else if (apiOrder.status === 'delivered') {
            setOrderStatus('delivered');
          }
        } else {
          throw new Error('Order not found')
        }
      } catch (err) {
        console.error('Error fetching order:', err)
        setError(err.response?.data?.message || err.message || 'Failed to fetch order')
      } finally {
        setLoading(false)
      }
    }

    if (orderId) {
      fetchOrder()
    }
  }, [orderId, getOrderById])

  // Simulate order status progression
  useEffect(() => {
    if (confirmed) {
      const timer1 = setTimeout(() => {
        setShowConfirmation(false)
        setOrderStatus('preparing')
      }, 3000)
      return () => clearTimeout(timer1)
    }
  }, [confirmed])

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setEstimatedTime((prev) => Math.max(0, prev - 1))
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // Listen for order status updates from socket (e.g., "Delivery partner on the way")
  useEffect(() => {
    const handleOrderStatusNotification = (event) => {
      const { message, title, status, estimatedDeliveryTime } = event.detail;

      console.log('📢 Order status notification received:', { message, status });

      // Update order status in UI
      if (status === 'out_for_delivery') {
        setOrderStatus('on_way');
      }

      // Show notification toast
      if (message) {
        toast.success(message, {
          duration: 5000,
          icon: '🏍️',
          position: 'top-center',
          description: estimatedDeliveryTime
            ? `Estimated delivery in ${Math.round(estimatedDeliveryTime / 60)} minutes`
            : undefined
        });

        // Optional: Vibrate device if supported
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
      }
    };

    // Listen for custom event from DeliveryTrackingMap
    window.addEventListener('orderStatusNotification', handleOrderStatusNotification);

    return () => {
      window.removeEventListener('orderStatusNotification', handleOrderStatusNotification);
    };
  }, [])

  const handleCancelOrder = () => {
    // DISABLED: Users cannot cancel orders
    toast.error('Order cancellation is not available. Please contact support for assistance.');
    return;
  };

  const handleConfirmCancel = async () => {
    if (!cancellationReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    setIsCancelling(true);
    try {
      const response = await orderAPI.cancelOrder(orderId, cancellationReason.trim());
      if (response.data?.success) {
        const paymentMethod = order?.payment?.method || order?.paymentMethod;
        const successMessage = response.data?.message ||
          (paymentMethod === 'cash' || paymentMethod === 'cod'
            ? 'Order cancelled successfully. No refund required as payment was not made.'
            : 'Order cancelled successfully. Refund will be processed after admin approval.');
        toast.success(successMessage);
        setShowCancelDialog(false);
        setCancellationReason("");
        // Refresh order data
        const orderResponse = await orderAPI.getOrderDetails(orderId);
        if (orderResponse.data?.success && orderResponse.data.data?.order) {
          const apiOrder = orderResponse.data.data.order;
          setOrder(apiOrder);
          // Update orderStatus to cancelled
          if (apiOrder.status === 'cancelled') {
            setOrderStatus('cancelled');
          }
        }
      } else {
        toast.error(response.data?.message || 'Failed to cancel order');
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error(error.response?.data?.message || 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const response = await orderAPI.getOrderDetails(orderId)
      if (response.data?.success && response.data.data?.order) {
        const apiOrder = response.data.data.order

        // Extract restaurant location coordinates with multiple fallbacks
        let restaurantCoords = null;

        // Priority 1: restaurantId.location.coordinates (GeoJSON format: [lng, lat])
        if (apiOrder.restaurantId?.location?.coordinates &&
          Array.isArray(apiOrder.restaurantId.location.coordinates) &&
          apiOrder.restaurantId.location.coordinates.length >= 2) {
          restaurantCoords = apiOrder.restaurantId.location.coordinates;
        }
        // Priority 2: restaurantId.location with latitude/longitude properties
        else if (apiOrder.restaurantId?.location?.latitude && apiOrder.restaurantId?.location?.longitude) {
          restaurantCoords = [apiOrder.restaurantId.location.longitude, apiOrder.restaurantId.location.latitude];
        }
        // Priority 3: Check nested restaurant data
        else if (apiOrder.restaurant?.location?.coordinates) {
          restaurantCoords = apiOrder.restaurant.location.coordinates;
        }
        // Priority 4: Check if restaurantId is a string ID and fetch restaurant details
        else if (typeof apiOrder.restaurantId === 'string') {
          console.log('⚠️ restaurantId is a string ID, fetching restaurant details...', apiOrder.restaurantId);
          try {
            const restaurantResponse = await restaurantAPI.getRestaurantById(apiOrder.restaurantId);
            if (restaurantResponse?.data?.success && restaurantResponse.data.data?.restaurant) {
              const restaurant = restaurantResponse.data.data.restaurant;
              if (restaurant.location?.coordinates && Array.isArray(restaurant.location.coordinates) && restaurant.location.coordinates.length >= 2) {
                restaurantCoords = restaurant.location.coordinates;
                console.log('✅ Fetched restaurant coordinates from API:', restaurantCoords);
              }
            }
          } catch (err) {
            console.error('❌ Error fetching restaurant details:', err);
          }
        }

        // Extract restaurant phone with fallbacks
        const restaurantPhone =
          apiOrder.restaurantId?.primaryContactNumber ||
          apiOrder.restaurantId?.phone ||
          apiOrder.restaurantId?.ownerPhone ||
          apiOrder.restaurantPhone ||
          '';
        
        // Debug logging for restaurant phone
        if (!restaurantPhone) {
          console.warn('⚠️ Restaurant phone not found:', {
            hasRestaurantId: !!apiOrder.restaurantId,
            restaurantIdType: typeof apiOrder.restaurantId,
            restaurantIdKeys: apiOrder.restaurantId ? Object.keys(apiOrder.restaurantId) : [],
            restaurantIdPhone: apiOrder.restaurantId?.phone,
            restaurantIdOwnerPhone: apiOrder.restaurantId?.ownerPhone,
            restaurantPhone: apiOrder.restaurantPhone
          });
        }

        const transformedOrder = {
          id: apiOrder.orderId || apiOrder._id,
          restaurant: apiOrder.restaurantName || 'Restaurant',
          restaurantId: apiOrder.restaurantId || null, // Include restaurantId for location access
          restaurantPhone: restaurantPhone,
          userId: apiOrder.userId || null, // Include user data for phone number
          userName: apiOrder.userName || apiOrder.userId?.name || apiOrder.userId?.fullName || '',
          userPhone: apiOrder.userPhone || apiOrder.userId?.phone || '',
          address: {
            street: apiOrder.address?.street || '',
            city: apiOrder.address?.city || '',
            state: apiOrder.address?.state || '',
            zipCode: apiOrder.address?.zipCode || '',
            additionalDetails: apiOrder.address?.additionalDetails || '',
            formattedAddress: apiOrder.address?.formattedAddress ||
              (apiOrder.address?.street && apiOrder.address?.city
                ? `${apiOrder.address.street}${apiOrder.address.additionalDetails ? `, ${apiOrder.address.additionalDetails}` : ''}, ${apiOrder.address.city}${apiOrder.address.state ? `, ${apiOrder.address.state}` : ''}${apiOrder.address.zipCode ? ` ${apiOrder.address.zipCode}` : ''}`
                : apiOrder.address?.city || ''),
            coordinates: apiOrder.address?.location?.coordinates || null
          },
          restaurantLocation: {
            coordinates: restaurantCoords
          },
          items: apiOrder.items?.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
          })) || [],
          total: apiOrder.pricing?.total || 0,
          status: apiOrder.status || 'pending',
          deliveryPartner: apiOrder.deliveryPartnerId ? {
            name: apiOrder.deliveryPartnerId.name || 'Delivery Partner',
            phone: apiOrder.deliveryPartnerId.phone || apiOrder.deliveryPartnerId.phoneNumber || null,
            avatar: null
          } : null,
          deliveryPartnerId: apiOrder.deliveryPartnerId?._id || apiOrder.deliveryPartnerId || apiOrder.assignmentInfo?.deliveryPartnerId || null,
          assignmentInfo: apiOrder.assignmentInfo || null,
          tracking: apiOrder.tracking || {},
          deliveryState: apiOrder.deliveryState || null,
          billImageUrl: apiOrder.billImageUrl || null
        }
        setOrder(transformedOrder)

        // Update order status for UI
        if (apiOrder.status === 'cancelled') {
          setOrderStatus('cancelled');
        } else if (apiOrder.status === 'preparing') {
          setOrderStatus('preparing')
        } else if (apiOrder.status === 'ready') {
          setOrderStatus('pickup')
        } else if (apiOrder.status === 'out_for_delivery') {
          setOrderStatus('pickup')
        } else if (apiOrder.status === 'delivered') {
          setOrderStatus('delivered')
        }
      }
    } catch (err) {
      console.error('Error refreshing order:', err)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleCallRestaurant = () => {
    const phone = order?.restaurantPhone || 
                  order?.restaurantId?.phone || 
                  order?.restaurantId?.ownerPhone
    if (!phone) {
      toast.error("Restaurant phone number not available")
      return
    }
    // Clean the phone number (remove spaces, dashes, etc. but keep +)
    let cleanPhone = String(phone).replace(/[\s\-\(\)]/g, '')
    // Ensure phone number starts with +91 for Indian numbers if it doesn't have country code
    if (!cleanPhone.startsWith('+') && cleanPhone.length === 10) {
      cleanPhone = `+91${cleanPhone}`
    } else if (!cleanPhone.startsWith('+') && cleanPhone.startsWith('91') && cleanPhone.length === 12) {
      cleanPhone = `+${cleanPhone}`
    }
    console.log('📞 Calling restaurant:', cleanPhone)
    window.location.href = `tel:${cleanPhone}`
  }

  // Loading state
  if (loading) {
    return (
      <AnimatedPage className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto text-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </AnimatedPage>
    )
  }

  // Error state
  if (error || !order) {
    return (
      <AnimatedPage className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto text-center py-20">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-4">Order Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'The order you\'re looking for doesn\'t exist.'}</p>
          <Link to="/user/orders">
            <Button>Back to Orders</Button>
          </Link>
        </div>
      </AnimatedPage>
    )
  }

  const statusConfig = {
    placed: {
      title: "Order placed",
      subtitle: "Food preparation will begin shortly",
      color: "bg-green-700"
    },
    preparing: {
      title: "Preparing your order",
      subtitle: `Arriving in ${estimatedTime} mins`,
      color: "bg-green-700"
    },
    pickup: {
      title: "Order picked up",
      subtitle: `Arriving in ${estimatedTime} mins`,
      color: "bg-green-700"
    },
    delivered: {
      title: "Order delivered",
      subtitle: "Enjoy your meal!",
      color: "bg-green-600"
    },
    cancelled: {
      title: "Order cancelled",
      subtitle: "This order has been cancelled",
      color: "bg-red-600"
    }
  }

  const currentStatus = statusConfig[orderStatus] || statusConfig.placed

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0a0a0a]">
      {/* Order Confirmed Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white dark:bg-[#1a1a1a] flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="text-center px-8"
            >
              <AnimatedCheckmark delay={0.3} />
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="text-2xl font-bold text-gray-900 mt-6"
              >
                Order Confirmed!
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="text-gray-600 mt-2"
              >
                Your order has been placed successfully
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="mt-8"
              >
                <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-500 mt-3">Loading order details...</p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Green Header */}
      <motion.div
        className={`${currentStatus.color} text-white sticky top-0 z-40`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Navigation bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/user/orders">
            <motion.button
              className="w-10 h-10 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <ArrowLeft className="w-6 h-6" />
            </motion.button>
          </Link>
          <h2 className="font-semibold text-lg">{order.restaurant}</h2>
          <div className="w-10 h-10"></div>
        </div>

        {/* Status section */}
        <div className="px-4 pb-4 text-center">
          <motion.h1
            className="text-2xl font-bold mb-3"
            key={currentStatus.title}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {currentStatus.title}
          </motion.h1>

          {/* Status pill */}
          <motion.div
            className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span className="text-sm">{currentStatus.subtitle}</span>
            {orderStatus === 'preparing' && (
              <>
                <span className="w-1 h-1 rounded-full bg-white" />
                <span className="text-sm text-green-200">On time</span>
              </>
            )}
            <motion.button
              onClick={handleRefresh}
              className="ml-1"
              animate={{ rotate: isRefreshing ? 360 : 0 }}
              transition={{ duration: 0.5 }}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.button>
          </motion.div>
        </div>
      </motion.div>


      {/* Scrollable Content */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 pb-24 md:pb-32">
        {/* Food Cooking Status - Show until delivery partner accepts pickup */}
        {(() => {
          // Check if delivery partner has accepted pickup
          // Delivery partner accepts when status is 'ready' or 'out_for_delivery' or tracking shows outForDelivery
          const hasAcceptedPickup = order?.tracking?.outForDelivery?.status === true ||
            order?.tracking?.out_for_delivery?.status === true ||
            order?.status === 'out_for_delivery' ||
            order?.status === 'ready'

          // Show "Food is Cooking" until delivery partner accepts pickup
          if (!hasAcceptedPickup) {
            return (
              <motion.div
                className="bg-white rounded-xl p-4 shadow-sm"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center overflow-hidden">
                    <img
                      src={circleIcon}
                      alt="Food cooking"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="font-semibold text-gray-900">Food is Cooking</p>
                </div>
              </motion.div>
            )
          }

          // Don't show card if delivery partner has accepted pickup
          return null
        })()}

        {/* Delivery Partner Safety */}
        <motion.button
          className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          whileTap={{ scale: 0.99 }}
        >
          <Shield className="w-6 h-6 text-gray-600" />
          <span className="flex-1 text-left font-medium text-gray-900">
            Learn about delivery partner safety
          </span>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </motion.button>

        {/* Delivery Details Banner */}
        <motion.div
          className="bg-yellow-50 rounded-xl p-4 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
        >
          <p className="text-yellow-800 font-medium">
            All your delivery details in one place 👇
          </p>
        </motion.div>

        {/* Delivery Instructions */}
        <motion.div
          className="bg-white rounded-xl shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <SectionItem
            icon={Phone}
            title={
              order?.userName ||
              order?.userId?.fullName ||
              order?.userId?.name ||
              profile?.fullName ||
              profile?.name ||
              'Customer'
            }
            subtitle={
              order?.userPhone ||
              order?.userId?.phone ||
              profile?.phone ||
              defaultAddress?.phone ||
              'Phone number not available'
            }
            showArrow={false}
          />
          <SectionItem
            icon={HomeIcon}
            title="Delivery at Location"
            subtitle={(() => {
              // Priority 1: Use order address formattedAddress (live location address)
              if (order?.address?.formattedAddress && order.address.formattedAddress !== "Select location") {
                return order.address.formattedAddress
              }

              // Priority 2: Build full address from order address parts
              if (order?.address) {
                const orderAddressParts = []
                if (order.address.street) orderAddressParts.push(order.address.street)
                if (order.address.additionalDetails) orderAddressParts.push(order.address.additionalDetails)
                if (order.address.city) orderAddressParts.push(order.address.city)
                if (order.address.state) orderAddressParts.push(order.address.state)
                if (order.address.zipCode) orderAddressParts.push(order.address.zipCode)
                if (orderAddressParts.length > 0) {
                  return orderAddressParts.join(', ')
                }
              }

              // Priority 3: Use defaultAddress formattedAddress (live location address)
              if (defaultAddress?.formattedAddress && defaultAddress.formattedAddress !== "Select location") {
                return defaultAddress.formattedAddress
              }

              // Priority 4: Build full address from defaultAddress parts
              if (defaultAddress) {
                const defaultAddressParts = []
                if (defaultAddress.street) defaultAddressParts.push(defaultAddress.street)
                if (defaultAddress.additionalDetails) defaultAddressParts.push(defaultAddress.additionalDetails)
                if (defaultAddress.city) defaultAddressParts.push(defaultAddress.city)
                if (defaultAddress.state) defaultAddressParts.push(defaultAddress.state)
                if (defaultAddress.zipCode) defaultAddressParts.push(defaultAddress.zipCode)
                if (defaultAddressParts.length > 0) {
                  return defaultAddressParts.join(', ')
                }
              }

              return 'Add delivery address'
            })()}
            showArrow={false}
          />
        </motion.div>

        {/* Delivery Partner Contact - Show name and call icon */}
        {order?.deliveryPartner && order?.deliveryPartnerId && (
          <motion.div
            className="bg-white rounded-xl shadow-sm overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.73 }}
          >
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {order.deliveryPartner.name || 'Delivery Partner'}
                    </p>
                    {order.deliveryPartner.phone && (
                      <p className="text-sm text-gray-500">
                        {order.deliveryPartner.phone}
                      </p>
                    )}
                  </div>
                </div>
                {order.deliveryPartner.phone && (
                  <button
                    onClick={() => {
                      const deliveryPhone = order.deliveryPartner.phone
                      if (deliveryPhone) {
                        // Clean the phone number (remove spaces, dashes, etc. but keep +)
                        let cleanPhone = String(deliveryPhone).replace(/[\s\-\(\)]/g, '')
                        // Ensure phone number starts with +91 for Indian numbers if it doesn't have country code
                        if (!cleanPhone.startsWith('+') && cleanPhone.length === 10) {
                          cleanPhone = `+91${cleanPhone}`
                        } else if (!cleanPhone.startsWith('+') && cleanPhone.startsWith('91') && cleanPhone.length === 12) {
                          cleanPhone = `+${cleanPhone}`
                        }
                        console.log('📞 Calling delivery partner:', cleanPhone)
                        window.location.href = `tel:${cleanPhone}`
                      } else {
                        toast.error('Delivery partner phone number not available')
                      }
                    }}
                    className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 hover:bg-green-200 transition-colors shrink-0"
                    title="Call delivery partner"
                  >
                    <Phone className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Restaurant Section */}
        <motion.div
          className="bg-white rounded-xl shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
        >
          <div className="flex items-center gap-3 p-4 border-b border-dashed border-gray-200">
            <div className="w-12 h-12 rounded-full bg-orange-100 overflow-hidden flex items-center justify-center">
              <span className="text-2xl">🍔</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{order.restaurant}</p>
              <p className="text-sm text-gray-500">{order.address?.city || 'Local Area'}</p>
            </div>
            <motion.button
              onClick={handleCallRestaurant}
              className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <Phone className="w-5 h-5 text-green-700" />
            </motion.button>
          </div>

          {/* Order Items */}
          <div className="p-4 border-b border-dashed border-gray-200">
            <div className="flex items-start gap-3">
              <Receipt className="w-5 h-5 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Order #{order?.id || order?.orderId || 'N/A'}</p>
                <div className="mt-2 space-y-1">
                  {order?.items?.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-4 h-4 rounded border border-green-600 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-green-600" />
                      </span>
                      <span>{item.quantity} x {item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </motion.div>

        {/* Help Section - Cancel order disabled */}
        {/* Cancel order button removed - Users cannot cancel orders */}

      </div>

      {/* Cancel Order Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-xl w-[95%] max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">
              Cancel Order
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-6 px-2">
            <div className="space-y-2 w-full">
              <Textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="e.g., Changed my mind, Wrong address, etc."
                className="w-full min-h-[100px] resize-none border-2 border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed disabled:border-gray-200"
                disabled={isCancelling}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelDialog(false);
                  setCancellationReason("");
                }}
                disabled={isCancelling}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmCancel}
                disabled={isCancelling || !cancellationReason.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Confirm Cancellation'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

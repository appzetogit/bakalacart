import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { 
  ArrowLeft,
  MessageCircle,
  Phone,
  MapPin,
  Utensils,
  ChefHat,
  DollarSign,
  Home,
  FileText,
  UtensilsCrossed,
  User
} from "lucide-react"
import { 
  getDeliveryOrderStatus, 
  getDeliveryStatusMessage,
  saveDeliveryOrderStatus,
  normalizeDeliveryStatus,
  DELIVERY_ORDER_STATUS
} from "../utils/deliveryOrderStatus"
import { 
  getDeliveryOrderPaymentStatus 
} from "../utils/deliveryWalletState"
import { deliveryAPI } from "@/lib/api"
import { Loader2 } from "lucide-react"

export default function AcceptedOrderDetails() {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const [orderStatus, setOrderStatus] = useState(() => getDeliveryOrderStatus(orderId))
  const [paymentStatus, setPaymentStatus] = useState(() => getDeliveryOrderPaymentStatus(orderId))
  const [orderData, setOrderData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch order details from API
  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!orderId) return
      
      try {
        setLoading(true)
        const response = await deliveryAPI.getOrderDetails(orderId)
        
        if (response?.data?.success && response?.data?.data) {
          const order = response.data.data.order || response.data.data
          
          // Format date helper
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

          // Get restaurant address
          const getRestaurantAddress = () => {
            const loc = order.restaurantId?.location
            if (loc?.formattedAddress && loc.formattedAddress.trim() !== '' && loc.formattedAddress.trim() !== 'Select location') {
              const isCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(loc.formattedAddress.trim())
              if (!isCoordinates) {
                return loc.formattedAddress.trim()
              }
            }
            if (loc?.addressLine1) {
              const parts = [loc.addressLine1]
              if (loc.addressLine2) parts.push(loc.addressLine2)
              if (loc.area) parts.push(loc.area)
              if (loc.city) parts.push(loc.city)
              if (loc.state) parts.push(loc.state)
              if (loc.pincode) parts.push(loc.pincode)
              return parts.join(', ')
            }
            return order.restaurantId?.address || 'Address not available'
          }

          // Get customer address
          const getCustomerAddress = () => {
            if (order.address?.formattedAddress) {
              return order.address.formattedAddress
            }
            const parts = []
            if (order.address?.street) parts.push(order.address.street)
            if (order.address?.area) parts.push(order.address.area)
            if (order.address?.city) parts.push(order.address.city)
            if (order.address?.state) parts.push(order.address.state)
            if (order.address?.pincode || order.address?.zipCode) {
              parts.push(order.address.pincode || order.address.zipCode)
            }
            return parts.length > 0 ? parts.join(', ') : 'Address not available'
          }

          // Transform API order to component format
          const transformedOrder = {
            id: order.orderId || order._id || orderId,
            status: orderStatus,
            deliveryTime: "1 - 5 Min",
            orderPlacedAt: formatOrderDate(order.createdAt),
            deliveredAt: order.deliveredAt ? formatOrderDate(order.deliveredAt) : null,
            customer: {
              name: order.userId?.name || 'Customer',
              phone: order.userId?.phone || null,
              address: getCustomerAddress(),
              image: order.userId?.profileImage?.url || "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=100&h=100&fit=crop&q=80"
            },
            restaurant: {
              name: order.restaurantName || order.restaurantId?.name || 'Restaurant',
              address: getRestaurantAddress(),
              rating: order.restaurantId?.rating || 0,
              phone: order.restaurantId?.phone || order.restaurantId?.ownerPhone || null
            },
            items: (order.items || []).map((item, idx) => ({
              id: idx + 1,
              name: item.name || 'Item',
              price: item.price || 0,
              variation: item.variation || item.addons?.map(a => a.name).join(', ') || 'Standard',
              quantity: item.quantity || 1,
              type: item.isVeg ? 'Veg' : 'Non Veg',
              image: item.image || "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=100&h=100&fit=crop&q=80"
            })),
            cutlery: order.sendCutlery ? "Yes" : "No",
            note: order.note || '', // Special instructions
            paymentMethod: {
              status: paymentStatus,
              method: order.payment?.method === 'cash' || order.payment?.method === 'cod' ? 'COD' : 'Online'
            },
            earnings: order.pricing?.deliveryFee || order.estimatedEarnings || 0,
            billing: {
              subtotal: order.pricing?.subtotal || 0,
              deliveryFee: order.pricing?.deliveryFee || 0,
              tax: order.pricing?.tax || 0,
              discount: order.pricing?.discount || 0,
              deliverymanTips: 0.00,
              total: order.pricing?.total || 0
            },
            statusMessage: getDeliveryStatusMessage(orderStatus).message,
            statusDescription: getDeliveryStatusMessage(orderStatus).description
          }
          
          setOrderData(transformedOrder)
        }
      } catch (error) {
        console.error('Error fetching order details:', error)
        // Fallback to default data structure
        setOrderData({
          id: orderId,
          status: orderStatus,
          deliveryTime: "1 - 5 Min",
          customer: { name: "Customer", address: "Address", image: "" },
          restaurant: { name: "Restaurant", address: "Address", rating: 0 },
          items: [],
          cutlery: "No",
          note: '',
          paymentMethod: { status: paymentStatus, method: "Cash" },
          billing: { subtotal: 0, deliverymanTips: 0.00, total: 0 },
          statusMessage: getDeliveryStatusMessage(orderStatus).message,
          statusDescription: getDeliveryStatusMessage(orderStatus).description
        })
      } finally {
        setLoading(false)
      }
    }

    fetchOrderDetails()
  }, [orderId, orderStatus, paymentStatus])

  // Listen for order status updates
  useEffect(() => {
    const handleStatusUpdate = () => {
      setOrderStatus(getDeliveryOrderStatus(orderId))
      setPaymentStatus(getDeliveryOrderPaymentStatus(orderId))
    }

    handleStatusUpdate()

    window.addEventListener('deliveryOrderStatusUpdated', handleStatusUpdate)
    window.addEventListener('deliveryWalletStateUpdated', handleStatusUpdate)
    window.addEventListener('storage', handleStatusUpdate)

    return () => {
      window.removeEventListener('deliveryOrderStatusUpdated', handleStatusUpdate)
      window.removeEventListener('deliveryWalletStateUpdated', handleStatusUpdate)
      window.removeEventListener('storage', handleStatusUpdate)
    }
  }, [orderId])

  const statusMessage = getDeliveryStatusMessage(orderStatus)

  // Show loading state
  if (loading || !orderData) {
    return (
      <div className="min-h-screen bg-[#f6e9dc] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 md:py-3 flex items-center justify-between rounded-b-3xl md:rounded-b-none sticky top-0 z-10">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 -ml-2"
        >
          <ArrowLeft className="w-6 h-6 text-gray-900" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-gray-900 font-medium">Order #{orderData.id}</p>
          <p className="text-[#ff8100] text-sm font-medium">{orderData.status}</p>
        </div>
        <div className="w-10"></div>
      </div>

      {/* Order Timeline - Show for delivered orders */}
      {orderData.deliveredAt && (
        <div className="px-4 py-3 bg-white mx-4 rounded-lg shadow-sm border border-gray-100">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Order Placed:</span>
              <span className="text-gray-900 font-medium text-sm">{orderData.orderPlacedAt}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Delivered:</span>
              <span className="text-green-600 font-semibold text-sm">{orderData.deliveredAt}</span>
            </div>
            {orderData.earnings > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="text-gray-600 text-sm">Earnings:</span>
                <span className="text-green-600 font-bold text-sm">₹{orderData.earnings.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delivery Time Estimate - Only show for active orders */}
      {!orderData.deliveredAt && (
        <div className="px-4 py-4 bg-transparent">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-14 h-14 bg-red-100 rounded-lg flex items-center justify-center relative overflow-hidden">
                <Utensils className="w-7 h-7 text-red-600 z-10" />
                {/* Flames effect */}
                <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-orange-400 to-red-500 opacity-60"></div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Food need to deliver within</p>
              <p className="text-[#ff8100] font-bold text-lg">{orderData.deliveryTime}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="px-4 py-4 space-y-6">
        {/* Customer Contact Details - Hidden */}
        {/* <div>
          <h3 className="text-gray-900 font-semibold mb-3">Customer Contact Details</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start gap-4">
              <img 
                src={orderData.customer.image}
                alt="Food"
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-medium mb-1">{orderData.customer.name}</p>
                {orderData.customer.phone && (
                  <p className="text-gray-600 text-xs mb-1">{orderData.customer.phone}</p>
                )}
                <p className="text-gray-600 text-sm break-words">{orderData.customer.address}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button 
                  onClick={() => {
                    navigate("/delivery/profile/conversation")
                  }}
                  className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-[#ff8100] flex items-center justify-center hover:bg-[#e67300] transition-colors flex-shrink-0"
                >
                  <MessageCircle className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </button>
                <button 
                  onClick={() => {
                    const phone = orderData.customer.phone || orderData.restaurant.phone
                    if (phone) {
                      window.open(`tel:${phone}`, '_self')
                    } else {
                      window.open(`tel:+8801700000000`, '_self')
                    }
                  }}
                  className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-green-500 flex items-center justify-center hover:bg-green-600 transition-colors flex-shrink-0"
                >
                  <Phone className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </button>
                <button 
                  onClick={() => {
                    const address = encodeURIComponent(orderData.customer.address)
                    window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank')
                  }}
                  className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gray-300 flex items-center justify-center hover:bg-gray-400 transition-colors flex-shrink-0"
                >
                  <MapPin className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        </div> */}

        {/* Restaurant Details */}
        <div>
          <h3 className="text-gray-900 font-semibold mb-3">Restaurant Details</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[#ff8100] rounded-lg flex items-center justify-center">
                <ChefHat className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-medium mb-1">{orderData.restaurant.name}</p>
                {orderData.restaurant.phone && (
                  <p className="text-gray-600 text-xs mb-1">{orderData.restaurant.phone}</p>
                )}
                <p className="text-gray-600 text-sm mb-1 break-words">{orderData.restaurant.address}</p>
                {orderData.restaurant.rating > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-[#ff8100] rounded-full flex items-center justify-center">
                      <span className="text-white text-[8px]">★</span>
                    </div>
                    <span className="text-gray-600 text-sm">({orderData.restaurant.rating})</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button 
                  onClick={() => {
                    navigate("/delivery/profile/conversation")
                  }}
                  className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-[#ff8100] flex items-center justify-center hover:bg-[#e67300] transition-colors flex-shrink-0"
                >
                  <MessageCircle className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </button>
                <button 
                  onClick={() => {
                    const phone = orderData.restaurant.phone || orderData.customer.phone
                    if (phone) {
                      window.open(`tel:${phone}`, '_self')
                    } else {
                      window.open(`tel:+8801700000000`, '_self')
                    }
                  }}
                  className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-green-500 flex items-center justify-center hover:bg-green-600 transition-colors flex-shrink-0"
                >
                  <Phone className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </button>
                <button 
                  onClick={() => {
                    const address = encodeURIComponent(orderData.restaurant.address)
                    window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank')
                  }}
                  className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gray-300 flex items-center justify-center hover:bg-gray-400 transition-colors flex-shrink-0"
                >
                  <MapPin className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Item Info */}
        <div>
          <h3 className="text-gray-900 font-semibold mb-3">Item Info ({orderData.items.length})</h3>
          <div className="space-y-4">
            {orderData.items.map((item) => (
              <div key={item.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start gap-4">
                  <img 
                    src={item.image}
                    alt={item.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium mb-1">{item.name}</p>
                    <p className="text-gray-900 font-semibold mb-1">₹ {item.price.toFixed(2)}</p>
                    <p className="text-gray-600 text-sm">Variations: {item.variation}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-900 font-medium mb-2">Quantity: {item.quantity}</p>
                    <span className="inline-block bg-[#ff8100] text-white text-xs font-medium px-3 py-1 rounded">
                      {item.type}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cutlery */}
        <div className="flex items-center justify-between py-2">
          <span className="text-gray-900 font-medium">Cutlery:</span>
          <span className="text-gray-900 font-medium">{orderData.cutlery}</span>
        </div>

        {/* Special Instructions */}
        {orderData.note && orderData.note.trim() && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-gray-900 font-semibold mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-yellow-600" />
              Special Instructions
            </h3>
            <p className="text-gray-700 text-sm">{orderData.note}</p>
          </div>
        )}

        {/* Payment Method */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-900 font-medium">Payment Method</span>
            <span className="text-red-600 font-medium">{orderData.paymentMethod.status}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <span className="text-gray-900 font-medium">{orderData.paymentMethod.method}</span>
          </div>
        </div>

        {/* Billing Info */}
        <div>
          <h3 className="text-gray-900 font-semibold mb-3">Billing Info</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            {orderData.billing.subtotal > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-gray-900 font-medium">₹ {orderData.billing.subtotal.toFixed(2)}</span>
              </div>
            )}
            {orderData.billing.deliveryFee > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Delivery Fee</span>
                <span className="text-green-600 font-medium">₹ {orderData.billing.deliveryFee.toFixed(2)}</span>
              </div>
            )}
            {orderData.billing.tax > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Tax</span>
                <span className="text-gray-900 font-medium">₹ {orderData.billing.tax.toFixed(2)}</span>
              </div>
            )}
            {orderData.billing.discount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Discount</span>
                <span className="text-red-600 font-medium">-₹ {orderData.billing.discount.toFixed(2)}</span>
              </div>
            )}
            {orderData.billing.deliverymanTips > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Deliveryman Tips</span>
                <span className="text-gray-900 font-medium">(+) ₹ {orderData.billing.deliverymanTips.toFixed(2)}</span>
              </div>
            )}
            {orderData.earnings > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="text-green-600 font-semibold">Earnings</span>
                <span className="text-green-600 font-bold">₹ {orderData.earnings.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-3 border-t border-gray-300">
              <span className="text-[#ff8100] font-semibold">Total Amount</span>
              <span className="text-[#ff8100] font-bold text-lg">₹ {orderData.billing.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation Bar - Mobile Only */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="flex items-center justify-around py-2 px-4">
          <button 
            onClick={() => navigate("/delivery")}
            className="flex flex-col items-center gap-1 p-2 text-gray-600"
          >
            <Home className="w-6 h-6" />
            <span className="text-[10px] text-gray-600 font-medium">Home</span>
          </button>
          <button 
            onClick={() => navigate("/delivery/requests")}
            className="flex flex-col items-center gap-1 p-2 text-gray-600 relative"
          >
            <div className="relative">
              <FileText className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                5
              </span>
            </div>
            <span className="text-[10px] text-gray-600 font-medium">Request</span>
          </button>
          <button 
            onClick={() => navigate("/delivery/orders")}
            className="flex flex-col items-center gap-1 p-2 text-gray-600"
          >
            <UtensilsCrossed className="w-6 h-6" />
            <span className="text-[10px] text-gray-600 font-medium">Orders</span>
          </button>
          <button 
            onClick={() => navigate("/delivery/profile")}
            className="flex flex-col items-center gap-1 p-2 text-gray-600"
          >
            <User className="w-6 h-6" />
            <span className="text-[10px] text-gray-600 font-medium">Profile</span>
          </button>
        </div>
      </div>

      {/* Status Update Buttons - Above Status Bar */}
      {(() => {
        const normalizedStatus = normalizeDeliveryStatus(orderStatus)
        const isDelivered = normalizedStatus === DELIVERY_ORDER_STATUS.DELIVERED
        const isCancelled = normalizedStatus === DELIVERY_ORDER_STATUS.CANCELLED
        
        // Don't show buttons if order is delivered or cancelled
        if (isDelivered || isCancelled) return null
        
        return (
          <div className="fixed bottom-28 md:bottom-12 left-0 right-0 px-4 z-[60]">
            <div className="bg-white rounded-lg shadow-lg p-3 space-y-2">
              {normalizedStatus === DELIVERY_ORDER_STATUS.ACCEPTED && (
                <button
                  onClick={() => {
                    saveDeliveryOrderStatus(orderId, DELIVERY_ORDER_STATUS.PICKED_UP)
                    setOrderStatus(DELIVERY_ORDER_STATUS.PICKED_UP)
                  }}
                  className="w-full bg-[#ff8100] hover:bg-[#e67300] text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  Mark as Picked Up
                </button>
              )}
              
              {normalizedStatus === DELIVERY_ORDER_STATUS.PICKED_UP && (
                <button
                  onClick={() => {
                    saveDeliveryOrderStatus(orderId, DELIVERY_ORDER_STATUS.ON_THE_WAY)
                    setOrderStatus(DELIVERY_ORDER_STATUS.ON_THE_WAY)
                  }}
                  className="w-full bg-[#ff8100] hover:bg-[#e67300] text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  Mark as On the Way
                </button>
              )}
              
              {normalizedStatus === DELIVERY_ORDER_STATUS.ON_THE_WAY && (
                <button
                  onClick={() => {
                    saveDeliveryOrderStatus(orderId, DELIVERY_ORDER_STATUS.DELIVERED)
                    setOrderStatus(DELIVERY_ORDER_STATUS.DELIVERED)
                    // Remove from activeOrder when delivered
                    const activeOrder = localStorage.getItem('activeOrder')
                    if (activeOrder) {
                      const activeOrderData = JSON.parse(activeOrder)
                      if (activeOrderData.orderId === orderId) {
                        localStorage.removeItem('activeOrder')
                        window.dispatchEvent(new CustomEvent('activeOrderUpdated'))
                      }
                    }
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  Mark as Delivered
                </button>
              )}
            </div>
          </div>
        )
      })()}

      {/* Bottom Status Bar - Above Navigation - REMOVED */}
    </div>
  )
}


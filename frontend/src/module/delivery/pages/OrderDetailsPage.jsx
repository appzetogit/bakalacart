import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { 
  ArrowLeft,
  Clock,
  MapPin,
  Phone,
  User,
  ChefHat,
  Package,
  IndianRupee,
  CheckCircle2,
  Navigation,
  Calendar,
  CreditCard,
  FileText,
  UtensilsCrossed
} from "lucide-react"
import { deliveryAPI } from "@/lib/api"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function OrderDetailsPage() {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const [orderData, setOrderData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Format date helper
  const formatOrderDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      const day = date.getDate().toString().padStart(2, '0')
      const month = date.toLocaleDateString('en-IN', { month: 'short' })
      const hours = date.getHours()
      const minutes = date.getMinutes().toString().padStart(2, '0')
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const displayHours = hours % 12 || 12
      return `${day} ${month}, ${displayHours}:${minutes}${ampm}`
    } catch (e) {
      return 'N/A'
    }
  }

  // Get restaurant address
  const getRestaurantAddress = (order) => {
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
  const getCustomerAddress = (order) => {
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

  // Fetch order details
  useEffect(() => {
    const fetchOrderDetails = async () => {
      console.log('🔍 OrderDetailsPage: Fetching order details for orderId:', orderId)
      if (!orderId) {
        console.error('❌ OrderDetailsPage: No orderId provided')
        toast.error('Order ID not found')
        navigate('/delivery/orders')
        return
      }
      
      try {
        setLoading(true)
        let order = null
        
        // First try to get from deliveryAPI.getOrderDetails (for active orders)
        try {
          console.log('📡 OrderDetailsPage: Trying deliveryAPI.getOrderDetails...')
          const response = await deliveryAPI.getOrderDetails(orderId)
          console.log('📡 OrderDetailsPage: Response:', response?.data)
          if (response?.data?.success && response?.data?.data) {
            order = response.data.data.order || response.data.data
            console.log('✅ OrderDetailsPage: Found order from getOrderDetails:', order?.orderId || order?._id)
          }
        } catch (orderErr) {
          console.log('⚠️ OrderDetailsPage: Delivery Order API failed, trying trip history...', orderErr)
        }
        
        // If not found, try trip history API for delivered/cancelled orders
        if (!order) {
          try {
            console.log('📡 OrderDetailsPage: Trying getTripHistory...')
            const tripResponse = await deliveryAPI.getTripHistory({
              period: 'monthly',
              date: new Date().toISOString().split('T')[0],
              limit: 1000
            })
            console.log('📡 OrderDetailsPage: Trip history response:', tripResponse?.data)
            if (tripResponse?.data?.success && tripResponse?.data?.data?.trips) {
              const trips = tripResponse.data.data.trips
              console.log(`📋 OrderDetailsPage: Found ${trips.length} trips, searching for orderId: ${orderId}`)
              const foundOrder = trips.find(
                trip => (trip.orderId && trip.orderId === orderId) || 
                        (trip._id && trip._id === orderId) ||
                        (trip.id && trip.id === orderId)
              )
              if (foundOrder) {
                order = foundOrder
                console.log('✅ OrderDetailsPage: Found order from trip history:', order?.orderId || order?._id)
              } else {
                console.log('⚠️ OrderDetailsPage: Order not found in trip history')
              }
            }
          } catch (tripErr) {
            console.error('❌ OrderDetailsPage: Error fetching from trip history:', tripErr)
          }
        }
        
        if (order) {
          console.log('✅ OrderDetailsPage: Setting order data:', order)
          setOrderData(order)
        } else {
          console.error('❌ OrderDetailsPage: Order not found after all attempts')
          toast.error('Order not found')
          navigate('/delivery/orders')
        }
      } catch (error) {
        console.error('❌ OrderDetailsPage: Error fetching order details:', error)
        toast.error('Failed to load order details')
        navigate('/delivery/orders')
      } finally {
        setLoading(false)
      }
    }

    fetchOrderDetails()
  }, [orderId, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff8100] mx-auto mb-4" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    )
  }

  if (!orderData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Order not found</p>
          <button
            onClick={() => navigate('/delivery/orders')}
            className="px-4 py-2 bg-[#ff8100] text-white rounded-lg hover:bg-[#e67300] transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    )
  }

  const restaurantAddress = getRestaurantAddress(orderData)
  const customerAddress = getCustomerAddress(orderData)
  const paymentMethod = (orderData.payment?.method || 'razorpay').toLowerCase()
  const isCOD = paymentMethod === 'cash' || paymentMethod === 'cod'
  const earnings = orderData.pricing?.deliveryFee || orderData.estimatedEarnings || 0

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900">Order Details</h1>
            <p className="text-sm text-gray-500">{orderData.orderId || orderData._id || orderId}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4">
        {/* Order Timeline */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-[#ff8100]" />
            <h2 className="text-lg font-semibold text-gray-900">Order Timeline</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Order Placed</p>
                <p className="text-xs text-gray-500">{formatOrderDate(orderData.createdAt)}</p>
              </div>
            </div>
            {orderData.deliveredAt && (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Delivered</p>
                  <p className="text-xs text-gray-500">{formatOrderDate(orderData.deliveredAt)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Customer Details */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Customer Details</h2>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Name</p>
              <p className="text-sm font-medium text-gray-900">
                {orderData.userId?.name || orderData.customer || 'N/A'}
              </p>
            </div>
            {orderData.userId?.phone && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Phone</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{orderData.userId.phone}</p>
                  <button
                    onClick={() => window.open(`tel:${orderData.userId.phone}`, '_self')}
                    className="p-1.5 bg-green-100 rounded-full hover:bg-green-200 transition-colors"
                  >
                    <Phone className="w-4 h-4 text-green-600" />
                  </button>
                </div>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-1">Delivery Address</p>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-900 break-words">{customerAddress}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Restaurant Details */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <ChefHat className="w-5 h-5 text-[#ff8100]" />
            <h2 className="text-lg font-semibold text-gray-900">Restaurant Details</h2>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Name</p>
              <p className="text-sm font-medium text-gray-900">
                {orderData.restaurantName || orderData.restaurantId?.name || 'N/A'}
              </p>
            </div>
            {orderData.restaurantId?.phone && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Phone</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{orderData.restaurantId.phone}</p>
                  <button
                    onClick={() => window.open(`tel:${orderData.restaurantId.phone}`, '_self')}
                    className="p-1.5 bg-green-100 rounded-full hover:bg-green-200 transition-colors"
                  >
                    <Phone className="w-4 h-4 text-green-600" />
                  </button>
                </div>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-1">Address</p>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-900 break-words">{restaurantAddress}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Order Items */}
        {orderData.items && orderData.items.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-semibold text-gray-900">Order Items ({orderData.items.length})</h2>
            </div>
            <div className="space-y-3">
              {orderData.items.map((item, idx) => (
                <div key={item._id || item.itemId || idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-4 h-4 border-2 ${item.isVeg ? 'border-green-600' : 'border-red-600'} flex items-center justify-center p-[2px] shrink-0`}>
                      <div className={`w-full h-full rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {item.quantity || 1} x {item.name}
                      </p>
                      {item.variation && (
                        <p className="text-xs text-gray-500 mt-0.5">{item.variation}</p>
                      )}
                    </div>
                  </div>
                  {item.price && (
                    <p className="text-sm font-semibold text-gray-900 ml-2">
                      ₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment & Earnings */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Payment & Earnings</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Payment Mode</span>
              </div>
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                isCOD ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
              }`}>
                {isCOD ? 'COD' : 'Online'}
              </span>
            </div>
            {earnings > 0 && (
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-900">Your Earnings</span>
                </div>
                <span className="text-lg font-bold text-green-600">₹{earnings.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Price Breakdown */}
        {orderData.pricing && (
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Price Breakdown</h2>
            </div>
            <div className="space-y-2">
              {orderData.pricing.subtotal != null && Number(orderData.pricing.subtotal) > 0 && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Subtotal</span>
                  <span className="text-sm font-medium text-gray-900">₹{Number(orderData.pricing.subtotal).toFixed(2)}</span>
                </div>
              )}
              {orderData.pricing.deliveryFee != null && Number(orderData.pricing.deliveryFee) > 0 && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Delivery Fee</span>
                  <span className="text-sm font-medium text-green-600">₹{Number(orderData.pricing.deliveryFee).toFixed(2)}</span>
                </div>
              )}
              {orderData.pricing.tax != null && Number(orderData.pricing.tax) > 0 && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Tax</span>
                  <span className="text-sm font-medium text-gray-900">₹{Number(orderData.pricing.tax).toFixed(2)}</span>
                </div>
              )}
              {orderData.pricing.discount != null && Number(orderData.pricing.discount) > 0 && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Discount</span>
                  <span className="text-sm font-medium text-red-600">-₹{Number(orderData.pricing.discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-3 border-t border-gray-200 mt-2">
                <span className="text-base font-bold text-gray-900">Total</span>
                <span className="text-lg font-bold text-[#ff8100]">₹{(orderData.pricing.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Special Instructions */}
        {orderData.note && orderData.note.trim() && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-yellow-600" />
              <h3 className="text-sm font-semibold text-yellow-900">Special Instructions</h3>
            </div>
            <p className="text-sm text-yellow-800">{orderData.note}</p>
          </div>
        )}

        {/* Order Status Badge */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Order Status</span>
            <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
              orderData.status === 'delivered' || orderData.status === 'Delivered' || orderData.deliveredAt
                ? 'bg-green-100 text-green-700'
                : orderData.status === 'cancelled' || orderData.status === 'Cancelled'
                ? 'bg-red-100 text-red-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {orderData.status === 'delivered' || orderData.status === 'Delivered' || orderData.deliveredAt
                ? 'Delivered'
                : orderData.status === 'cancelled' || orderData.status === 'Cancelled'
                ? 'Cancelled'
                : orderData.status || 'Pending'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

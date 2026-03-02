import { Eye, MapPin, Package, User, Phone, Mail, Calendar, Clock, Truck, CreditCard, X, Receipt, FileText, Navigation, CheckCircle2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

const getStatusColor = (orderStatus) => {
  const colors = {
    "Delivered": "bg-emerald-100 text-emerald-700",
    "Pending": "bg-blue-100 text-blue-700",
    "Scheduled": "bg-blue-100 text-blue-700",
    "Accepted": "bg-green-100 text-green-700",
    "Processing": "bg-orange-100 text-orange-700",
    "Food On The Way": "bg-yellow-100 text-yellow-700",
    "Canceled": "bg-rose-100 text-rose-700",
    "Cancelled by Restaurant": "bg-red-100 text-red-700",
    "Cancelled by User": "bg-orange-100 text-orange-700",
    "Payment Failed": "bg-red-100 text-red-700",
    "Refunded": "bg-sky-100 text-sky-700",
    "Dine In": "bg-indigo-100 text-indigo-700",
    "Offline Payments": "bg-slate-100 text-slate-700",
  }
  return colors[orderStatus] || "bg-slate-100 text-slate-700"
}

const getPaymentStatusColor = (paymentStatus) => {
  if (paymentStatus === "Paid" || paymentStatus === "Collected") return "text-emerald-600"
  if (paymentStatus === "Not Collected") return "text-amber-600"
  if (paymentStatus === "Unpaid" || paymentStatus === "Failed") return "text-red-600"
  return "text-slate-600"
}

export default function ViewOrderDialog({ isOpen, onOpenChange, order, onMarkPickedUp, onMarkDelivered }) {
  if (!order) return null

  // Debug: Log order data to check billImageUrl
  if (order.billImageUrl) {
    console.log('📸 Bill Image URL found:', order.billImageUrl)
  } else {
    console.log('⚠️ Bill Image URL not found in order:', {
      orderId: order.orderId,
      hasBillImageUrl: !!order.billImageUrl,
      orderKeys: Object.keys(order)
    })
  }

  // Format address for display as per user's strict requirements: 
  // "exact as it is in DB, no lat/long, no name, no phone, no state/district"
  const formatAddress = (address, order) => {
    if (!address) return "N/A"

    // Use order.deliveryAddressDetails if available as it's the DB address requested by user
    // Fallback to formattedAddress if needed
    let addr = order.deliveryAddressDetails || address.formattedAddress || address.address || ""

    // Cleanup: Remove name, phone, lat/long
    if (order.customerName) {
      addr = String(addr).replace(new RegExp(order.customerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
    }
    addr = String(addr).replace(/(?:\+?\d{10,15})/g, '');
    addr = String(addr).replace(/-?\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+,?\s*/g, '');

    // Remove state and city/district as requested: "state aur distruct bhi nhi"
    if (address.state) {
      addr = String(addr).replace(new RegExp(`,\\s*${address.state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), '').replace(new RegExp(address.state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
    }
    if (address.city) {
      addr = String(addr).replace(new RegExp(`,\\s*${address.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), '').replace(new RegExp(address.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
    }

    // Explicitly remove common state names from images/past turn
    addr = addr.replace(/,\s*Maharashtra/gi, '').replace(/Maharashtra/gi, '');
    addr = addr.replace(/,\s*Madhya Pradesh/gi, '').replace(/Madhya Pradesh/gi, '');

    // Final clean up of commas and spaces
    addr = String(addr).replace(/,\s*,/g, ',').replace(/^[\s,]+|[\s,]+$/g, '')

    // If after cleaning it's empty, build from basic parts minus city/state
    if (!addr) {
      const parts = []
      if (address.street) parts.push(address.street)
      if (address.additionalDetails) parts.push(address.additionalDetails)
      if (address.zipCode) parts.push(address.zipCode)
      addr = parts.join(", ")
    }

    return addr || "Address not available"
  }

  // Get coordinates if available
  const getCoordinates = (address) => {
    if (address?.location?.coordinates && Array.isArray(address.location.coordinates) && address.location.coordinates.length === 2) {
      const [lng, lat] = address.location.coordinates
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    }
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-white p-0 overflow-y-auto">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-orange-600" />
            Order Details
          </DialogTitle>
          <DialogDescription>
            View complete information about this order
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-6 space-y-6">
          {/* Basic Order Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Order ID
                </p>
                <p className="text-2xl font-black text-slate-900">{order.orderId || order.id || order.subscriptionId}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Order Date
                </p>
                <p className="text-xl font-bold text-slate-900">{order.date}{order.time ? `, ${order.time}` : ""}</p>
              </div>
              {order.estimatedDeliveryTime && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Estimated Delivery Time
                  </p>
                  <p className="text-xl font-bold text-slate-900">{order.estimatedDeliveryTime} minutes</p>
                </div>
              )}
              {order.deliveredAt && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Delivered At
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {new Date(order.deliveredAt).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }).toUpperCase()}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {order.orderStatus && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Order Status</p>
                  <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold ${getStatusColor(order.orderStatus)}`}>
                    {order.orderStatus}
                  </span>
                  {order.cancellationReason && (
                    <p className="text-sm text-red-600 mt-2 p-3 bg-red-50 rounded-lg border border-red-100 font-bold">
                      <span className="text-xs uppercase tracking-wider block mb-1">
                        {order.cancelledBy === 'user' ? 'Cancelled by User' :
                          order.cancelledBy === 'restaurant' ? 'Cancelled by Restaurant' :
                            'Cancellation Reason'}
                      </span> {order.cancellationReason}
                    </p>
                  )}
                  {order.cancelledAt && (
                    <p className="text-xs text-slate-500 mt-1 font-bold italic">
                      Cancelled: {new Date(order.cancelledAt).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }).toUpperCase()}
                    </p>
                  )}
                </div>
              )}
              {(order.paymentStatus || order.paymentCollectionStatus != null) && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Payment Status
                  </p>
                  <p className={`text-xl font-black ${getPaymentStatusColor(
                    order.paymentType === 'Cash on Delivery' || order.payment?.method === 'cash' || order.payment?.method === 'cod'
                      ? (order.paymentCollectionStatus ?? (order.status === 'delivered' ? 'Collected' : 'Not Collected'))
                      : order.paymentStatus
                  )}`}>
                    {order.paymentType === 'Cash on Delivery' || order.payment?.method === 'cash' || order.payment?.method === 'cod'
                      ? (order.paymentCollectionStatus ?? (order.status === 'delivered' ? 'Collected' : 'Not Collected'))
                      : order.paymentStatus}
                  </p>
                </div>
              )}
              {order.deliveryType && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Delivery Type
                  </p>
                  <p className="text-xl font-bold text-slate-900">{order.deliveryType}</p>
                </div>
              )}
            </div>
          </div>

          {/* Customer Information */}
          <div className="border-t-4 border-slate-100 pt-6">
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <User className="w-6 h-6 text-orange-600" />
              CUSTOMER INFORMATION
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Customer Name</p>
                <p className="text-2xl font-black text-slate-900">{order.customerName || "N/A"}</p>
              </div>
              {order.customerPhone && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Phone className="w-5 h-5" />
                    Phone
                  </p>
                  <p className="text-2xl font-black text-slate-900">{order.customerPhone}</p>
                </div>
              )}
              {order.customerEmail && (
                <div className="col-span-1 md:col-span-2 space-y-2">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Email
                  </p>
                  <p className="text-xl font-bold text-slate-900">{order.customerEmail}</p>
                </div>
              )}
            </div>
          </div>

          {/* Restaurant Information */}
          {order.restaurant && (
            <div className="border-t-4 border-slate-100 pt-6">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <Package className="w-6 h-6 text-orange-600" />
                RESTAURANT INFORMATION
              </h3>
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Restaurant Name</p>
                <p className="text-2xl font-black text-slate-900">{order.restaurant}</p>
              </div>
            </div>
          )}

          {/* Order Items */}
          {order.items && Array.isArray(order.items) && order.items.length > 0 && (
            <div className="border-t-4 border-slate-100 pt-6">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <Package className="w-6 h-6 text-orange-600" />
                ORDER ITEMS ({order.items.length})
              </h3>

              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full text-left border-collapse bg-white">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-slate-200">
                      <th className="py-4 px-6 text-sm font-black text-slate-700 uppercase tracking-wider w-24">Qty</th>
                      <th className="py-4 px-6 text-sm font-black text-slate-700 uppercase tracking-wider">Item Details</th>
                      <th className="py-4 px-6 text-sm font-black text-slate-700 uppercase tracking-wider text-right w-36">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.items.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-5 px-6 align-top">
                          <span className="text-xl font-black text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 min-w-[3rem] text-center inline-block">
                            {item.quantity || 1}
                          </span>
                        </td>
                        <td className="py-5 px-6 align-top">
                          <div className="space-y-1">
                            <div className="flex items-center gap-3">
                              <span className={`w-3 h-3 rounded-full shrink-0 ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`}></span>
                              <p className="text-xl font-black text-slate-900 leading-tight">
                                {item.name || "Unknown Item"}
                              </p>
                            </div>
                            {(() => {
                              const sizeUnit = item.itemSizeUnit || item.unit || item.itemSize
                              const isPiece = sizeUnit && sizeUnit.trim().toLowerCase() === 'piece'
                              const displayParts = [item.itemSizeQuantity, !isPiece ? sizeUnit : null].filter(Boolean)
                              return displayParts.length > 0 ? (
                                <p className="text-base font-bold text-[#ff8100] ml-6">
                                  ({displayParts.join(' ')})
                                </p>
                              ) : null
                            })()}
                            {item.description && (
                              <div className="ml-6 mt-2 p-3 bg-orange-50 border-l-4 border-orange-400 rounded-r-lg">
                                <p className="text-sm text-slate-800 font-bold italic leading-relaxed">
                                  "{item.description}"
                                </p>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-5 px-6 align-top text-right">
                          <p className="text-xl font-black text-slate-900">
                            ₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                          </p>
                          {item.quantity > 1 && (
                            <p className="text-xs font-bold text-slate-500 mt-1">
                              (₹{item.price.toFixed(2)} × {item.quantity})
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {order.note && (
                <div className="mt-6 p-6 bg-blue-50 rounded-2xl border-2 border-blue-200 flex items-start gap-4 shadow-sm">
                  <div className="bg-blue-100 p-3 rounded-full shrink-0">
                    <FileText className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-blue-800 uppercase tracking-[0.2em] mb-3">IMPORTANT: CUSTOMER INSTRUCTIONS</p>
                    <p className="text-2xl text-blue-900 leading-tight font-black italic bg-white p-5 rounded-2xl border-2 border-dashed border-blue-200 shadow-inner">
                      "{order.note}"
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bill Image (Captured by Delivery Boy) */}
          {(order.billImageUrl || order.billImage || order.deliveryState?.billImageUrl) && (
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-orange-600" />
                Bill Image (Captured by Delivery Boy)
              </h3>
              <div className="space-y-3">
                <div className="relative w-full max-w-2xl border-2 border-slate-300 rounded-xl overflow-hidden bg-white shadow-sm">
                  <img
                    src={order.billImageUrl || order.billImage || order.deliveryState?.billImageUrl}
                    alt="Order Bill"
                    className="w-full h-auto object-contain max-h-[500px] mx-auto block"
                    loading="lazy"
                    onError={(e) => {
                      console.error('❌ Failed to load bill image:', e.target.src)
                      e.target.style.display = 'none';
                      const errorDiv = e.target.parentElement.querySelector('.error-message');
                      if (errorDiv) errorDiv.style.display = 'block';
                    }}
                    onLoad={() => {
                      console.log('✅ Bill image loaded successfully')
                    }}
                  />
                  <div className="error-message hidden p-6 text-center text-slate-500 text-sm bg-slate-50">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    Failed to load bill image
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={order.billImageUrl || order.billImage || order.deliveryState?.billImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                  >
                    <Eye className="w-4 h-4" />
                    View Full Size
                  </a>
                  <a
                    href={order.billImageUrl || order.billImage || order.deliveryState?.billImageUrl}
                    download
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <Package className="w-4 h-4" />
                    Download
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Delivery Address */}
          {order.address && (
            <div className="border-t-4 border-slate-100 pt-6">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <MapPin className="w-6 h-6 text-orange-600" />
                DELIVERY ADDRESS
              </h3>
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
                <p className="text-2xl font-black text-slate-900 leading-snug">{formatAddress(order.address, order)}</p>
              </div>
            </div>
          )}

          {/* Delivery Partner Information */}
          {(order.deliveryPartnerName || order.deliveryPartnerPhone) && (
            <div className="border-t-4 border-slate-100 pt-6">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <Truck className="w-6 h-6 text-orange-600" />
                DELIVERY PARTNER
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                {order.deliveryPartnerName && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Name</p>
                    <p className="text-2xl font-black text-slate-900">{order.deliveryPartnerName}</p>
                  </div>
                )}
                {order.deliveryPartnerPhone && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <Phone className="w-5 h-5" />
                      Phone
                    </p>
                    <p className="text-2xl font-black text-slate-900">{order.deliveryPartnerPhone}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pricing Breakdown */}
          <div className="border-t-4 border-slate-100 pt-6">
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <Receipt className="w-6 h-6 text-orange-600" />
              PRICING BREAKDOWN
            </h3>
            <div className="space-y-4 p-6 bg-white rounded-2xl border-2 border-slate-100 shadow-sm">
              {order.totalItemAmount !== undefined && (
                <div className="flex justify-between items-center text-lg">
                  <span className="text-slate-600 font-bold">Item Subtotal</span>
                  <span className="font-black text-slate-900">₹{order.totalItemAmount.toFixed(2)}</span>
                </div>
              )}
              {order.itemDiscount !== undefined && order.itemDiscount > 0 && (
                <div className="flex justify-between items-center text-lg">
                  <span className="text-slate-600 font-bold">Discount</span>
                  <span className="font-black text-emerald-600">-₹{order.itemDiscount.toFixed(2)}</span>
                </div>
              )}
              {order.couponDiscount !== undefined && order.couponDiscount > 0 && (
                <div className="flex justify-between items-center text-lg">
                  <span className="text-slate-600 font-bold">Coupon Discount</span>
                  <span className="font-black text-emerald-600">-₹{order.couponDiscount.toFixed(2)}</span>
                </div>
              )}
              {order.deliveryCharge !== undefined && (
                <div className="flex justify-between items-center text-lg">
                  <span className="text-slate-600 font-bold">Delivery Charge</span>
                  <span className="font-black text-slate-900">
                    {order.deliveryCharge > 0 ? `₹${order.deliveryCharge.toFixed(2)}` : <span className="text-emerald-600">Free delivery</span>}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-lg">
                <span className="text-slate-600 font-bold">Platform Fee</span>
                <span className="font-black text-slate-900">
                  {order.platformFee !== undefined && order.platformFee > 0
                    ? `₹${order.platformFee.toFixed(2)}`
                    : <span className="text-slate-400">₹0.00</span>}
                </span>
              </div>
              {order.vatTax !== undefined && order.vatTax > 0 && (
                <div className="flex justify-between items-center text-lg">
                  <span className="text-slate-600 font-bold">Tax (GST)</span>
                  <span className="font-black text-slate-900">₹{order.vatTax.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-6 mt-2 border-t-4 border-dashed border-slate-100">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="text-xl font-black text-slate-900 block">Total Amount</span>
                    <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-widest leading-none">
                      {order.paymentType || order.payment?.method || 'ONLINE'}
                    </span>
                  </div>
                  <span className="text-5xl font-black text-[#ff8100] drop-shadow-sm">
                    ₹{(order.totalAmount || order.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Manual Override Actions */}
          {(onMarkPickedUp || onMarkDelivered) && (
            <div className="border-t border-slate-200 pt-4 flex flex-wrap gap-3 pb-4">
              <h3 className="text-sm font-semibold text-slate-700 w-full mb-1 flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" />
                Admin Manual Overrides (Fallback)
              </h3>
              <p className="text-xs text-slate-500 w-full mb-2">Use these only if the rider app is failing to update the status.</p>

              {onMarkPickedUp && ["Accepted", "Processing", "Ready to Pick"].includes(order.orderStatus) && (
                <button
                  onClick={() => {
                    onMarkPickedUp(order);
                    // Optionally close dialog on success, but onMarkPickedUp is async and handles its own UI
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-200 active:scale-95"
                >
                  <Navigation className="w-4 h-4" />
                  Mark as Picked Up
                </button>
              )}

              {onMarkDelivered && (order.orderStatus === "Food On The Way" || order.orderStatus === "Ready to Pick") && (
                <button
                  onClick={() => {
                    onMarkDelivered(order);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-200 active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark as Delivered
                </button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}


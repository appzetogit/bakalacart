import { useState, useEffect } from "react"
import { 
  Utensils, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  User, 
  Phone, 
  MapPin, 
  IndianRupee,
  Clock,
  Package,
  AlertCircle,
  RefreshCw,
  Check
} from "lucide-react"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

export default function RestaurantOrders() {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [restaurantAcceptedFilter, setRestaurantAcceptedFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [actionType, setActionType] = useState(null) // 'accept' or 'reassign'
  const [isProcessing, setIsProcessing] = useState(false)

  // Fetch restaurant orders
  const fetchOrders = async () => {
    try {
      setIsLoading(true)
      const params = {
        page,
        limit: 50,
        search: searchQuery || undefined,
        restaurantAccepted: restaurantAcceptedFilter !== "all" ? restaurantAcceptedFilter : undefined
      }

      const response = await adminAPI.getOrdersForAssignment(params)

      if (response.data?.success && response.data?.data?.orders) {
        setOrders(response.data.data.orders)
        setTotalPages(response.data.data.pagination?.pages || 1)
      } else {
        toast.error("Failed to fetch orders")
        setOrders([])
      }
    } catch (error) {
      console.error("Error fetching orders:", error)
      toast.error(error.response?.data?.message || "Failed to fetch orders")
      setOrders([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [page, restaurantAcceptedFilter])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchOrders()
      } else {
        setPage(1)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Handle accept order on behalf of restaurant
  const handleAcceptOrder = async () => {
    if (!selectedOrder) return

    try {
      setIsProcessing(true)
      const orderId = selectedOrder.id || selectedOrder.orderId
      
      // Call admin API to accept order on behalf of restaurant
      const response = await adminAPI.acceptOrderOnBehalfOfRestaurant(orderId)

      if (response?.data?.success) {
        toast.success(`Order ${selectedOrder.orderId} accepted successfully on behalf of restaurant`)
        setActionDialogOpen(false)
        setSelectedOrder(null)
        setActionType(null)
        fetchOrders() // Refresh orders list
      } else {
        toast.error(response?.data?.message || "Failed to accept order")
      }
    } catch (error) {
      console.error("Error accepting order:", error)
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          "Failed to accept order. Please try again."
      toast.error(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle reassign order to same restaurant
  const handleReassignOrder = async () => {
    if (!selectedOrder) return

    try {
      setIsProcessing(true)
      const orderId = selectedOrder.id || selectedOrder.orderId
      
      // Call admin API to reassign order to same restaurant
      const response = await adminAPI.reassignOrderToRestaurant(orderId)

      if (response?.data?.success) {
        toast.success(`Order ${selectedOrder.orderId} reassigned to restaurant successfully`)
        setActionDialogOpen(false)
        setSelectedOrder(null)
        setActionType(null)
        fetchOrders() // Refresh orders list
      } else {
        toast.error(response?.data?.message || "Failed to reassign order")
      }
    } catch (error) {
      console.error("Error reassigning order:", error)
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          "Failed to reassign order. Please try again."
      toast.error(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle action button click
  const handleActionClick = (order, type) => {
    setSelectedOrder(order)
    setActionType(type)
    setActionDialogOpen(true)
  }

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Utensils className="w-8 h-8" />
            Restaurant Orders
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage restaurant orders and acceptance
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search by order ID, customer name, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={restaurantAcceptedFilter}
          onValueChange={setRestaurantAcceptedFilter}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by acceptance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="true">Restaurant Accepted</SelectItem>
            <SelectItem value="false">Restaurant Not Accepted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center p-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Customer Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Restaurant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Restaurant Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {order.orderId}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {order.customerName || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {order.customerPhone || 'N/A'}
                          </div>
                          {order.address && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate max-w-[200px]">
                                {order.address.formattedAddress || 
                                 order.address.street || 
                                 `${order.address.city || ''}${order.address.state ? ', ' + order.address.state : ''}`.trim() || 
                                 'Address not available'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {order.restaurant}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white max-w-xs">
                        {order.items && order.items.length > 0 ? (
                          <div className="space-y-1">
                            {order.items.slice(0, 2).map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="font-medium">{item.name || 'Item'}</span>
                                <span className="text-gray-500 dark:text-gray-400">
                                  (Qty: {item.quantity || 1})
                                </span>
                              </div>
                            ))}
                            {order.items.length > 2 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                +{order.items.length - 2} more items
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">No items</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                        <IndianRupee className="w-4 h-4" />
                        {order.totalAmount?.toFixed(2) || "0.00"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {order.restaurantAccepted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Accepted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          <Clock className="w-3 h-3" />
                          Not Accepted
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {order.date}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {order.time}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {!order.restaurantAccepted ? (
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleActionClick(order, 'accept')}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            title="Accept order on behalf of restaurant"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Accept
                          </Button>
                          <Button
                            onClick={() => handleActionClick(order, 'reassign')}
                            size="sm"
                            variant="outline"
                            className="border-blue-600 text-blue-600 hover:bg-blue-50"
                            title="Reassign order to same restaurant"
                          >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Reassign
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-500">No action needed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              {actionType === 'accept' ? 'Accept Order' : 'Reassign Order'}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed">
              {actionType === 'accept' 
                ? 'Accept this order on behalf of the restaurant. This will mark the order as accepted and move it to preparing status.'
                : 'Reassign this order to the same restaurant. This will resend the order notification to the restaurant.'}
            </DialogDescription>
          </DialogHeader>
          
          {/* Order Details Card */}
          {selectedOrder && (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-base font-semibold text-gray-900 dark:text-white">Order Details</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Order ID</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white font-mono">{selectedOrder.orderId}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Customer</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{selectedOrder.customerName || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Restaurant</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{selectedOrder.restaurant || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Amount</span>
                  <span className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1">
                    <IndianRupee className="w-4 h-4" />
                    {selectedOrder.totalAmount?.toFixed(2) || "0.00"}
                  </span>
                </div>
                {selectedOrder.items && selectedOrder.items.length > 0 && (
                  <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-3">
                      <Utensils className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Items</span>
                    </div>
                    <div className="space-y-2">
                      {selectedOrder.items.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg px-3 py-2.5 border border-gray-200 dark:border-gray-700">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</span>
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            Qty: {item.quantity || 1}
                          </span>
                        </div>
                      ))}
                      {selectedOrder.items.length > 5 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                          +{selectedOrder.items.length - 5} more items
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Warning Message */}
          {actionType === 'accept' && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 dark:border-amber-500 rounded-lg p-4 flex items-start gap-3 shadow-sm">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">Note</p>
                <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                  This action will accept the order on behalf of the restaurant. The order will be moved to "preparing" status and the restaurant will be notified.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-5 mt-2 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={() => {
                setActionDialogOpen(false)
                setSelectedOrder(null)
                setActionType(null)
              }}
              disabled={isProcessing}
              className="min-w-[120px] h-10"
            >
              Cancel
            </Button>
            <Button
              onClick={actionType === 'accept' ? handleAcceptOrder : handleReassignOrder}
              disabled={isProcessing}
              className={`min-w-[140px] h-10 disabled:opacity-50 disabled:cursor-not-allowed ${
                actionType === 'accept' 
                  ? 'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white shadow-sm' 
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {actionType === 'accept' && <Check className="w-4 h-4 mr-2" />}
                  {actionType === 'accept' ? 'Accept Order' : 'Reassign Order'}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

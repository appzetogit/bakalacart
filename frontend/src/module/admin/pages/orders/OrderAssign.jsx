import { useState, useEffect } from "react"
import { Package, Search, CheckCircle2, XCircle, Loader2, User, Phone, IndianRupee, CheckSquare, Square, MapPin, Navigation } from "lucide-react"
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

export default function OrderAssign() {
  const [orders, setOrders] = useState([])
  const [deliveryBoys, setDeliveryBoys] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDeliveryBoys, setIsLoadingDeliveryBoys] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [restaurantAcceptedFilter, setRestaurantAcceptedFilter] = useState("all")
  const [assigningOrderId, setAssigningOrderId] = useState(null)
  const [selectedDeliveryBoy, setSelectedDeliveryBoy] = useState({})
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedOrders, setSelectedOrders] = useState(new Set())
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false)
  const [bulkDeliveryBoyId, setBulkDeliveryBoyId] = useState("")
  const [isBulkAssigning, setIsBulkAssigning] = useState(false)

  // Fetch orders for assignment
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
        const ordersData = response.data.data.orders
        // Debug: Log restaurant location data
        console.log('🔍 Orders with restaurant location:', ordersData.map(o => ({
          orderId: o.orderId,
          restaurant: o.restaurant,
          restaurantLocation: o.restaurantLocation,
          restaurantZoneName: o.restaurantZoneName
        })))
        setOrders(ordersData)
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

  // Fetch delivery boys for dropdown
  const fetchDeliveryBoys = async () => {
    try {
      setIsLoadingDeliveryBoys(true)
      const response = await adminAPI.getDeliveryBoysForAssignment()

      console.log("Delivery Boys API Response:", response)

      // Handle different response structures
      let deliveryBoysData = null
      if (response?.data?.success && response?.data?.data?.deliveryBoys) {
        deliveryBoysData = response.data.data.deliveryBoys
      } else if (response?.data?.deliveryBoys) {
        deliveryBoysData = response.data.deliveryBoys
      } else if (response?.data?.data) {
        deliveryBoysData = response.data.data
      }

      if (deliveryBoysData && Array.isArray(deliveryBoysData) && deliveryBoysData.length > 0) {
        console.log("Setting delivery boys:", deliveryBoysData)
        setDeliveryBoys(deliveryBoysData)
      } else {
        console.warn("No delivery boys found in response:", response)
        setDeliveryBoys([])
        if (deliveryBoysData && deliveryBoysData.length === 0) {
          toast.info("No delivery boys available")
        } else {
          toast.error("Failed to fetch delivery boys")
        }
      }
    } catch (error) {
      console.error("Error fetching delivery boys:", error)
      toast.error(error.response?.data?.message || "Failed to fetch delivery boys")
      setDeliveryBoys([])
    } finally {
      setIsLoadingDeliveryBoys(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [page, restaurantAcceptedFilter])

  useEffect(() => {
    fetchDeliveryBoys()
  }, [])

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

  // Handle assign button click
  const handleAssignClick = (order) => {
    setSelectedOrder(order)
    setSelectedDeliveryBoy({ [order.id]: "" })
    setAssignDialogOpen(true)
  }

  // Handle assignment
  const handleAssign = async () => {
    if (!selectedOrder) return

    const deliveryBoyId = selectedDeliveryBoy[selectedOrder.id]
    if (!deliveryBoyId) {
      toast.error("Please select a delivery boy")
      return
    }

    try {
      setAssigningOrderId(selectedOrder.id)
      const orderId = selectedOrder.id || selectedOrder.orderId
      const response = await adminAPI.assignOrderToDeliveryBoy(orderId, deliveryBoyId)

      if (response?.data?.success) {
        toast.success(`Order ${selectedOrder.orderId} assigned successfully`)
        setAssignDialogOpen(false)
        setSelectedOrder(null)
        setSelectedDeliveryBoy({})
        fetchOrders() // Refresh orders list
      } else {
        toast.error(response?.data?.message || "Failed to assign order")
      }
    } catch (error) {
      console.error("Error assigning order:", error)
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          "Failed to assign order. Please try again."
      toast.error(errorMessage)
    } finally {
      setAssigningOrderId(null)
    }
  }

  // Handle bulk assignment
  const handleBulkAssign = async () => {
    if (!bulkDeliveryBoyId) {
      toast.error("Please select a delivery boy")
      return
    }

    if (selectedOrders.size === 0) {
      toast.error("Please select at least one order")
      return
    }

    try {
      setIsBulkAssigning(true)
      const orderIds = Array.from(selectedOrders)
      let successCount = 0
      let failCount = 0

      // Assign orders one by one
      for (const orderId of orderIds) {
        try {
          const order = orders.find(o => (o.id || o._id) === orderId)
          if (!order) continue

          const response = await adminAPI.assignOrderToDeliveryBoy(
            order.id || order.orderId || orderId,
            bulkDeliveryBoyId
          )

          if (response?.data?.success) {
            successCount++
          } else {
            failCount++
          }
        } catch (error) {
          console.error(`Error assigning order ${orderId}:`, error)
          failCount++
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully assigned ${successCount} order(s)`)
      }
      if (failCount > 0) {
        toast.error(`Failed to assign ${failCount} order(s)`)
      }

      setBulkAssignDialogOpen(false)
      setBulkDeliveryBoyId("")
      setSelectedOrders(new Set())
      fetchOrders() // Refresh orders list
    } catch (error) {
      console.error("Error in bulk assignment:", error)
      toast.error("Failed to assign orders. Please try again.")
    } finally {
      setIsBulkAssigning(false)
    }
  }

  // Toggle order selection
  const toggleOrderSelection = (orderId) => {
    const newSelected = new Set(selectedOrders)
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId)
    } else {
      newSelected.add(orderId)
    }
    setSelectedOrders(newSelected)
  }

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id || o._id)))
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-8 h-8" />
            Order Assign
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Assign delivery boys to orders (single or multiple)
          </p>
        </div>
        {selectedOrders.size > 0 && (
          <Button
            onClick={() => setBulkAssignDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <User className="w-4 h-4 mr-2" />
            Assign {selectedOrders.size} Order{selectedOrders.size > 1 ? 's' : ''}
          </Button>
        )}
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
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center gap-2 hover:text-gray-700"
                    >
                      {selectedOrders.size === orders.length && orders.length > 0 ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      Select
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Restaurant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Customer Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Restaurant Zone & Pin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Food Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Restaurant Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Delivery Boy Status
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
                {orders.map((order) => {
                  const orderId = order.id || order._id
                  const isSelected = selectedOrders.has(orderId)
                  return (
                  <tr key={orderId} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleOrderSelection(orderId)}
                        className="flex items-center justify-center"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {order.orderId}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {order.customerName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {order.customerPhone}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {order.restaurant}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white max-w-xs">
                        {order.address ? (
                          <div className="space-y-1">
                            {order.address.formattedAddress ? (
                              <div className="flex items-start gap-1">
                                <MapPin className="w-3 h-3 mt-0.5 text-gray-500 flex-shrink-0" />
                                <span className="text-xs break-words">{order.address.formattedAddress}</span>
                              </div>
                            ) : (
                              <>
                                {order.address.street && (
                                  <div className="text-xs">{order.address.street}</div>
                                )}
                                {(order.address.area || order.address.city) && (
                                  <div className="text-xs text-gray-500">
                                    {[order.address.area, order.address.city].filter(Boolean).join(', ')}
                                  </div>
                                )}
                                {(order.address.state || order.address.zipCode || order.address.pincode) && (
                                  <div className="text-xs text-gray-500">
                                    {[order.address.state, order.address.zipCode || order.address.pincode].filter(Boolean).join(' - ')}
                                  </div>
                                )}
                              </>
                            )}
                            {order.address.additionalDetails && (
                              <div className="text-xs text-gray-400 italic">
                                {order.address.additionalDetails}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 text-xs">Not available</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white max-w-xs">
                        <div className="space-y-1">
                          {order.restaurantZoneName ? (
                            <div className="flex items-center gap-1">
                              <Navigation className="w-3 h-3 text-blue-600" />
                              <span className="text-xs font-medium">{order.restaurantZoneName}</span>
                            </div>
                          ) : null}
                          {order.restaurantLocation ? (
                            <div className="text-xs text-gray-500">
                              <div className="flex items-start gap-1">
                                <MapPin className="w-3 h-3 mt-0.5 text-gray-500 flex-shrink-0" />
                                <span className="break-words">
                                  {/* Priority 1: formattedAddress (live location from Google Maps) */}
                                  {order.restaurantLocation.formattedAddress && 
                                   order.restaurantLocation.formattedAddress.trim() !== '' &&
                                   order.restaurantLocation.formattedAddress.trim() !== 'Select location' &&
                                   !/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(order.restaurantLocation.formattedAddress.trim())
                                    ? order.restaurantLocation.formattedAddress.trim()
                                    : null}
                                  
                                  {/* Priority 2: address field */}
                                  {!order.restaurantLocation.formattedAddress && 
                                   order.restaurantLocation.address && 
                                   order.restaurantLocation.address.trim() !== '' &&
                                   order.restaurantLocation.address.trim() !== 'Location not available'
                                    ? order.restaurantLocation.address.trim()
                                    : null}
                                  
                                  {/* Priority 3: Build from components */}
                                  {!order.restaurantLocation.formattedAddress && 
                                   !order.restaurantLocation.address && 
                                   (order.restaurantLocation.area || order.restaurantLocation.city || order.restaurantLocation.addressLine1)
                                    ? [
                                        order.restaurantLocation.addressLine1,
                                        order.restaurantLocation.addressLine2,
                                        order.restaurantLocation.area,
                                        order.restaurantLocation.city,
                                        order.restaurantLocation.state
                                      ].filter(Boolean).join(', ')
                                    : null}
                                  
                                  {/* Pincode */}
                                  {(order.restaurantLocation.pincode || order.restaurantLocation.zipCode || order.restaurantLocation.postalCode) && (
                                    <span className="ml-1 font-medium">
                                      - {order.restaurantLocation.pincode || order.restaurantLocation.zipCode || order.restaurantLocation.postalCode}
                                    </span>
                                  )}
                                  
                                  {/* Fallback if nothing found */}
                                  {!order.restaurantLocation.formattedAddress && 
                                   !order.restaurantLocation.address && 
                                   !order.restaurantLocation.area && 
                                   !order.restaurantLocation.city && 
                                   !order.restaurantLocation.addressLine1
                                    ? 'Location not available'
                                    : null}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">Pin location not set</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white max-w-xs">
                        {order.items && order.items.length > 0 ? (
                          <div className="space-y-1">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="font-medium">{item.name || 'Item'}</span>
                                <span className="text-gray-500 dark:text-gray-400">
                                  (Qty: {item.quantity || 1})
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">No items</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        ₹{order.totalAmount?.toFixed(2) || "0.00"}
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
                          <XCircle className="w-3 h-3" />
                          Not Accepted
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {order.isAssigned || order.deliveryPartnerId ? (
                        order.isDeliveryBoyAccepted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Accepted
                          </span>
                        ) : order.isDeliveryBoyPending ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Assigned
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-xs">Not Assigned</span>
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
                      {order.canReassign ? (
                        <Button
                          onClick={() => handleAssignClick(order)}
                          disabled={assigningOrderId === order.id}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {assigningOrderId === order.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Assigning...
                            </>
                          ) : (
                            "Reassign"
                          )}
                        </Button>
                      ) : order.isAssigned && !order.canReassign ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Accepted
                        </span>
                      ) : (
                        <Button
                          onClick={() => handleAssignClick(order)}
                          disabled={assigningOrderId === order.id}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {assigningOrderId === order.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Assigning...
                            </>
                          ) : (
                            "Assign"
                          )}
                        </Button>
                      )}
                    </td>
                  </tr>
                  )
                })}
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

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              Assign Delivery Boy
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400 mt-2">
              Select a delivery boy to assign this order
            </DialogDescription>
          </DialogHeader>
          
          {/* Order Details Card */}
          {selectedOrder && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Order Details</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Order ID:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedOrder.orderId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Customer:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedOrder.customerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Restaurant:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedOrder.restaurant}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Amount:</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1">
                    <IndianRupee className="w-3 h-3" />
                    {selectedOrder.totalAmount?.toFixed(2) || "0.00"}
                  </span>
                </div>
                {selectedOrder.items && selectedOrder.items.length > 0 && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">Items:</span>
                    <div className="space-y-1">
                      {selectedOrder.items.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                          <span className="text-gray-500 dark:text-gray-400">Qty: {item.quantity || 1}</span>
                        </div>
                      ))}
                      {selectedOrder.items.length > 3 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          +{selectedOrder.items.length - 3} more items
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Delivery Boy Selection */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <User className="w-4 h-4" />
              Select Delivery Boy
            </label>
            {isLoadingDeliveryBoys ? (
              <div className="flex items-center justify-center p-8 border border-gray-200 dark:border-gray-700 rounded-lg">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Loading delivery boys...</span>
              </div>
            ) : deliveryBoys.length === 0 ? (
              <div className="text-center p-8 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                <User className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No delivery boys available</p>
              </div>
            ) : (
              <Select
                value={selectedDeliveryBoy[selectedOrder?.id] || ""}
                onValueChange={(value) => {
                  setSelectedDeliveryBoy({
                    ...selectedDeliveryBoy,
                    [selectedOrder?.id]: value
                  })
                }}
              >
                <SelectTrigger className="w-full h-11">
                  <SelectValue placeholder="Choose a delivery boy" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] z-[60]">
                  {deliveryBoys.length > 0 ? (
                    deliveryBoys.map((db) => {
                      const dbId = db._id || db.id
                      const dbName = db.name || "Unknown"
                      const dbPhone = db.phone || ""
                      const isOnline = db.isOnline || false
                      
                      return (
                        <SelectItem 
                          key={dbId} 
                          value={dbId?.toString()} 
                          className="cursor-pointer py-3"
                        >
                          <div className="flex items-center justify-between w-full gap-3">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium text-gray-900 dark:text-white truncate">{dbName}</span>
                                {dbPhone && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                    <Phone className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{dbPhone}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                            {isOnline && (
                              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full flex items-center gap-1 flex-shrink-0">
                                <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                                Online
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      )
                    })
                  ) : (
                    <div className="px-4 py-2 text-sm text-gray-500">No delivery boys available</div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={() => {
                setAssignDialogOpen(false)
                setSelectedOrder(null)
                setSelectedDeliveryBoy({})
              }}
              className="min-w-[100px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedDeliveryBoy[selectedOrder?.id] || assigningOrderId === selectedOrder?.id}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assigningOrderId === selectedOrder?.id ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={bulkAssignDialogOpen} onOpenChange={setBulkAssignDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              Bulk Assign Orders
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400 mt-2">
              Assign {selectedOrders.size} order{selectedOrders.size > 1 ? 's' : ''} to a delivery boy
            </DialogDescription>
          </DialogHeader>
          
          {/* Selected Orders Info */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Selected Orders</span>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {Array.from(selectedOrders).map((orderId) => {
                const order = orders.find(o => (o.id || o._id) === orderId)
                return order ? (
                  <div key={orderId} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{order.orderId}</span>
                    <span className="text-gray-500 dark:text-gray-400">₹{order.totalAmount?.toFixed(2) || "0.00"}</span>
                  </div>
                ) : null
              })}
            </div>
          </div>

          {/* Delivery Boy Selection */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <User className="w-4 h-4" />
              Select Delivery Boy
            </label>
            {isLoadingDeliveryBoys ? (
              <div className="flex items-center justify-center p-8 border border-gray-200 dark:border-gray-700 rounded-lg">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Loading delivery boys...</span>
              </div>
            ) : deliveryBoys.length === 0 ? (
              <div className="text-center p-8 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                <User className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No delivery boys available</p>
              </div>
            ) : (
              <Select
                value={bulkDeliveryBoyId}
                onValueChange={setBulkDeliveryBoyId}
              >
                <SelectTrigger className="w-full h-11">
                  <SelectValue placeholder="Choose a delivery boy" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] z-[60]">
                  {deliveryBoys.length > 0 ? (
                    deliveryBoys.map((db) => {
                      const dbId = db._id || db.id
                      const dbName = db.name || "Unknown"
                      const dbPhone = db.phone || ""
                      const isOnline = db.isOnline || false
                      
                      return (
                        <SelectItem 
                          key={dbId} 
                          value={dbId?.toString()} 
                          className="cursor-pointer py-3"
                        >
                          <div className="flex items-center justify-between w-full gap-3">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium text-gray-900 dark:text-white truncate">{dbName}</span>
                                {dbPhone && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                    <Phone className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{dbPhone}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                            {isOnline && (
                              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full flex items-center gap-1 flex-shrink-0">
                                <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                                Online
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      )
                    })
                  ) : (
                    <div className="px-4 py-2 text-sm text-gray-500">No delivery boys available</div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={() => {
                setBulkAssignDialogOpen(false)
                setBulkDeliveryBoyId("")
              }}
              className="min-w-[100px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkAssign}
              disabled={!bulkDeliveryBoyId || isBulkAssigning}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBulkAssigning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                `Assign ${selectedOrders.size} Order${selectedOrders.size > 1 ? 's' : ''}`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

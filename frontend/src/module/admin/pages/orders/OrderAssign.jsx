import { useState, useEffect, useRef } from "react"
import { Package, Search, CheckCircle2, XCircle, Loader2, User, Phone, IndianRupee, CheckSquare, Square, MapPin, Navigation, Clock, Copy } from "lucide-react"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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

const shortenOrderId = (id) => {
  if (!id) return ""
  const parts = id.split("-")
  if (parts.length >= 3) {
    return `${parts[0]}-${parts[parts.length - 1]}`
  }
  return id
}

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

  // Dynamic Dialogs state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [deliverDialogOpen, setDeliverDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("Cancelled by Admin")
  const [actionOrderId, setActionOrderId] = useState(null)

  // Fetch orders for assignment
  const fetchOrders = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true)
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
      if (showLoading) setIsLoading(false)
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

  const fetchTimeoutRef = useRef(null);
  const prevSearchRef = useRef(searchQuery);
  const prevFilterRef = useRef(restaurantAcceptedFilter);

  useEffect(() => {
    fetchDeliveryBoys()
  }, [])

  // Single robust observer for fetches that completely blocks double API calls
  useEffect(() => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);

    const isSearchUpdate = prevSearchRef.current !== searchQuery;
    const isFilterUpdate = prevFilterRef.current !== restaurantAcceptedFilter;

    prevSearchRef.current = searchQuery;
    prevFilterRef.current = restaurantAcceptedFilter;

    if (isSearchUpdate) {
      // Instant search typing
      if (page !== 1) setPage(1);
      else fetchOrders();
    } else if (isFilterUpdate && page !== 1) {
      // Filter changed while not on page 1: Reset page (this triggers effect again instantly)
      setPage(1);
    } else {
      // Mount, page change, or filter change on page 1: Fetch instantly
      fetchOrders();
    }

    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, [page, restaurantAcceptedFilter, searchQuery]);

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

      console.log('📦 Attempting to assign order:', {
        orderId,
        deliveryBoyId,
        selectedOrder: selectedOrder
      });

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
      console.error("Assign order error response:", error.response?.data);
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

  // Handle restaurant accept
  const handleRestaurantAccept = async (orderId) => {
    try {
      // Show loading or optimistic update could be added here
      const response = await adminAPI.acceptOrderOnBehalfOfRestaurant(orderId)
      if (response?.data?.success) {
        toast.success("Order accepted on behalf of restaurant")
        // Refresh orders to update status
        fetchOrders()
      } else {
        toast.error(response?.data?.message || "Failed to accept order")
      }
    } catch (error) {
      console.error("Error accepting order:", error)
      toast.error(error.response?.data?.message || "Failed to accept order")
    }
  }

  // Handle restaurant reject
  const handleRestaurantReject = async (orderId) => {
    // Prompt for rejection reason
    const reason = window.prompt("Enter rejection reason:", "Rejected by Admin")
    if (reason === null) return; // User cancelled

    try {
      const response = await adminAPI.rejectOrderOnBehalfOfRestaurant(orderId, reason)
      if (response?.data?.success) {
        toast.success("Order rejected on behalf of restaurant")
        fetchOrders()
      } else {
        toast.error(response?.data?.message || "Failed to reject order")
      }
    } catch (error) {
      console.error("Error rejecting order:", error)
      toast.error(error.response?.data?.message || "Failed to reject order")
    }
  }

  // Handle delivery boy accept
  const handleDeliveryBoyAccept = async (orderId) => {
    try {
      const response = await adminAPI.acceptOrderOnBehalfOfDeliveryBoy(orderId)
      if (response?.data?.success) {
        toast.success("Order accepted on behalf of delivery boy")
        fetchOrders()
      } else {
        toast.error(response?.data?.message || "Failed to accept order")
      }
    } catch (error) {
      console.error("Error accepting order:", error)
      toast.error(error.response?.data?.message || "Failed to accept order")
    }
  }

  // Handle delivery boy reject
  const handleDeliveryBoyReject = async (orderId) => {
    // Prompt for rejection reason
    const reason = window.prompt("Enter rejection reason:", "Rejected by Admin")
    if (reason === null) return; // User cancelled

    try {
      const response = await adminAPI.rejectOrderOnBehalfOfDeliveryBoy(orderId, reason)
      if (response?.data?.success) {
        toast.success("Order rejected on behalf of delivery boy")
        fetchOrders()
      } else {
        toast.error(response?.data?.message || "Failed to reject order")
      }
    } catch (error) {
      console.error("Error rejecting order:", error)
      toast.error(error.response?.data?.message || "Failed to reject order")
    }
  }

  // Handle Mark Cancelled
  const handleMarkCancelled = async () => {
    if (!actionOrderId) return;
    const orderId = actionOrderId;
    const reason = cancelReason || "Cancelled by Admin";

    try {
      // Optimistic update
      setOrders(prev => prev.filter(o => (o.id || o._id) !== orderId));
      setCancelDialogOpen(false);

      // Re-using rejectOrderOnBehalfOfRestaurant since it acts like a direct cancel in most flows 
      const response = await adminAPI.rejectOrderOnBehalfOfRestaurant(orderId, reason)
      if (response?.data?.success) {
        toast.success("Order has been Cancelled")
        fetchOrders(false) // Refetch silently
      } else {
        toast.error(response?.data?.message || "Failed to cancel order")
        fetchOrders(false) // Revert on fail
      }
    } catch (error) {
      console.error("Error cancelling order:", error)
      toast.error(error.response?.data?.message || "Failed to cancel order")
      fetchOrders(false)
    } finally {
      setActionOrderId(null);
      setCancelReason("Cancelled by Admin");
    }
  }

  // Handle Mark Delivered
  const handleMarkDelivered = async () => {
    if (!actionOrderId) return;
    const orderId = actionOrderId;

    try {
      // Optimistic update
      setOrders(prev => prev.filter(o => (o.id || o._id) !== orderId));
      setDeliverDialogOpen(false);

      const response = await adminAPI.markOrderAsDelivered(orderId)
      if (response?.data?.success) {
        toast.success("Order marked as Delivered successfully")
        fetchOrders(false) // Refetch silently
      } else {
        toast.error(response?.data?.message || "Failed to mark order as delivered")
        fetchOrders(false) // Revert on fail
      }
    } catch (error) {
      console.error("Error marking order as delivered:", error)
      toast.error(error.response?.data?.message || "Failed to mark order as delivered")
      fetchOrders(false)
    } finally {
      setActionOrderId(null);
    }
  }

  const openCancelDialog = (orderId) => {
    setActionOrderId(orderId);
    setCancelReason("Cancelled by Admin");
    setCancelDialogOpen(true);
  }

  const openDeliverDialog = (orderId) => {
    setActionOrderId(orderId);
    setDeliverDialogOpen(true);
  }

  return (
    <div className="space-y-6 flex-1 h-full overflow-hidden flex flex-col p-4 md:p-6 bg-gray-50/50 dark:bg-gray-900/50">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Package className="w-6 h-6 md:w-8 md:h-8 text-blue-600 dark:text-blue-400" />
            </div>
            Order Assignment
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Dispatch orders to available delivery partners
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedOrders.size > 0 && (
            <Button
              onClick={() => setBulkAssignDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
            >
              <User className="w-4 h-4 mr-2" />
              Assign {selectedOrders.size} Order{selectedOrders.size > 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="border-none shadow-sm bg-white dark:bg-gray-800">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by ID, customer, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-gray-50 dark:bg-gray-900 border-none focus-visible:ring-1"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Select
                value={restaurantAcceptedFilter}
                onValueChange={setRestaurantAcceptedFilter}
              >
                <SelectTrigger className="w-full md:w-[200px] h-10 bg-gray-50 dark:bg-gray-900 border-none">
                  <SelectValue placeholder="All Orders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="true">Restaurant Accepted</SelectItem>
                  <SelectItem value="false">Restaurant Not Accepted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <div className="flex-1 overflow-hidden min-h-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="mt-2 text-sm text-gray-500">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-full mb-4">
              <Package className="w-10 h-10 text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">No orders to assign</p>
            <p className="text-sm text-gray-400">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-auto rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                    <th className="p-4 text-left">
                      <button
                        onClick={toggleSelectAll}
                        className="transition-colors hover:text-blue-600"
                      >
                        {selectedOrders.size === orders.length && orders.length > 0 ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-300" />
                        )}
                      </button>
                    </th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Order Info</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Parties</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Logistics</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="p-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {orders.map((order) => {
                    const orderId = order.id || order._id
                    const isSelected = selectedOrders.has(orderId)
                    return (
                      <tr key={orderId} className={`group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
                        <td className="p-4 align-top">
                          <button
                            onClick={() => toggleOrderSelection(orderId)}
                            className="transition-colors hover:text-blue-600"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-200" />
                            )}
                          </button>
                        </td>
                        <td className="p-4 align-top">
                          <div className="space-y-1">
                            <div
                              className="flex items-center gap-2 font-bold text-gray-900 dark:text-white cursor-help"
                              title={order.orderId}
                            >
                              {shortenOrderId(order.orderId)}
                              <Copy className="w-3 h-3 text-gray-400 hover:text-blue-600 cursor-pointer" onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(order.orderId);
                                toast.success("ID Copied");
                              }} />
                            </div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {order.date} · {order.time}
                            </div>
                            <Badge variant="outline" className="text-xs font-bold bg-gray-50 dark:bg-gray-900 border-none">
                              ₹{order.totalAmount?.toFixed(2)}
                            </Badge>
                          </div>
                        </td>
                        <td className="p-4 align-top max-w-[250px]">
                          <div className="space-y-3">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1">
                                <User className="w-3 h-3 text-blue-500" /> {order.customerName}
                              </span>
                              <span className="text-xs text-gray-500 ml-4">{order.customerPhone}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                <Package className="w-3 h-3 text-orange-500" /> {order.restaurant}
                              </span>
                              <div className="ml-4 flex flex-wrap gap-1">
                                {order.items?.slice(0, 1).map((item, i) => (
                                  <span key={i} className="text-xs text-gray-500">
                                    {item.name} (x{item.quantity})
                                  </span>
                                ))}
                                {order.items?.length > 1 && (
                                  <span className="text-[10px] text-blue-500">+{order.items.length - 1} more</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 align-top min-w-[220px]">
                          <div className="space-y-3">
                            <div className="flex items-start gap-2">
                              <MapPin className="w-3.5 h-3.5 mt-0.5 text-red-500 shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-tight">Delivery Address</span>
                                <span
                                  className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-normal"
                                >
                                  {(() => {
                                    let a = order.address || {};
                                    let addr = a.formattedAddress || a.address || "";

                                    // If address looks like just lat/long coordinates or is missing, try to build it from parts
                                    if (!addr || /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(addr.trim())) {
                                      const parts = [
                                        a.street,
                                        a.additionalDetails,
                                        a.city,
                                        a.state,
                                        a.zipCode
                                      ].filter(Boolean);
                                      if (parts.length > 0) {
                                        addr = parts.join(', ');
                                      }
                                    }

                                    if (order.customerName) {
                                      addr = addr.replace(new RegExp(order.customerName, 'gi'), '');
                                    }
                                    // Remove phone numbers and optional trailing punctuation
                                    addr = addr.replace(/(?:\+?\d{10,15})/g, '');
                                    addr = addr.replace(/Flat\s*,?/gi, '');
                                    // Remove lat/long coordinates that might be embedded (very aggressive matching)
                                    addr = addr.replace(/-?\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+,?\s*/g, '');
                                    addr = addr.replace(/,\s*,/g, ',');
                                    addr = addr.replace(/^[\s,]+|[\s,]+$/g, '');
                                    addr = addr.replace(/,\s*Madhya Pradesh/gi, '').replace(/Madhya Pradesh/gi, '');
                                    return addr || "No customer address";
                                  })()}
                                </span>
                                {order.note && order.note.trim() && (
                                  <div className="mt-1 p-1 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800">
                                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                      Note: {order.note}
                                    </p>
                                  </div>
                                )}
                                {order.items && order.items.length > 0 && (
                                  <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight block mb-1">Order Items</span>
                                    <div className="space-y-1">
                                      {order.items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-[11px]">
                                          <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                                          <span className="font-bold text-gray-900 dark:text-white">x{item.quantity}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <IndianRupee className="w-3.5 h-3.5 mt-0.5 text-blue-500 shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-tight">Payment Mode</span>
                                <span className={`text-sm font-bold uppercase ${order.paymentMethod === 'cash' ? 'text-orange-600' : 'text-green-600'}`}>
                                  {order.paymentMethod === 'cash' ? 'COD' : order.paymentMethod === 'razorpay' || order.paymentMethod === 'online' ? 'Online' : order.paymentMethod}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 align-top">
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs uppercase font-bold text-gray-400">Restaurant</span>
                              {order.restaurantAccepted ? (
                                <Badge className="w-fit bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-none text-xs">
                                  Accepted
                                </Badge>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <Badge variant="outline" className="w-fit text-orange-600 border-orange-200 text-xs bg-orange-50">
                                    Pending
                                  </Badge>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleRestaurantAccept(order.id || order._id)}
                                      className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600 transition-colors"
                                      title="Accept Order"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleRestaurantReject(order.id || order._id)}
                                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 transition-colors"
                                      title="Reject Order"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs uppercase font-bold text-gray-400">Delivery</span>
                              {order.isAssigned || order.deliveryPartnerId ? (
                                <div className="flex flex-col gap-1">
                                  {order.deliveryPartnerName && (
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{order.deliveryPartnerName}</span>
                                  )}
                                  {order.isDeliveryBoyAccepted ? (
                                    <Badge className="w-fit bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-none text-xs">
                                      Accepted
                                    </Badge>
                                  ) : (
                                    <div className="flex flex-col gap-1">
                                      {/* Only show Assigned badge if pending */}
                                      {order.isDeliveryBoyPending && (
                                        <Badge className="w-fit bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-none text-xs">
                                          Assigned
                                        </Badge>
                                      )}
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => handleDeliveryBoyAccept(order.id || order._id)}
                                          className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600 transition-colors"
                                          title="Accept Order"
                                        >
                                          <CheckCircle2 className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => handleDeliveryBoyReject(order.id || order._id)}
                                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 transition-colors"
                                          title="Reject Order"
                                        >
                                          <XCircle className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <Badge variant="outline" className="w-fit text-gray-400 border-gray-200 text-xs">
                                  Unassigned
                                </Badge>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 align-top text-right">
                          <div className="flex flex-col gap-2">
                            <Button
                              onClick={() => handleAssignClick(order)}
                              disabled={assigningOrderId === orderId}
                              className={`h-9 px-4 text-sm w-full ${order.isAssigned ? "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300" : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                                }`}
                            >
                              {assigningOrderId === orderId ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                              ) : order.isAssigned ? (
                                "Reassign"
                              ) : (
                                "Assign Now"
                              )}
                            </Button>
                            {(order.status !== 'delivered' && order.status !== 'completed' && order.status !== 'cancelled') && (
                              <div className="flex gap-2 justify-end w-full mt-2">
                                <Button
                                  variant="outline"
                                  onClick={() => openCancelDialog(order.id || order._id)}
                                  className="h-8 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 flex-1"
                                  title="Cancel Order"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => openDeliverDialog(order.id || order._id)}
                                  className="h-8 px-2 text-xs border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 flex-1"
                                  title="Mark as Delivered"
                                >
                                  Mark as Delivered
                                </Button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden space-y-4 overflow-auto pb-4">
              {orders.map((order) => {
                const orderId = order.id || order._id
                const isSelected = selectedOrders.has(orderId)
                return (
                  <Card key={orderId} className={`border-none shadow-sm transition-all ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50/20' : 'bg-white dark:bg-gray-800'}`}>
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleOrderSelection(orderId)}
                            className="mt-1 transition-colors hover:text-blue-600"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-200 hover:text-gray-400" />
                            )}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-bold text-gray-900 dark:text-white">{shortenOrderId(order.orderId)}</span>
                              <Badge className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-none text-sm font-bold">
                                ₹{order.totalAmount?.toFixed(2)}
                              </Badge>
                            </div>
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {order.date} · {order.time}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <Button
                            onClick={() => handleAssignClick(order)}
                            disabled={assigningOrderId === orderId}
                            size="sm"
                            variant={order.isAssigned ? "outline" : "default"}
                            className={`h-9 px-3 text-sm w-full ${!order.isAssigned ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                          >
                            {order.isAssigned ? "Reassign" : "Assign"}
                          </Button>
                          {(order.status !== 'delivered' && order.status !== 'completed' && order.status !== 'cancelled') && (
                            <div className="flex gap-2 w-full mt-2">
                              <Button
                                variant="outline"
                                onClick={() => openCancelDialog(order.id || order._id)}
                                className="h-7 px-2 text-[10px] border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 flex-1"
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => openDeliverDialog(order.id || order._id)}
                                className="h-7 px-2 text-[10px] border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 flex-1"
                              >
                                Mark as Delivered
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50 dark:border-gray-700">
                        <div className="space-y-1">
                          <span className="text-xs uppercase font-bold text-gray-400 block">Customer</span>
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{order.customerName}</p>
                          <p className="text-xs text-gray-500">{order.customerPhone}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs uppercase font-bold text-gray-400 block">Restaurant</span>
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{order.restaurant}</p>
                          <div className="flex items-center gap-1">
                            {order.restaurantAccepted ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-none text-[10px] px-1.5 h-4">Accepted</Badge>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Badge className="bg-orange-100 text-orange-700 border-none text-[10px] px-1.5 h-4">Pending</Badge>
                                <div className="flex gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRestaurantAccept(order.id || order._id);
                                    }}
                                    className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600 transition-colors"
                                    title="Accept Order"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRestaurantReject(order.id || order._id);
                                    }}
                                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 transition-colors"
                                    title="Reject Order"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50 dark:border-gray-700">
                        <div className="space-y-1">
                          <span className="text-xs uppercase font-bold text-gray-400 block">Payment Mode</span>
                          <p className={`text-sm font-bold uppercase ${order.paymentMethod === 'cash' ? 'text-orange-600' : 'text-green-600'}`}>
                            {order.paymentMethod === 'cash' ? 'COD' : order.paymentMethod === 'razorpay' || order.paymentMethod === 'online' ? 'Online' : order.paymentMethod}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs uppercase font-bold text-gray-400 block">Delivery Partner</span>
                          {order.isAssigned || order.deliveryPartnerId ? (
                            <div className="flex flex-col gap-1">
                              {order.deliveryPartnerName && (
                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{order.deliveryPartnerName}</p>
                              )}
                              <div className="flex items-center gap-2">
                                {order.isDeliveryBoyAccepted ? (
                                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-none text-[10px] px-1.5 h-4">Accepted</Badge>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-none text-[10px] px-1.5 h-4">Assigned</Badge>
                                    <div className="flex gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeliveryBoyAccept(order.id || order._id);
                                        }}
                                        className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600 transition-colors"
                                        title="Accept Order"
                                      >
                                        <CheckCircle2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeliveryBoyReject(order.id || order._id);
                                        }}
                                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 transition-colors"
                                        title="Reject Order"
                                      >
                                        <XCircle className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <Badge variant="outline" className="w-fit text-gray-400 border-gray-200 text-xs text-[10px] px-1.5 h-4">Unassigned</Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3 pt-3 border-t border-gray-50 dark:border-gray-700">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 mt-0.5 text-red-500 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-tight">Delivery Address</span>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-normal">
                              {(() => {
                                let a = order.address || {};
                                let addr = a.formattedAddress || a.address || "";

                                if (!addr || /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(addr.trim())) {
                                  const parts = [
                                    a.street,
                                    a.additionalDetails,
                                    a.city,
                                    a.state,
                                    a.zipCode
                                  ].filter(Boolean);
                                  if (parts.length > 0) {
                                    addr = parts.join(', ');
                                  }
                                }

                                if (order.customerName) {
                                  addr = addr.replace(new RegExp(order.customerName, 'gi'), '');
                                }
                                addr = addr.replace(/(?:\+?\d{10,15})/g, '');
                                addr = addr.replace(/Flat\s*,?/gi, '');
                                addr = addr.replace(/-?\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+,?\s*/g, '');
                                addr = addr.replace(/,\s*,/g, ',');
                                addr = addr.replace(/^[\s,]+|[\s,]+$/g, '');
                                addr = addr.replace(/,\s*Madhya Pradesh/gi, '').replace(/Madhya Pradesh/gi, '');
                                return addr || "No address provided";
                              })()}
                            </p>
                            {order.note && order.note.trim() && (
                              <p className="mt-1 text-xs text-blue-600 dark:text-blue-400 italic">
                                "{order.note}"
                              </p>
                            )}
                            {order.items && order.items.length > 0 && (
                              <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight block mb-1">Order Items</span>
                                <div className="space-y-1.5">
                                  {order.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm">
                                      <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                                      <span className="text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[10px] font-bold">x{item.quantity}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )
        }

        {/* Pagination */}
        {
          totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-xl">
              <div className="text-xs text-gray-500">
                Page <span className="font-bold text-gray-900 dark:text-white">{page}</span> of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 px-3 text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 px-3 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )
        }
      </div >

      {/* Assign Dialog */}
      < Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen} >
        <DialogContent className="sm:max-w-[420px] max-h-[85vh] overflow-y-auto p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              Assign Delivery Boy
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Select a delivery boy to assign this order
            </DialogDescription>
          </DialogHeader>

          {/* Order Details Card */}
          {selectedOrder && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Order Details</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Order ID:</span>
                  <span className="font-medium text-gray-900 dark:text-white font-mono">{selectedOrder.orderId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Customer:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{selectedOrder.customerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Restaurant:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{selectedOrder.restaurant}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                  <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-1">
                    <IndianRupee className="w-3 h-3" />
                    {selectedOrder.totalAmount?.toFixed(2) || "0.00"}
                  </span>
                </div>
                {selectedOrder.items && selectedOrder.items.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="space-y-1">
                      {selectedOrder.items.slice(0, 2).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                          <span className="text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-[10px]">Qty: {item.quantity || 1}</span>
                        </div>
                      ))}
                      {selectedOrder.items.length > 2 && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          +{selectedOrder.items.length - 2} more items
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Delivery Boy Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Select Delivery Boy
            </label>
            {isLoadingDeliveryBoys ? (
              <div className="flex items-center justify-center p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">Loading...</span>
              </div>
            ) : deliveryBoys.length === 0 ? (
              <div className="text-center p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                <User className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-400">No delivery boys available</p>
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
                <SelectTrigger className="w-full h-9 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
                  {selectedDeliveryBoy[selectedOrder?.id] ? (() => {
                    const selectedDb = deliveryBoys.find(db => (db._id || db.id) === selectedDeliveryBoy[selectedOrder?.id])
                    if (selectedDb) {
                      const isOnline = selectedDb.isOnline || false
                      return (
                        <div className="flex items-center gap-2 flex-1">
                          <span className="font-medium text-sm">{selectedDb.name || "Unknown"}</span>
                          {isOnline ? (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-green-600 dark:bg-green-400 rounded-full"></div>
                              Online
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-full">
                              Offline
                            </span>
                          )}
                        </div>
                      )
                    }
                    return <SelectValue placeholder="Choose a delivery boy" />
                  })() : <SelectValue placeholder="Choose a delivery boy" />}
                </SelectTrigger>
                <SelectContent className="max-h-[250px] z-[60]">
                  {deliveryBoys.length > 0 ? (
                    deliveryBoys.map((db) => {
                      const dbId = db._id || db.id
                      const dbName = db.name || "Unknown"
                      const dbPhone = db.phone || ""
                      const isOnline = db.isOnline || false
                      const cashInHand = Number(db.cashInHand) || 0
                      // Use totalCashLimit from backend, or default to 750 if not provided
                      const totalCashLimit = (db.totalCashLimit !== undefined && db.totalCashLimit !== null)
                        ? Number(db.totalCashLimit)
                        : 750
                      const availableCashLimit = Number(db.availableCashLimit) || 0
                      const isCashLimitExceeded = cashInHand >= totalCashLimit

                      return (
                        <SelectItem
                          key={dbId}
                          value={dbId?.toString()}
                          className="cursor-pointer py-2"
                        >
                          <div className="flex items-start justify-between w-full gap-2">
                            <div className="flex items-start gap-2 flex-1 min-w-0 overflow-hidden">
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                                <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{dbName}</span>
                                {dbPhone && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate">
                                    <Phone className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{dbPhone}</span>
                                  </span>
                                )}
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className={`text-[10px] font-medium whitespace-nowrap ${isCashLimitExceeded ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                    Cash: ₹{cashInHand.toFixed(2)} / ₹{totalCashLimit.toFixed(2)}
                                  </span>
                                  {isCashLimitExceeded && (
                                    <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1 py-0.5 rounded whitespace-nowrap flex-shrink-0">
                                      OUT
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {isOnline && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full flex items-center gap-1 flex-shrink-0 whitespace-nowrap mt-0.5">
                                <div className="w-1.5 h-1.5 bg-green-600 dark:bg-green-400 rounded-full"></div>
                                Online
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      )
                    })
                  ) : (
                    <div className="px-4 py-2 text-xs text-gray-500 text-center">No delivery boys available</div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={() => {
                setAssignDialogOpen(false)
                setSelectedOrder(null)
                setSelectedDeliveryBoy({})
              }}
              className="min-w-[80px] h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedDeliveryBoy[selectedOrder?.id] || assigningOrderId === selectedOrder?.id}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[80px] h-8 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assigningOrderId === selectedOrder?.id ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog >

      {/* Bulk Assign Dialog */}
      < Dialog open={bulkAssignDialogOpen} onOpenChange={setBulkAssignDialogOpen} >
        <DialogContent className="sm:max-w-[400px] p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              Bulk Assign Orders
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Assign {selectedOrders.size} order{selectedOrders.size > 1 ? 's' : ''} to a delivery boy
            </DialogDescription>
          </DialogHeader>

          {/* Selected Orders Info */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Selected Orders ({selectedOrders.size})</span>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {Array.from(selectedOrders).slice(0, 5).map((orderId) => {
                const order = orders.find(o => (o.id || o._id) === orderId)
                return order ? (
                  <div key={orderId} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 dark:text-gray-300">{order.orderId}</span>
                    <span className="text-gray-500 dark:text-gray-400">₹{order.totalAmount?.toFixed(2) || "0.00"}</span>
                  </div>
                ) : null
              })}
              {selectedOrders.size > 5 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-200 dark:border-gray-700">
                  +{selectedOrders.size - 5} more orders
                </div>
              )}
            </div>
          </div>

          {/* Delivery Boy Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Select Delivery Boy
            </label>
            {isLoadingDeliveryBoys ? (
              <div className="flex items-center justify-center p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className="ml-2 text-xs text-gray-500">Loading...</span>
              </div>
            ) : deliveryBoys.length === 0 ? (
              <div className="text-center p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                <User className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-400">No delivery boys available</p>
              </div>
            ) : (
              <Select
                value={bulkDeliveryBoyId}
                onValueChange={setBulkDeliveryBoyId}
              >
                <SelectTrigger className="w-full h-9 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
                  {bulkDeliveryBoyId ? (() => {
                    const selectedDb = deliveryBoys.find(db => (db._id || db.id) === bulkDeliveryBoyId)
                    if (selectedDb) {
                      const isOnline = selectedDb.isOnline || false
                      return (
                        <div className="flex items-center gap-2 flex-1">
                          <span className="font-medium text-sm">{selectedDb.name || "Unknown"}</span>
                          {isOnline ? (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-green-600 dark:bg-green-400 rounded-full"></div>
                              Online
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-full">
                              Offline
                            </span>
                          )}
                        </div>
                      )
                    }
                    return <SelectValue placeholder="Choose a delivery boy" />
                  })() : <SelectValue placeholder="Choose a delivery boy" />}
                </SelectTrigger>
                <SelectContent className="max-h-[250px] z-[60]">
                  {deliveryBoys.length > 0 ? (
                    deliveryBoys.map((db) => {
                      const dbId = db._id || db.id
                      const dbName = db.name || "Unknown"
                      const dbPhone = db.phone || ""
                      const isOnline = db.isOnline || false
                      const cashInHand = Number(db.cashInHand) || 0
                      // Use totalCashLimit from backend, or default to 750 if not provided
                      const totalCashLimit = (db.totalCashLimit !== undefined && db.totalCashLimit !== null)
                        ? Number(db.totalCashLimit)
                        : 750
                      const availableCashLimit = Number(db.availableCashLimit) || 0
                      const isCashLimitExceeded = cashInHand >= totalCashLimit

                      return (
                        <SelectItem
                          key={dbId}
                          value={dbId?.toString()}
                          className="cursor-pointer py-2"
                        >
                          <div className="flex items-start justify-between w-full gap-2">
                            <div className="flex items-start gap-2 flex-1 min-w-0 overflow-hidden">
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                                <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{dbName}</span>
                                {dbPhone && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate">
                                    <Phone className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{dbPhone}</span>
                                  </span>
                                )}
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className={`text-[10px] font-medium whitespace-nowrap ${isCashLimitExceeded ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                    Cash: ₹{cashInHand.toFixed(2)} / ₹{totalCashLimit.toFixed(2)}
                                  </span>
                                  {isCashLimitExceeded && (
                                    <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1 py-0.5 rounded whitespace-nowrap flex-shrink-0">
                                      OUT
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {isOnline && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full flex items-center gap-1 flex-shrink-0 whitespace-nowrap mt-0.5">
                                <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                                Online
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      )
                    })
                  ) : (
                    <div className="px-4 py-2 text-xs text-gray-500">No delivery boys available</div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={() => {
                setBulkAssignDialogOpen(false)
                setBulkDeliveryBoyId("")
              }}
              className="min-w-[80px] h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkAssign}
              disabled={!bulkDeliveryBoyId || isBulkAssigning}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[80px] h-8 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBulkAssigning ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Assigning...
                </>
              ) : (
                `Assign ${selectedOrders.size}`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog >
      {/* Modern Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900 border-none shadow-2xl overflow-hidden rounded-2xl p-0">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-full">
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">Cancel Order</DialogTitle>
                <DialogDescription className="text-sm text-gray-500 mt-1">
                  Are you sure you want to cancel this order?
                </DialogDescription>
              </div>
            </div>

            <div className="space-y-4 py-2 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Reason for Cancellation
                </label>
                <Input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter cancellation reason"
                  className="font-medium bg-gray-50 dark:bg-gray-800 border-gray-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8">
              <Button
                variant="outline"
                onClick={() => setCancelDialogOpen(false)}
                className="font-medium min-w-[100px]"
              >
                Go Back
              </Button>
              <Button
                onClick={handleMarkCancelled}
                className="bg-red-600 hover:bg-red-700 text-white font-medium min-w-[100px]"
              >
                Confirm Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modern Deliver Dialog */}
      <Dialog open={deliverDialogOpen} onOpenChange={setDeliverDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900 border-none shadow-2xl overflow-hidden rounded-2xl p-0">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-full">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">Mark Delivered</DialogTitle>
                <DialogDescription className="text-sm text-gray-500 mt-1">
                  Manually complete this order
                </DialogDescription>
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-300">
              Are you sure you want to mark this order as <span className="font-bold text-green-600">DELIVERED</span>? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 mt-8">
              <Button
                variant="outline"
                onClick={() => setDeliverDialogOpen(false)}
                className="font-medium min-w-[100px]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleMarkDelivered}
                className="bg-green-600 hover:bg-green-700 text-white font-medium min-w-[100px]"
              >
                Yes, Delivered
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  )
}

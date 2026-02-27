import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import { FileText, Calendar, Package, CalendarDays, X, Bike } from "lucide-react"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"
import OrdersTopbar from "../../components/orders/OrdersTopbar"
import OrdersTable from "../../components/orders/OrdersTable"
import FilterPanel from "../../components/orders/FilterPanel"
import ViewOrderDialog from "../../components/orders/ViewOrderDialog"
import SettingsDialog from "../../components/orders/SettingsDialog"
import RefundModal from "../../components/orders/RefundModal"
import { useOrdersManagement } from "../../components/orders/useOrdersManagement"
import { Loader2 } from "lucide-react"

// Status configuration with titles, colors, and icons
const statusConfig = {
  "all": { title: "All Orders", color: "emerald", icon: FileText },
  "scheduled": { title: "Scheduled Orders", color: "blue", icon: Calendar },
  "pending": { title: "Pending Orders", color: "amber", icon: Package },
  "accepted": { title: "Accepted Orders", color: "green", icon: Package },
  "processing": { title: "Processing Orders", color: "orange", icon: Package },
  "ready": { title: "Ready to Pick Orders", color: "indigo", icon: Package },
  "food-on-the-way": { title: "Food On The Way Orders", color: "amber", icon: Package },
  "delivered": { title: "Delivered Orders", color: "emerald", icon: Package },
  "canceled": { title: "Canceled Orders", color: "rose", icon: Package },
  "restaurant-cancelled": { title: "Restaurant Cancelled Orders", color: "red", icon: Package },
  "payment-failed": { title: "Payment Failed Orders", color: "red", icon: Package },
  "refunded": { title: "Refunded Orders", color: "sky", icon: Package },
  "offline-payments": { title: "Offline Payments", color: "slate", icon: Package },
}

export default function OrdersPage({ statusKey = "all" }) {
  const config = statusConfig[statusKey] || statusConfig["all"]
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [processingRefund, setProcessingRefund] = useState(null)
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [selectedOrderForRefund, setSelectedOrderForRefund] = useState(null)
  const [activeFiltersCountState, setActiveFiltersCountState] = useState(0)
  const [quickDateLabel, setQuickDateLabel] = useState("")

  // Get management functions but we'll handle orders differently for server-side pagination
  const ordersManagement = useOrdersManagement(orders, statusKey, config.title)

  const {
    searchQuery,
    setSearchQuery,
    isFilterOpen,
    setIsFilterOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isViewOrderOpen,
    setIsViewOrderOpen,
    selectedOrder,
    filters,
    setFilters,
    visibleColumns,
    // We don't use filteredOrders from the hook because we do server-side filtering
    // and the 'orders' state itself is already the filtered result
    restaurants,
    handleApplyFilters,
    handleResetFilters,
    handleExport,
    handleViewOrder,
    handlePrintOrder,
    toggleColumn,
    resetColumns,
  } = ordersManagement

  // Fetch orders from backend API
  const fetchOrders = async (pageNum = 1) => {
    try {
      setIsLoading(true)

      const params = {
        page: pageNum,
        limit: 10, // Match OrdersTable itemsPerPage for perfect server-side pagination
        status: statusKey === "all" ? undefined :
          statusKey === "restaurant-cancelled" ? "cancelled" : statusKey,
        cancelledBy: statusKey === "restaurant-cancelled" ? "restaurant" : undefined,
        search: searchQuery || undefined,
        paymentStatus: filters.paymentStatus || undefined,
        restaurant: filters.restaurant || undefined,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        zone: filters.zone || undefined,
        customer: filters.customer || undefined,
        deliveryPartner: filters.deliveryPartner || undefined
      }

      const response = await adminAPI.getOrders(params, { timeout: 60000 })

      if (response.data?.success && response.data?.data?.orders) {
        const fetchedOrders = response.data.data.orders;
        const total = response.data.data.pagination?.total || fetchedOrders.length;

        setOrders(fetchedOrders)
        setTotalCount(total)
      } else {
        console.error("Failed to fetch orders:", response.data)
        setOrders([])
        setTotalCount(0)
      }
    } catch (error) {
      console.error("Error fetching orders:", error)
      toast.error(error.response?.data?.message || "Failed to fetch orders")
      setOrders([])
    } finally {
      setIsLoading(false)
    }
  }


  // Recalculate filter count UI
  useEffect(() => {
    let count = 0;
    if (filters.paymentStatus) count++;
    if (filters.restaurant) count++;
    if (filters.fromDate) count++;
    if (filters.toDate) count++;
    if (filters.zone) count++;
    if (filters.customer) count++;
    if (filters.deliveryPartner) count++;
    setActiveFiltersCountState(count);

    if (!filters.fromDate && !filters.toDate) {
      setQuickDateLabel("");
    }
  }, [filters]);

  const fetchTimeoutRef = useRef(null);
  const prevSearchRef = useRef(searchQuery);
  const prevFiltersRef = useRef(JSON.stringify(filters));
  const prevStatusRef = useRef(statusKey);

  // Single unified fetch effect to completely eliminate duplicate API calls
  useEffect(() => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);

    const isSearchUpdate = prevSearchRef.current !== searchQuery;
    const currentFiltersStr = JSON.stringify(filters);
    const isFiltersUpdate = prevFiltersRef.current !== currentFiltersStr;
    const isStatusUpdate = prevStatusRef.current !== statusKey;

    prevSearchRef.current = searchQuery;
    prevFiltersRef.current = currentFiltersStr;
    prevStatusRef.current = statusKey;

    if (isSearchUpdate) {
      // Debounce typing in search
      fetchTimeoutRef.current = setTimeout(() => {
        if (page !== 1) setPage(1);
        else fetchOrders(1);
      }, 500);
    } else if ((isFiltersUpdate || isStatusUpdate) && page !== 1) {
      // Filter or status changed while not on page 1: reset to page 1
      setPage(1);
    } else {
      // Mount, simple page change, or filter change on page 1: instant fetch
      fetchOrders(page);
    }

    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, [page, statusKey, searchQuery, filters]);

  // Handle mark picked up by admin
  const handleMarkPickedUp = async (order) => {
    const orderIdToUse = order.id || order._id || order.orderId
    if (!orderIdToUse) {
      toast.error('Order ID not found')
      return
    }

    if (!confirm(`Are you sure you want to mark order ${order.orderId} as PICKED UP? \n\nThis should only be used if the rider is unable to update the status via the app.`)) {
      return
    }

    try {
      const response = await adminAPI.markOrderAsPickedUp(orderIdToUse)
      if (response.data?.success) {
        toast.success(response.data?.message || `Order ${order.orderId} marked as picked up`)
        fetchOrders(page)
      } else {
        toast.error(response.data?.message || "Failed to update order status")
      }
    } catch (error) {
      console.error("❌ Error marking order as picked up:", error)
      toast.error(error.response?.data?.message || "Failed to update order status")
    }
  }

  // Handle mark delivered by admin
  const handleMarkDelivered = async (order) => {
    const orderIdToUse = order.id || order._id || order.orderId
    if (!orderIdToUse) {
      toast.error('Order ID not found')
      return
    }

    if (!confirm(`Are you sure you want to mark order ${order.orderId} as DELIVERED? \n\nThis should only be used if the rider is unable to update the status via the app.`)) {
      return
    }

    try {
      const response = await adminAPI.markOrderAsDelivered(orderIdToUse)
      if (response.data?.success) {
        toast.success(response.data?.message || `Order ${order.orderId} marked as delivered`)
        fetchOrders(page)
      } else {
        toast.error(response.data?.message || "Failed to update order status")
      }
    } catch (error) {
      console.error("❌ Error marking order as delivered:", error)
      toast.error(error.response?.data?.message || "Failed to update order status")
    }
  }

  // Handle refund button click - show modal for wallet payments, confirm dialog for others
  const handleRefund = (order) => {
    const isWalletPayment = order.paymentType === "Wallet" || order.payment?.method === "wallet";

    if (isWalletPayment) {
      // Show modal for wallet refunds
      setSelectedOrderForRefund(order)
      setRefundModalOpen(true)
    } else {
      // For non-wallet payments, use the old confirm dialog flow
      const confirmMessage = `Are you sure you want to process refund for order ${order.orderId}?\n\nThis will initiate a Razorpay refund to the customer's original payment method.`;

      if (!confirm(confirmMessage)) {
        return
      }

      processRefund(order, null) // null amount means use default
    }
  }

  // Process refund with amount
  const processRefund = async (order, refundAmount = null) => {
    const orderIdToUse = order.id || order._id || order.orderId

    if (!orderIdToUse) {
      console.error('❌ No orderId found in order object:', order)
      toast.error('Order ID not found. Please refresh the page and try again.')
      return
    }

    try {
      setProcessingRefund(orderIdToUse)

      // Include refundAmount in request body if provided (ensure it's a number)
      const requestData = refundAmount !== null ? { refundAmount: parseFloat(refundAmount) } : {}
      const response = await adminAPI.processRefund(orderIdToUse, requestData)

      if (response.data?.success) {
        const isWalletPayment = order.paymentType === "Wallet" || order.payment?.method === "wallet";
        toast.success(response.data?.message || (isWalletPayment
          ? `Wallet refund of ₹${refundAmount || order.totalAmount} processed successfully for order ${order.orderId}`
          : `Refund initiated successfully for order ${order.orderId}`))
        // Refresh the orders list to get updated data
        fetchOrders(page)
      } else {
        toast.error(response.data?.message || "Failed to process refund")
      }
    } catch (error) {
      console.error("❌ Error processing refund:", error)
      toast.error(error.response?.data?.message || "Failed to process refund")
    } finally {
      setProcessingRefund(null)
      setRefundModalOpen(false)
      setSelectedOrderForRefund(null)
    }
  }

  // Handle refund confirmation from modal
  const handleRefundConfirm = (amount) => {
    if (selectedOrderForRefund) {
      processRefund(selectedOrderForRefund, amount)
    }
  }

  // Handle delete order
  const handleDeleteOrder = async (order) => {
    const orderIdToUse = order.id || order._id || order.orderId

    if (!orderIdToUse) {
      toast.error('Order ID not found. Please refresh the page and try again.')
      return
    }

    const confirmMessage = `Are you sure you want to delete order ${order.orderId}?\n\nThis action cannot be undone. All order data will be permanently removed.`

    if (!confirm(confirmMessage)) {
      return
    }

    try {
      const response = await adminAPI.deleteOrder(orderIdToUse)

      if (response.data?.success) {
        toast.success(`Order ${order.orderId} deleted successfully`)
        // Refresh the orders list
        fetchOrders(page)
      } else {
        toast.error(response.data?.message || "Failed to delete order")
      }
    } catch (error) {
      console.error("❌ Error deleting order:", error)
      toast.error(error.response?.data?.message || "Failed to delete order. Please try again.")
    }
  }

  // Handle accept order on behalf of restaurant
  const handleAcceptOrder = async (order) => {
    const orderIdToUse = order.id || order._id || order.orderId

    if (!orderIdToUse) {
      toast.error('Order ID not found. Please refresh the page and try again.')
      return
    }

    const confirmMessage = `Are you sure you want to accept order ${order.orderId} on behalf of the restaurant?\n\nThis will mark the order as accepted and move it to "preparing" status.`

    if (!confirm(confirmMessage)) {
      return
    }

    try {
      const response = await adminAPI.acceptOrderOnBehalfOfRestaurant(orderIdToUse)

      if (response.data?.success) {
        toast.success(response.data?.message || `Order ${order.orderId} accepted successfully on behalf of restaurant`)
        // Refresh the orders list
        fetchOrders(page)
      } else {
        toast.error(response.data?.message || "Failed to accept order")
      }
    } catch (error) {
      console.error("❌ Error accepting order:", error)
      toast.error(error.response?.data?.message || "Failed to accept order. Please try again.")
    }
  }

  // Quick date helpers — set fromDate+toDate using existing filter state
  const todayStr = () => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  }

  const applyQuickDate = (label, from, to) => {
    setQuickDateLabel(label)
    setFilters(prev => ({ ...prev, fromDate: from, toDate: to }))
  }

  const clearQuickDate = () => {
    setQuickDateLabel("")
    setFilters(prev => ({ ...prev, fromDate: "", toDate: "" }))
  }

  const quickDateButtons = [
    {
      label: "Today",
      getRange: () => {
        const t = todayStr()
        return { from: t, to: t }
      }
    },
    {
      label: "Yesterday",
      getRange: () => {
        const d = new Date()
        d.setDate(d.getDate() - 1)
        const s = d.toISOString().split('T')[0]
        return { from: s, to: s }
      }
    },
    {
      label: "This Week",
      getRange: () => {
        const d = new Date()
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1)
        const mon = new Date(d.setDate(diff))
        return { from: mon.toISOString().split('T')[0], to: todayStr() }
      }
    },
    {
      label: "This Month",
      getRange: () => {
        const d = new Date()
        const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
        return { from, to: todayStr() }
      }
    },
  ]

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <OrdersTopbar
        title={config.title}
        count={totalCount}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onFilterClick={() => setIsFilterOpen(true)}
        activeFiltersCount={activeFiltersCountState}
        onExport={handleExport}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />
      <FilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        setFilters={setFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        restaurants={restaurants}
      />
      <SettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
        resetColumns={resetColumns}
      />
      <ViewOrderDialog
        isOpen={isViewOrderOpen}
        onOpenChange={setIsViewOrderOpen}
        order={selectedOrder}
        onMarkPickedUp={handleMarkPickedUp}
        onMarkDelivered={handleMarkDelivered}
      />
      <RefundModal
        isOpen={refundModalOpen}
        onOpenChange={setRefundModalOpen}
        order={selectedOrderForRefund}
        onConfirm={handleRefundConfirm}
        isProcessing={processingRefund !== null}
      />

      {/* Quick Date Shortcuts + Active Filter Summary */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
          <CalendarDays className="w-3.5 h-3.5" /> Quick:
        </span>
        {quickDateButtons.map(({ label, getRange }) => {
          const isActive = quickDateLabel === label
          return (
            <button
              key={label}
              onClick={() => {
                const { from, to } = getRange()
                applyQuickDate(label, from, to)
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${isActive
                ? "bg-blue-600 text-white border-blue-600 shadow"
                : "bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600"
                }`}
            >
              {label}
            </button>
          )
        })}

        {/* Active filter pills */}
        {(quickDateLabel || filters.fromDate || filters.toDate || filters.deliveryPartner) && (
          <div className="flex flex-wrap items-center gap-2 ml-2">
            {(quickDateLabel || filters.fromDate) && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                <Calendar className="w-3 h-3" />
                {quickDateLabel
                  ? `${quickDateLabel}: ${totalCount} order${totalCount !== 1 ? 's' : ''}`
                  : `${filters.fromDate}${filters.toDate && filters.toDate !== filters.fromDate ? ` → ${filters.toDate}` : ''}: ${totalCount} order${totalCount !== 1 ? 's' : ''}`
                }
                <button onClick={clearQuickDate} className="ml-1 hover:text-blue-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.deliveryPartner && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                <Bike className="w-3 h-3" />
                Rider: {filters.deliveryPartner} — {totalCount} order{totalCount !== 1 ? 's' : ''}
                <button
                  onClick={() => setFilters(prev => ({ ...prev, deliveryPartner: '' }))}
                  className="ml-1 hover:text-emerald-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {isLoading ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-20 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
            <p className="text-gray-600 font-medium">Fetching orders...</p>
          </div>
        ) : (
          <OrdersTable
            orders={orders}
            visibleColumns={visibleColumns}
            onViewOrder={handleViewOrder}
            onPrintOrder={handlePrintOrder}
            onRefund={handleRefund}
            onDeleteOrder={handleDeleteOrder}
            onAcceptOrder={handleAcceptOrder}
            onMarkPickedUp={handleMarkPickedUp}
            onMarkDelivered={handleMarkDelivered}
            currentPage={page}
            totalCount={totalCount}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from "react"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import OrdersTopbar from "../../components/orders/OrdersTopbar"
import OrdersTable from "../../components/orders/OrdersTable"
import FilterPanel from "../../components/orders/FilterPanel"
import ViewOrderDialog from "../../components/orders/ViewOrderDialog"
import SettingsDialog from "../../components/orders/SettingsDialog"
import { useOrdersManagement } from "../../components/orders/useOrdersManagement"

export default function OfflinePayments() {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const statusKey = "offline-payments"

  // Fetch orders from backend API
  const fetchOrders = async () => {
    try {
      setIsLoading(true)
      const params = {
        page: 1,
        limit: 500, // Reduced from 1000 for better performance
        status: statusKey
      }

      const response = await adminAPI.getOrders(params, { timeout: 60000 })

      if (response.data?.success && response.data?.data?.orders) {
        setOrders(response.data.data.orders)
      } else {
        toast.error("Failed to fetch offline payment orders")
        setOrders([])
      }
    } catch (error) {
      console.error("Error fetching offline payments:", error)
      toast.error(error.response?.data?.message || "Failed to fetch orders")
      setOrders([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  // Handle accept order on behalf of restaurant
  const handleAcceptOrder = async (order) => {
    const orderIdToUse = order.id || order._id || order.orderId
    if (!orderIdToUse) return

    const confirmMessage = `Are you sure you want to accept order ${order.orderId}?\n\nPlease Ensure Payment has been verified before accepting.`
    if (!confirm(confirmMessage)) return

    try {
      const response = await adminAPI.acceptOrderOnBehalfOfRestaurant(orderIdToUse)
      if (response.data?.success) {
        toast.success(`Order ${order.orderId} accepted and payment verified successfully`)
        fetchOrders()
      } else {
        toast.error(response.data?.message || "Failed to accept order")
      }
    } catch (error) {
      toast.error("Failed to accept order")
    }
  }

  // Handle delete order
  const handleDeleteOrder = async (order) => {
    const orderIdToUse = order.id || order._id || order.orderId
    if (!orderIdToUse) return
    if (!confirm(`Are you sure you want to delete order ${order.orderId}?`)) return

    try {
      const response = await adminAPI.deleteOrder(orderIdToUse)
      if (response.data?.success) {
        toast.success(`Order ${order.orderId} deleted successfully`)
        setOrders(prev => prev.filter(o => o.id !== order.id && o.orderId !== order.orderId))
      }
    } catch (error) {
      toast.error("Failed to delete order")
    }
  }

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
    filteredOrders,
    count,
    activeFiltersCount,
    restaurants,
    handleApplyFilters,
    handleResetFilters,
    handleExport,
    handleViewOrder,
    handlePrintOrder,
    toggleColumn,
    resetColumns,
  } = useOrdersManagement(orders, statusKey, "Offline Payments")

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="mb-4">
        <p className="rounded-md bg-rose-50 px-3 py-2 text-[11px] text-rose-600 font-medium">
          For Offline Payments Please Verify If The Payments Are Safely Received To Your Account.
          Customer Is Not Liable If You Confirm And Deliver The Orders Without Checking Payment
          Transactions.
        </p>
      </div>
      <OrdersTopbar
        title="Offline Payments"
        count={count}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onFilterClick={() => setIsFilterOpen(true)}
        activeFiltersCount={activeFiltersCount}
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
      />
      <OrdersTable
        orders={filteredOrders}
        visibleColumns={visibleColumns}
        onViewOrder={handleViewOrder}
        onPrintOrder={handlePrintOrder}
        onAcceptOrder={handleAcceptOrder}
        onDeleteOrder={handleDeleteOrder}
      />
    </div>
  )
}

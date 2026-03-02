import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate, useParams } from "react-router-dom"
import Lenis from "lenis"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { restaurantAPI } from "@/lib/api"
import {
  ArrowLeft,
  Printer,
  Copy,
  User,
  MapPin,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react"

// Mock data removed - using API data only

export default function OrderDetails() {
  const navigate = useNavigate()
  const { orderId } = useParams()

  // State for order data
  const [orderData, setOrderData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Toast state
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  // Fetch order data from API
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await restaurantAPI.getOrderById(orderId)

        if (response.data?.success && response.data.data?.order) {
          const order = response.data.data.order

          // Transform API order data to match component structure
          const transformedOrder = {
            id: order.orderId || order._id,
            status: order.status?.toUpperCase() || 'PENDING',
            date: new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
            time: new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            restaurant: order.restaurantName || 'Restaurant',
            address: order.address?.street || order.address?.city || 'Address not available',
            customer: {
              name: order.userId?.name || 'Customer',
              orderCount: 1,
              location: `${order.address?.city || ''}, ${order.address?.state || ''}`.trim(),
              distance: 'N/A',
              deliveryAddressDetails: order.deliveryAddressDetails || '',
              note: order.note || '',
              sendCutlery: order.sendCutlery ?? true
            },
            items: order.items?.map(item => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              type: item.isVeg ? 'Veg' : 'Non-Veg',
              itemSizeQuantity: item.itemSizeQuantity,
              itemSizeUnit: item.itemSizeUnit,
              unit: item.unit,
              description: item.description,
              variation: item.variation
            })) || [],
            billing: {
              itemSubtotal: order.pricing?.subtotal || 0,
              taxes: order.pricing?.tax || 0,
              total: order.pricing?.total || 0,
              paymentStatus: (() => {
                const status = order.payment?.status || 'pending';
                // Map backend payment status to display format
                const statusMap = {
                  'completed': 'PAID',
                  'pending': 'PENDING',
                  'processing': 'PROCESSING',
                  'failed': 'FAILED',
                  'refunded': 'REFUNDED',
                  'cancelled': 'CANCELLED'
                };
                return statusMap[status.toLowerCase()] || 'PENDING';
              })(),
              paymentMethod: order.payment?.method || 'cash'
            },
            reason: order.cancellationReason || '',
            timeline: [
              { event: 'Order placed', timestamp: new Date(order.createdAt).toLocaleString('en-GB'), status: 'completed' },
              ...(order.status === 'confirmed' ? [{ event: 'Order confirmed', timestamp: order.tracking?.confirmed?.timestamp ? new Date(order.tracking.confirmed.timestamp).toLocaleString('en-GB') : '', status: 'completed' }] : []),
              ...(order.status === 'preparing' ? [{ event: 'Preparing', timestamp: order.tracking?.preparing?.timestamp ? new Date(order.tracking.preparing.timestamp).toLocaleString('en-GB') : '', status: 'completed' }] : []),
              ...(order.status === 'ready' ? [{ event: 'Ready for pickup', timestamp: order.tracking?.ready?.timestamp ? new Date(order.tracking.ready.timestamp).toLocaleString('en-GB') : '', status: 'completed' }] : []),
              ...(order.status === 'out_for_delivery' ? [{ event: 'Out for delivery', timestamp: order.tracking?.outForDelivery?.timestamp ? new Date(order.tracking.outForDelivery.timestamp).toLocaleString('en-GB') : '', status: 'completed' }] : []),
              ...(order.status === 'delivered' ? [{ event: 'Delivered', timestamp: order.tracking?.delivered?.timestamp ? new Date(order.tracking.delivered.timestamp).toLocaleString('en-GB') : '', status: 'completed' }] : []),
              ...(order.status === 'cancelled' ? [{ event: 'Cancelled', timestamp: order.cancelledAt ? new Date(order.cancelledAt).toLocaleString('en-GB') : '', status: 'rejected', reason: order.cancellationReason }] : [])
            ],
            settlement: response.data.data.settlement
          }

          setOrderData(transformedOrder)
        } else {
          throw new Error('Order not found')
        }
      } catch (err) {
        console.error('Error fetching order:', err)
        setError(err.response?.data?.message || err.message || 'Failed to fetch order')

        // No fallback - show error to user
      } finally {
        setLoading(false)
      }
    }

    if (orderId) {
      fetchOrder()
    }
  }, [orderId])

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  const handleCopyOrderId = () => {
    if (!orderData?.id) return
    navigator.clipboard.writeText(orderData.id)
    setToastMessage("Order ID copied to clipboard")
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
  }

  const handlePrintReceipt = async () => {
    try {
      setIsGeneratingPDF(true)
      setToastMessage("Generating receipt...")
      setShowToast(true)

      // Small delay to show the toast
      await new Promise(resolve => setTimeout(resolve, 300))

      // Check if orderData exists
      if (!orderData) {
        throw new Error("Order data not found")
      }

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      let yPosition = 20

      // Header - Restaurant Name
      doc.setFontSize(22)
      doc.setFont("helvetica", "bold")
      doc.text(orderData.restaurant, pageWidth / 2, yPosition, { align: "center" })
      yPosition += 10

      doc.setFontSize(12)
      doc.setFont("helvetica", "normal")
      doc.text(orderData.address, pageWidth / 2, yPosition, { align: "center" })
      yPosition += 20

      // Order Receipt Title
      doc.setFontSize(20)
      doc.setFont("helvetica", "bold")
      doc.text("ORDER RECEIPT", pageWidth / 2, yPosition, { align: "center" })
      yPosition += 12

      // Horizontal line
      doc.setLineWidth(0.5)
      doc.line(15, yPosition, pageWidth - 15, yPosition)
      yPosition += 10

      // Order Information
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text("Order ID:", 15, yPosition)
      doc.text(orderData.id, 60, yPosition)
      yPosition += 10

      doc.setFont("helvetica", "bold")
      doc.text("Date & Time:", 15, yPosition)
      doc.text(`${orderData.date}, ${orderData.time}`, 60, yPosition)
      yPosition += 10

      doc.setFont("helvetica", "bold")
      doc.text("Status:", 15, yPosition)
      doc.setFont("helvetica", "normal")
      // Set color based on status
      if (orderData.status === "REJECTED" || orderData.status === "CANCELLED") {
        doc.setTextColor(220, 38, 38) // Red
      } else if (orderData.status === "DELIVERED") {
        doc.setTextColor(22, 163, 74) // Green
      }
      doc.text(orderData.status, 50, yPosition)
      doc.setTextColor(0, 0, 0) // Reset to black
      yPosition += 10

      // Customer Details Section
      doc.setLineWidth(0.5)
      doc.line(15, yPosition, pageWidth - 15, yPosition)
      yPosition += 8

      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text("CUSTOMER DETAILS", 15, yPosition)
      yPosition += 8

      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.text("Name:", 15, yPosition)
      doc.setFont("helvetica", "normal")
      doc.text(orderData.customer.name, 50, yPosition)
      yPosition += 6

      doc.setFont("helvetica", "bold")
      doc.text("Location:", 15, yPosition)
      doc.setFont("helvetica", "normal")
      doc.text(orderData.customer.location, 50, yPosition)
      yPosition += 6

      doc.setFont("helvetica", "bold")
      doc.text("Distance:", 15, yPosition)
      doc.setFont("helvetica", "normal")
      doc.text(orderData.customer.distance, 50, yPosition)
      yPosition += 6

      if (orderData.customer.deliveryAddressDetails) {
        doc.setFont("helvetica", "bold")
        doc.text("Additional Address Details:", 15, yPosition)
        doc.setFont("helvetica", "normal")
        // Split long text into multiple lines if needed
        const addressLines = doc.splitTextToSize(orderData.customer.deliveryAddressDetails, pageWidth - 50)
        doc.text(addressLines, 15, yPosition + 6)
        yPosition += 6 + (addressLines.length * 6)
      }
      if (orderData.customer.note) {
        doc.setFont("helvetica", "bold")
        doc.setTextColor(220, 38, 38)
        doc.text("CUSTOMER NOTE:", 15, yPosition)
        doc.setFont("helvetica", "normal")
        const noteLines = doc.splitTextToSize(orderData.customer.note, pageWidth - 50)
        doc.text(noteLines, 50, yPosition)
        yPosition += (noteLines.length * 6) + 2
        doc.setTextColor(0, 0, 0)
      }

      doc.setFont("helvetica", "bold")
      doc.text("Cutlery:", 15, yPosition)
      doc.setFont("helvetica", "normal")
      doc.text(orderData.customer.sendCutlery ? "Send Cutlery" : "NO CUTLERY (Customer Preference)", 50, yPosition)
      yPosition += 8

      yPosition += 4

      // Items Section
      doc.setLineWidth(0.5)
      doc.line(15, yPosition, pageWidth - 15, yPosition)
      yPosition += 8

      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text("ITEM DETAILS", 15, yPosition)
      yPosition += 5

      // Items Table
      const itemsTableData = orderData.items.map(item => [
        `${item.quantity}x`,
        item.name,
        item.type || "-",
        `₹${item.price}`
      ])

      // Use autoTable with the doc instance
      autoTable(doc, {
        startY: yPosition,
        head: [["Qty", "Item Name", "Type", "Price"]],
        body: itemsTableData,
        theme: "grid",
        headStyles: {
          fillColor: [55, 65, 81],
          textColor: [255, 255, 255],
          fontSize: 12,
          fontStyle: "bold"
        },
        bodyStyles: {
          fontSize: 11
        },
        margin: { left: 15, right: 15 }
      })

      yPosition = doc.lastAutoTable.finalY + 10

      // Bill Details Section
      doc.setLineWidth(0.5)
      doc.line(15, yPosition, pageWidth - 15, yPosition)
      yPosition += 8

      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text("BILL DETAILS", 15, yPosition)
      yPosition += 8

      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.text("Item Subtotal:", 15, yPosition)
      doc.text(`Rs. ${orderData.billing.itemSubtotal}`, pageWidth - 15, yPosition, { align: "right" })
      yPosition += 6

      doc.text("Taxes:", 15, yPosition)
      doc.text(`Rs. ${orderData.billing.taxes}`, pageWidth - 15, yPosition, { align: "right" })
      yPosition += 6

      // Dashed line for total
      doc.setLineDash([2, 2])
      doc.line(15, yPosition, pageWidth - 15, yPosition)
      yPosition += 6
      doc.setLineDash([]) // Reset to solid line

      doc.setFont("helvetica", "bold")
      doc.setFontSize(14)
      doc.text("Total Bill:", 15, yPosition)
      doc.text(`Rs. ${orderData.billing.total}`, pageWidth - 15, yPosition, { align: "right" })
      yPosition += 10

      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.text(`Payment Status: ${orderData.billing.paymentStatus}`, 15, yPosition)
      yPosition += 10

      // Rejection/Cancellation Reason (if exists)
      if (orderData.reason) {
        doc.setLineWidth(0.5)
        doc.line(15, yPosition, pageWidth - 15, yPosition)
        yPosition += 8

        doc.setFontSize(11)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(220, 38, 38)
        doc.text("REASON:", 15, yPosition)
        yPosition += 6

        doc.setFontSize(9)
        doc.setFont("helvetica", "normal")
        const reasonLines = doc.splitTextToSize(orderData.reason, pageWidth - 30)
        doc.text(reasonLines, 15, yPosition)
        yPosition += (reasonLines.length * 5) + 5
        doc.setTextColor(0, 0, 0)
      }

      // Order Timeline
      if (yPosition + 40 > doc.internal.pageSize.getHeight()) {
        doc.addPage()
        yPosition = 20
      }

      doc.setLineWidth(0.5)
      doc.line(15, yPosition, pageWidth - 15, yPosition)
      yPosition += 8

      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text("ORDER TIMELINE", 15, yPosition)
      yPosition += 8

      orderData.timeline.forEach((event, index) => {
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")

        // Add status indicator
        if (event.status === "completed") {
          doc.setFillColor(22, 163, 74)
        } else if (event.status === "rejected") {
          doc.setFillColor(220, 38, 38)
        } else {
          doc.setFillColor(156, 163, 175)
        }
        doc.circle(18, yPosition - 1, 2, "F")

        doc.setTextColor(0, 0, 0)
        doc.text(event.event, 25, yPosition)
        yPosition += 5

        doc.setFontSize(8)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(100, 100, 100)
        doc.text(event.timestamp, 25, yPosition)
        yPosition += 8
        doc.setTextColor(0, 0, 0)
      })

      // Footer
      yPosition = doc.internal.pageSize.getHeight() - 20
      doc.setFontSize(8)
      doc.setFont("helvetica", "italic")
      doc.setTextColor(100, 100, 100)
      doc.text("Thank you for your business!", pageWidth / 2, yPosition, { align: "center" })
      yPosition += 5
      doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: "center" })

      // Save the PDF
      doc.save(`Order_Receipt_${orderData.id}.pdf`)

      // Show success message
      setToastMessage("Receipt downloaded successfully!")
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2000)
    } catch (error) {
      console.error("Error generating PDF:", error)
      console.error("Error details:", error.message, error.stack)
      setToastMessage(`Failed: ${error.message || "Unknown error"}`)
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    } finally {
      setIsGeneratingPDF(false)
    }

  }

  const getStatusColor = (status) => {
    switch (status) {
      case "REJECTED":
      case "CANCELLED":
        return "bg-red-700 text-white"
      case "DELIVERED":
        return "bg-green-600 text-white"
      default:
        return "bg-gray-600 text-white"
    }
  }

  const getPaymentStatusColor = (paymentStatus) => {
    switch (paymentStatus) {
      case "PAID":
      case "COMPLETED":
        return "bg-green-100 text-green-700 border border-green-200"
      case "PENDING":
        return "bg-yellow-100 text-yellow-700 border border-yellow-200"
      case "PROCESSING":
        return "bg-blue-100 text-blue-700 border border-blue-200"
      case "FAILED":
        return "bg-red-100 text-red-700 border border-red-200"
      case "REFUNDED":
        return "bg-purple-100 text-purple-700 border border-purple-200"
      case "CANCELLED":
        return "bg-gray-100 text-gray-700 border border-gray-200"
      default:
        return "bg-gray-100 text-gray-700 border border-gray-200"
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !orderData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/restaurant/orders')}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    )
  }

  // No order data
  if (!orderData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-600 mb-6">The order you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/restaurant/orders')}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white  px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-gray-900">Order details</h1>
            <p className="text-sm font-bold text-gray-600 truncate">
              ID: {orderData.id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintReceipt}
              disabled={isGeneratingPDF}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
              aria-label="Print"
            >
              {isGeneratingPDF ? (
                <svg className="animate-spin h-5 w-5 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <Printer className="w-5 h-5 text-gray-900" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-4 space-y-6">
        {/* Order Info Table */}
        <div className="overflow-hidden border-2 border-gray-200 rounded-xl mb-6 shadow-sm">
          <table className="w-full border-collapse bg-white text-left">
            <tbody>
              <tr className="border-b-2 border-gray-100">
                <td className="p-5 bg-gray-50/50 w-1/3 text-lg font-black text-gray-500 uppercase tracking-wider border-r-2 border-gray-100">Status</td>
                <td className="p-5">
                  <span className={`px-4 py-2 rounded-lg text-lg font-black shadow-sm inline-block ${getStatusColor(orderData.status)}`}>
                    {orderData.status}
                  </span>
                </td>
              </tr>
              <tr className="border-b-2 border-gray-100">
                <td className="p-5 bg-gray-50/50 text-lg font-black text-gray-500 uppercase tracking-wider border-r-2 border-gray-100">Order ID</td>
                <td className="p-5">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-black text-gray-900 drop-shadow-sm">{orderData.id}</span>
                    <button
                      onClick={handleCopyOrderId}
                      className="p-2 hover:bg-gray-100 rounded-xl transition-all border-2 border-gray-200 active:scale-95"
                      aria-label="Copy order ID"
                    >
                      <Copy className="w-6 h-6 text-gray-600" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr className="border-b-2 border-gray-100">
                <td className="p-5 bg-gray-50/50 text-lg font-black text-gray-500 uppercase tracking-wider border-r-2 border-gray-100">Date & Time</td>
                <td className="p-5 text-2xl font-bold text-gray-800">{orderData.date}, {orderData.time}</td>
              </tr>
              <tr>
                <td className="p-5 bg-gray-50/50 text-lg font-black text-gray-500 uppercase tracking-wider border-r-2 border-gray-100">Restaurant</td>
                <td className="p-5">
                  <p className="text-2xl font-black text-[#ff8100]">{orderData.restaurant}</p>
                  <p className="text-lg font-bold text-gray-500 mt-1">{orderData.address}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Customer Details Section */}
        <div>
          <h2 className="text-3xl font-black text-gray-900 mb-4 px-1">Customer details</h2>
          <div className="overflow-hidden border-2 border-gray-200 rounded-xl shadow-sm mb-3">
            <table className="w-full border-collapse bg-white text-left">
              <tbody>
                <tr className="border-b-2 border-gray-100">
                  <td className="p-5 bg-gray-50/50 w-1/3 text-lg font-black text-gray-500 uppercase tracking-wider border-r-2 border-gray-100">Customer Name</td>
                  <td className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                        <User className="w-6 h-6 text-[#ff8100]" />
                      </div>
                      <div>
                        <p className="text-3xl font-black text-gray-900">{orderData.customer.name}</p>
                        <p className="text-xs font-black text-orange-600 uppercase tracking-[0.2em] mt-1">Verified Customer</p>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr className="border-b-2 border-gray-100">
                  <td className="p-5 bg-gray-50/50 text-lg font-black text-gray-500 uppercase tracking-wider border-r-2 border-gray-100">Delivery Address</td>
                  <td className="p-5">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-8 h-8 text-red-600 shrink-0 mt-1" />
                      <div>
                        <p className="text-2xl font-black text-gray-900 leading-snug">{orderData.customer.location}</p>
                        {orderData.customer.distance && orderData.customer.distance !== 'N/A' && (
                          <p className="text-sm font-bold text-gray-500 mt-2 bg-gray-100 w-fit px-3 py-1 rounded-full">{orderData.customer.distance} away</p>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
                {orderData.customer.deliveryAddressDetails && (
                  <tr className="border-b-2 border-gray-100">
                    <td className="p-5 bg-gray-50/50 text-lg font-black text-gray-500 uppercase tracking-wider border-r-2 border-gray-100">Extra Address Info</td>
                    <td className="p-5 text-xl font-bold text-gray-800">{orderData.customer.deliveryAddressDetails}</td>
                  </tr>
                )}
                {orderData.customer.note && (
                  <tr className="border-b-2 border-gray-100">
                    <td className="p-5 bg-blue-100 text-lg font-black text-blue-800 uppercase tracking-wider border-r-2 border-blue-200">Customer Note</td>
                    <td className="p-5 bg-blue-50">
                      <p className="text-2xl font-black text-blue-900 italic leading-tight">
                        "{orderData.customer.note}"
                      </p>
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="p-5 bg-gray-50/50 text-lg font-black text-gray-500 uppercase tracking-wider border-r-2 border-gray-100">Cutlery Preference</td>
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${orderData.customer.sendCutlery ? 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]' : 'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.4)]'}`}></div>
                      <div>
                        <p className="text-xl font-black text-gray-900">
                          {orderData.customer.sendCutlery ? 'SEND CUTLERY' : 'NO CUTLERY'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Item Details Section */}
        <div className="mb-8">
          <h2 className="text-xl font-extrabold text-gray-900 mb-4 px-1">Item details</h2>

          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[350px]">
                <thead className="bg-gray-100 border-b-2 border-gray-200">
                  <tr>
                    <th className="py-5 px-6 text-lg font-black text-gray-800 uppercase tracking-wider w-24">Qty</th>
                    <th className="py-5 px-6 text-lg font-black text-gray-800 uppercase tracking-wider">Item Details</th>
                    <th className="py-5 px-6 text-lg font-black text-gray-800 uppercase tracking-wider text-right w-36">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-gray-100">
                  {orderData.items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50/80 transition-colors bg-white">
                      <td className="py-6 px-6 align-top w-24">
                        <span className="text-2xl font-black text-white bg-gray-900 px-4 py-2 rounded-lg shadow-sm inline-block whitespace-nowrap min-w-[3.5rem] text-center">
                          {item.quantity}
                        </span>
                      </td>
                      <td className="py-6 px-6 align-top">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center shrink-0 ${item.type === 'Non-Veg' ? 'border-red-600 bg-red-50' : 'border-green-600 bg-green-50'}`}>
                              <div className={`w-2.5 h-2.5 rounded-full ${item.type === 'Non-Veg' ? 'bg-red-600' : 'bg-green-600'}`}></div>
                            </div>
                            <span className="text-2xl font-extrabold text-gray-900 leading-tight">
                              {item.name}
                            </span>
                          </div>

                          {(() => {
                            const sizeUnit = item.itemSizeUnit || item.unit
                            const isPiece = sizeUnit && sizeUnit.trim().toLowerCase() === 'piece'
                            const displayParts = [item.itemSizeQuantity, !isPiece ? sizeUnit : null].filter(Boolean)
                            return displayParts.length > 0 ? (
                              <span className="text-xl font-bold text-[#ff8100] ml-8 block">
                                ({displayParts.join(' ')})
                              </span>
                            ) : null
                          })()}

                          {item.variation && (
                            <span className="text-lg font-bold text-gray-600 ml-8 block bg-gray-50 px-3 py-1 rounded w-fit">
                              {item.variation}
                            </span>
                          )}

                          {item.description && (
                            <div className="ml-8 mt-2 p-4 bg-orange-50/50 rounded-xl border border-orange-100 border-l-4 border-l-[#ff8100]">
                              <p className="text-lg text-gray-800 font-bold italic leading-relaxed">
                                <span className="text-[#ff8100] uppercase text-xs font-black block mb-1">Item Note:</span>
                                "{item.description}"
                              </p>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-6 px-6 align-top text-right w-36">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-2xl font-black text-gray-900">₹{(item.price * item.quantity).toFixed(2)}</span>
                          {item.quantity > 1 && (
                            <span className="text-sm font-bold text-gray-500">
                              (₹{item.price} &times; {item.quantity})
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Bill Details Section */}
        <div className="pb-10">
          <h2 className="text-3xl font-black text-gray-900 mb-4 px-1">Bill details</h2>

          <div className="overflow-hidden border-2 border-gray-200 rounded-xl shadow-sm bg-white">
            <table className="w-full border-collapse text-left">
              <tbody>
                <tr className="border-b-2 border-gray-100">
                  <td className="p-5 bg-gray-50/50 w-1/3 text-lg font-black text-gray-500 uppercase tracking-wider border-r-2 border-gray-100">Item Subtotal</td>
                  <td className="p-5 text-2xl font-black text-gray-900">₹{orderData.billing.itemSubtotal}</td>
                </tr>
                <tr className="border-b-2 border-gray-100">
                  <td className="p-5 bg-gray-50/50 text-lg font-black text-gray-500 uppercase tracking-wider border-r-2 border-gray-100">Taxes</td>
                  <td className="p-5 text-2xl font-black text-gray-900">₹{orderData.billing.taxes}</td>
                </tr>
                <tr className="border-b-4 border-dashed border-gray-200">
                  <td className="p-5 bg-gray-50/50 text-lg font-black text-gray-500 uppercase tracking-wider border-r-2 border-gray-100">Payment Mode</td>
                  <td className="p-5">
                    <span className="inline-block px-4 py-1.5 rounded-lg bg-green-100 text-green-800 text-base font-black uppercase tracking-wider border border-green-200">
                      {orderData.billing.paymentMethod}
                    </span>
                  </td>
                </tr>
                <tr className="bg-orange-50/30">
                  <td className="p-6 bg-orange-50 text-xl font-black text-orange-800 uppercase tracking-wider border-r-2 border-orange-100">TOTAL BILL</td>
                  <td className="p-6">
                    <span className="text-5xl font-black text-[#ff8100] drop-shadow-sm">₹{orderData.billing.total}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Restaurant Earning Section */}
        {orderData.settlement && (
          <div>
            <h2 className="text-3xl font-black text-gray-900 mb-4 px-1">Your Earnings</h2>
            <div className="bg-green-50 rounded-2xl p-6 border-2 border-green-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xl font-bold text-gray-700">Food Price (Subtotal - Discount)</span>
                <span className="text-2xl font-black text-gray-900">₹{orderData.settlement.restaurantEarning?.foodPrice || 0}</span>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-gray-700">Commission</span>
                  <span className="text-xs font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200 uppercase tracking-widest">-{orderData.settlement.restaurantEarning?.commissionPercentage || 0}%</span>
                </div>
                <span className="text-2xl font-black text-red-600">-₹{orderData.settlement.restaurantEarning?.commission || 0}</span>
              </div>
              <div className="border-t-4 border-dashed border-green-200 my-6"></div>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-green-800">Final Earning</span>
                <span className="text-5xl font-black text-green-900 drop-shadow-sm">₹{orderData.settlement.restaurantEarning?.netEarning || 0}</span>
              </div>
              <p className="text-xs text-green-600 mt-4 italic font-bold uppercase tracking-tight">* Amounts shown are calculated based on admin commission rules.</p>
            </div>
          </div>
        )}

        {/* Order Timeline Section */}
        <div>
          <h2 className="text-3xl font-black text-gray-900 mb-4 px-1">Order timeline</h2>

          <div className="bg-white border-2 border-gray-100 rounded-2xl p-8 shadow-sm">
            <div className="relative">
              {/* Timeline Line */}
              <div className="absolute left-5 top-0 bottom-0 w-1 bg-gray-200"></div>

              {/* Timeline Events */}
              <div className="space-y-8">
                {orderData.timeline.map((event, index) => (
                  <div key={index} className="relative flex items-center gap-6">
                    {/* Icon */}
                    <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-md ${event.status === "completed"
                      ? "bg-gray-900"
                      : event.status === "rejected"
                        ? "bg-red-600"
                        : "bg-gray-400"
                      }`}>
                      {event.status === "completed" ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : (
                        <XCircle className="w-5 h-5 text-white" />
                      )}
                    </div>

                    {/* Event Details */}
                    <div className="flex-1">
                      <p className="text-2xl font-black text-gray-900 leading-tight">{event.event}</p>
                      <p className="text-sm font-bold text-gray-500 mt-1 uppercase tracking-widest">{event.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Need Help Section */}
        <div className="pb-8">
          <button
            onClick={() => navigate('/restaurant/help-centre')}
            className="w-full py-4 bg-white rounded-lg text-sm text-gray-600 hover:text-gray-900 transition-colors underline text-center font-medium shadow-sm"
          >
            Need help with this order?
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 max-w-sm"
          >
            {isGeneratingPDF ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className="text-sm font-medium">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

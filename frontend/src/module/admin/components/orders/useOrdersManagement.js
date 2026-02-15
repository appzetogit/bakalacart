import { useState, useMemo } from "react"
import { exportToCSV, exportToExcel, exportToPDF, exportToJSON } from "./ordersExportUtils"

export function useOrdersManagement(orders, statusKey, title) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isViewOrderOpen, setIsViewOrderOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [filters, setFilters] = useState({
    paymentStatus: "",
    deliveryType: "",
    minAmount: "",
    maxAmount: "",
    fromDate: "",
    toDate: "",
    restaurant: "",
  })
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    orderId: true,
    orderDate: true,
    customer: true,
    restaurant: true,
    foodItems: true,
    totalAmount: true,
    paymentType: true,
    paymentCollectionStatus: true,
    orderStatus: true,
    actions: true,
  })

  // Get unique restaurants from orders
  const restaurants = useMemo(() => {
    return [...new Set(orders.map(o => o.restaurant))]
  }, [orders])

  // Apply search and filters
  const filteredOrders = useMemo(() => {
    let result = [...orders]

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(order =>
        order.orderId.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.restaurant.toLowerCase().includes(query) ||
        order.customerPhone.includes(query) ||
        order.totalAmount.toString().includes(query)
      )
    }

    // Apply filters
    if (filters.paymentStatus) {
      result = result.filter(order => order.paymentStatus === filters.paymentStatus)
    }

    if (filters.deliveryType) {
      result = result.filter(order => order.deliveryType === filters.deliveryType)
    }

    if (filters.minAmount) {
      result = result.filter(order => order.totalAmount >= parseFloat(filters.minAmount))
    }

    if (filters.maxAmount) {
      result = result.filter(order => order.totalAmount <= parseFloat(filters.maxAmount))
    }

    if (filters.restaurant) {
      result = result.filter(order => order.restaurant === filters.restaurant)
    }

    // Helper function to parse date format "16 JUL 2025"
    const parseOrderDate = (dateStr) => {
      const months = {
        "JAN": "01", "FEB": "02", "MAR": "03", "APR": "04", "MAY": "05", "JUN": "06",
        "JUL": "07", "AUG": "08", "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12"
      }
      const parts = dateStr.split(" ")
      if (parts.length === 3) {
        const day = parts[0].padStart(2, "0")
        const month = months[parts[1].toUpperCase()] || "01"
        const year = parts[2]
        return new Date(`${year}-${month}-${day}`)
      }
      return new Date(dateStr)
    }

    if (filters.fromDate) {
      result = result.filter(order => {
        const orderDate = parseOrderDate(order.date)
        const fromDate = new Date(filters.fromDate)
        return orderDate >= fromDate
      })
    }

    if (filters.toDate) {
      result = result.filter(order => {
        const orderDate = parseOrderDate(order.date)
        const toDate = new Date(filters.toDate)
        toDate.setHours(23, 59, 59, 999) // Include entire day
        return orderDate <= toDate
      })
    }

    return result
  }, [orders, searchQuery, filters])

  const count = filteredOrders.length

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter(value => value !== "").length
  }, [filters])

  const handleApplyFilters = () => {
    setIsFilterOpen(false)
  }

  const handleResetFilters = () => {
    setFilters({
      paymentStatus: "",
      deliveryType: "",
      minAmount: "",
      maxAmount: "",
      fromDate: "",
      toDate: "",
      restaurant: "",
    })
  }

  const handleExport = (format) => {
    const filename = title.toLowerCase().replace(/\s+/g, "_")
    switch (format) {
      case "csv":
        exportToCSV(filteredOrders, filename)
        break
      case "excel":
        exportToExcel(filteredOrders, filename)
        break
      case "pdf":
        exportToPDF(filteredOrders, filename)
        break
      case "json":
        exportToJSON(filteredOrders, filename)
        break
      default:
        break
    }
  }

  const handleViewOrder = (order) => {
    setSelectedOrder(order)
    setIsViewOrderOpen(true)
  }

  const handlePrintOrder = async (order) => {
    try {
      // Dynamic import of jsPDF and autoTable for instant PDF download
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Add Header Background
      doc.setFillColor(59, 130, 246)
      doc.rect(0, 0, 210, 40, 'F')

      // Add title
      doc.setFontSize(22)
      doc.setTextColor(255, 255, 255)
      doc.setFont(undefined, 'bold')
      doc.text('INVOICE', 105, 18, { align: 'center' })

      // Order ID in header
      doc.setFontSize(10)
      doc.setTextColor(255, 255, 255)
      doc.setFont(undefined, 'normal')
      const orderId = order.orderId || order.id || 'N/A'
      doc.text(`Order ID: ${orderId}`, 105, 25, { align: 'center' })

      // Date in header
      const orderDate = order.date && order.time ? `${order.date}, ${order.time}` : (order.date || new Date().toLocaleDateString())
      doc.text(`Date: ${orderDate}`, 105, 30, { align: 'center' })

      let startY = 50

      // Create two columns for Customer and Restaurant Info
      doc.setFontSize(12)
      doc.setTextColor(30, 30, 30)
      doc.setFont(undefined, 'bold')
      doc.text('Bill To:', 14, startY)
      doc.text('Restaurant Info:', 110, startY)

      startY += 7
      doc.setFontSize(10)
      doc.setFont(undefined, 'normal')
      doc.setTextColor(60, 60, 60)

      // Customer details (Left Column)
      let customerY = startY
      if (order.customerName) {
        doc.text(`Name: ${order.customerName}`, 14, customerY)
        customerY += 5
      }
      if (order.customerPhone) {
        doc.text(`Phone: ${order.customerPhone}`, 14, customerY)
        customerY += 5
      }
      if (order.customerEmail) {
        doc.text(`Email: ${order.customerEmail}`, 14, customerY)
        customerY += 5
      }

      // Restaurant details (Right Column)
      let restaurantY = startY
      if (order.restaurant) {
        doc.text(order.restaurant, 110, restaurantY)
        restaurantY += 5
      }

      // Shipping Address (Full Width below)
      startY = Math.max(customerY, restaurantY) + 5
      if (order.address) {
        doc.setFontSize(12)
        doc.setTextColor(30, 30, 30)
        doc.setFont(undefined, 'bold')
        doc.text('Shipping Address:', 14, startY)
        startY += 7

        doc.setFontSize(10)
        doc.setFont(undefined, 'normal')
        doc.setTextColor(60, 60, 60)

        const formatAddress = (address) => {
          if (!address) return ""
          const parts = []
          if (address.street) parts.push(address.street)
          if (address.area) parts.push(address.area)
          if (address.city) parts.push(address.city)
          if (address.state) parts.push(address.state)
          if (address.pincode || address.zipCode) parts.push(address.pincode || address.zipCode)
          return parts.join(", ")
        }

        const mainAddress = order.address.formattedAddress || formatAddress(order.address)
        const splitAddress = doc.splitTextToSize(mainAddress, 180)
        doc.text(splitAddress, 14, startY)
        startY += (splitAddress.length * 5)

        if (order.deliveryAddressDetails) {
          doc.setFont(undefined, 'italic')
          doc.text(`Note: ${order.deliveryAddressDetails}`, 14, startY)
          startY += 6
          doc.setFont(undefined, 'normal')
        }
      }

      startY += 5

      // Payment & Delivery Type Highlighting
      doc.setFillColor(245, 247, 250)
      doc.rect(14, startY, 182, 10, 'F')
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      const paymentMethod = order.paymentType || 'N/A'
      const deliveryType = order.deliveryType || 'N/A'
      doc.text(`Payment: ${paymentMethod} | Status: ${order.paymentStatus || 'Pending'} | Delivery: ${deliveryType}`, 16, startY + 6)

      startY += 15

      // Order Items Table
      if (order.items && Array.isArray(order.items) && order.items.length > 0) {
        const tableData = order.items.map((item) => [
          item.quantity || 1,
          item.name || 'Unknown Item',
          `Rs. ${(item.price || 0).toFixed(2)}`,
          `Rs. ${((item.quantity || 1) * (item.price || 0)).toFixed(2)}`
        ])

        autoTable(doc, {
          startY: startY,
          head: [['Qty', 'Item Name', 'Price', 'Total']],
          body: tableData,
          theme: 'grid',
          headStyles: {
            fillColor: [59, 130, 246],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 10,
            halign: 'center'
          },
          bodyStyles: {
            fontSize: 9,
            textColor: [30, 30, 30]
          },
          columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: 100 },
            2: { cellWidth: 35, halign: 'right' },
            3: { cellWidth: 32, halign: 'right' }
          },
          margin: { left: 14, right: 14 }
        })

        startY = doc.lastAutoTable.finalY + 10
      }

      // Pricing Breakdown (Subtotal, Discounts, Fees, Total)
      const pageWidth = doc.internal.pageSize.getWidth()
      const contentWidth = pageWidth - 28 // 14 margin on each side
      const rightAlignPos = pageWidth - 14
      const labelPos = pageWidth - 60

      doc.setFontSize(10)
      doc.setTextColor(60, 60, 60)

      // Subtotal
      if (order.totalItemAmount !== undefined) {
        doc.text('Subtotal:', labelPos, startY)
        doc.text(`Rs. ${order.totalItemAmount.toFixed(2)}`, rightAlignPos, startY, { align: 'right' })
        startY += 6
      }

      // Discounts
      const totalDiscount = (order.itemDiscount || 0) + (order.couponDiscount || 0) + (order.referralDiscount || 0)
      if (totalDiscount > 0) {
        doc.setTextColor(16, 185, 129) // Emerald-600
        doc.text('Total Discount:', labelPos, startY)
        doc.text(`-Rs. ${totalDiscount.toFixed(2)}`, rightAlignPos, startY, { align: 'right' })
        startY += 6
        doc.setTextColor(60, 60, 60)
      }

      // Delivery Charge
      if (order.deliveryCharge !== undefined) {
        doc.text('Delivery Charge:', labelPos, startY)
        const deliveryText = order.deliveryCharge > 0 ? `Rs. ${order.deliveryCharge.toFixed(2)}` : 'FREE'
        doc.text(deliveryText, rightAlignPos, startY, { align: 'right' })
        startY += 6
      }

      // Platform Fee
      if (order.platformFee !== undefined && order.platformFee > 0) {
        doc.text('Platform Fee:', labelPos, startY)
        doc.text(`Rs. ${order.platformFee.toFixed(2)}`, rightAlignPos, startY, { align: 'right' })
        startY += 6
      }

      // GST/Tax
      if (order.vatTax !== undefined && order.vatTax > 0) {
        doc.text('Tax (GST):', labelPos, startY)
        doc.text(`Rs. ${order.vatTax.toFixed(2)}`, rightAlignPos, startY, { align: 'right' })
        startY += 6
      }

      // Total Amount
      startY += 2
      doc.setDrawColor(200, 200, 200)
      doc.line(labelPos, startY - 4, rightAlignPos, startY - 4)

      doc.setFontSize(14)
      doc.setTextColor(30, 30, 30)
      doc.setFont(undefined, 'bold')
      const finalTotal = typeof order.totalAmount === 'number' ? order.totalAmount.toFixed(2) : order.totalAmount
      doc.text('Grand Total:', labelPos, startY + 4)
      doc.text(`Rs. ${finalTotal}`, rightAlignPos, startY + 4, { align: 'right' })

      // Footer
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.setFont(undefined, 'normal')
      doc.text('Thank you for choosing Bakalaa Cart!', 105, 280, { align: 'center' })
      doc.text('This is a computer-generated invoice and does not require a signature.', 105, 284, { align: 'center' })

      // Save the PDF instantly
      const cleanOrderId = orderId.toString().replace(/[^a-zA-Z0-9]/g, '_')
      const filename = `Invoice_${cleanOrderId}.pdf`
      doc.save(filename)
    } catch (error) {
      console.error("Error generating PDF invoice:", error)
      alert("Failed to download PDF invoice. Please ensure you have an active internet connection to load PDF libraries.")
    }
  }

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      orderId: true,
      orderDate: true,
      customer: true,
      restaurant: true,
      foodItems: true,
      totalAmount: true,
      paymentType: true,
      paymentCollectionStatus: true,
      orderStatus: true,
      actions: true,
    })
  }

  return {
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
  }
}


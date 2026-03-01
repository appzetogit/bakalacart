import { useEffect, useState, useRef, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Activity, ArrowUpRight, ShoppingBag, CreditCard, Truck, Receipt, DollarSign, Store, UserCheck, Package, UserCircle, Clock, CheckCircle, Plus, Calendar } from "lucide-react"
import { adminAPI } from "@/lib/api"
import { DateRangeCalendar } from "@/components/ui/date-range-calendar"

export default function AdminHome() {
  const navigate = useNavigate()
  const [selectedPeriod, setSelectedPeriod] = useState("overall")
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState(null)
  const calendarRef = useRef(null)

  // Format date range display
  const dateRangeDisplay = useMemo(() => {
    if (!startDate || !endDate) return "Date to date"
    const formatDate = (date) => {
      const day = date.getDate()
      const month = date.toLocaleString('en-US', { month: 'short' })
      return `${day} ${month}`
    }
    return `${formatDate(startDate)} - ${formatDate(endDate)}`
  }, [startDate, endDate])

  // Handle date range change from calendar
  const handleDateRangeChange = (start, end) => {
    setStartDate(start)
    setEndDate(end)
    if (start && end) {
      setSelectedPeriod("custom")
      setShowCalendar(false)
    }
  }

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowCalendar(false)
      }
    }

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCalendar])

  // Reset date range when period changes (unless custom)
  useEffect(() => {
    if (selectedPeriod !== "custom") {
      setStartDate(null)
      setEndDate(null)
    }
  }, [selectedPeriod])

  // Fetch dashboard stats
  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setIsLoading(true)
        const params = { period: selectedPeriod }

        if (selectedPeriod === "custom" && startDate && endDate) {
          // Format dates as YYYY-MM-DD
          params.startDate = startDate.toISOString().split('T')[0]
          params.endDate = endDate.toISOString().split('T')[0]
        }

        const response = await adminAPI.getDashboardStats(params)
        if (response.data?.success && response.data?.data) {
          setDashboardData(response.data.data)
          console.log('✅ Dashboard stats fetched:', response.data.data)
          console.log('💰 Commission:', response.data.data.commission)
          console.log('💳 Platform Fee:', response.data.data.platformFee)
          console.log('🚚 Delivery Fee:', response.data.data.deliveryFee)
          console.log('🧾 GST:', response.data.data.gst)
          console.log('💵 Total Admin Earnings:', response.data.data.totalAdminEarnings)
        } else {
          console.error('❌ Invalid response format:', response.data)
        }
      } catch (error) {
        console.error('❌ Error fetching dashboard stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardStats()
  }, [selectedPeriod, startDate, endDate])

  // Get order stats from real data — all statuses
  const getOrderStats = () => {
    const s = dashboardData?.orderStats || {}
    return [
      { label: "Delivered", value: s.delivered || 0, color: "#10b981" },
      { label: "Cancelled", value: s.cancelled || 0, color: "#ef4444" },
      { label: "Pending", value: s.pending || 0, color: "#f59e0b" },
      { label: "Confirmed", value: s.confirmed || 0, color: "#0ea5e9" },
      { label: "Preparing", value: s.preparing || 0, color: "#a855f7" },
      { label: "Out for Delivery", value: s.out_for_delivery || 0, color: "#f97316" },
    ]
  }

  // Get monthly data from real data
  const getMonthlyData = () => {
    if (!dashboardData?.monthlyData || dashboardData.monthlyData.length === 0) {
      // Return empty data structure if no data
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return monthNames.map(month => ({ month, commission: 0, revenue: 0, orders: 0 }))
    }

    // Use real monthly data from backend
    return dashboardData.monthlyData.map(item => ({
      month: item.month,
      commission: item.commission || 0,
      revenue: item.revenue || 0,
      orders: item.orders || 0
    }))
  }

  const orderStats = getOrderStats()
  const monthlyData = getMonthlyData()

  // Calculate totals from real data
  const revenueTotal = dashboardData?.revenue?.total || 0
  const commissionTotal = dashboardData?.commission?.total || 0
  const platformFeeTotal = dashboardData?.platformFee?.total || 0
  const deliveryFeeTotal = dashboardData?.deliveryFee?.total || 0
  const gstTotal = dashboardData?.gst?.total || 0
  const totalAdminEarnings = commissionTotal + platformFeeTotal + deliveryFeeTotal + gstTotal

  // Additional stats
  const totalRestaurants = dashboardData?.restaurants?.total || 0
  const pendingRestaurantRequests = dashboardData?.restaurants?.pendingRequests || 0
  const totalDeliveryBoys = dashboardData?.deliveryBoys?.total || 0
  const pendingDeliveryBoyRequests = dashboardData?.deliveryBoys?.pendingRequests || 0
  const totalFoods = dashboardData?.foods?.total || 0
  const totalAddons = dashboardData?.addons?.total || 0
  const totalCustomers = dashboardData?.customers?.total || 0

  // Enhanced order counts from new backend fields
  const todayOrdersCount = dashboardData?.todayOrders || 0
  const totalAllOrders = dashboardData?.totalAllOrders || 0
  const pendingOrders = dashboardData?.orderStats?.pending || 0
  const activeOrders = dashboardData?.orderStats?.active || 0
  const completedOrders = dashboardData?.orderStats?.delivered || 0
  const cancelledOrders = dashboardData?.orderStats?.cancelled || 0

  // Top riders for live signals
  const topRiders = dashboardData?.topRiders || []
  const recentOrderActivity = dashboardData?.recentActivity?.orders || 0

  const pieData = orderStats.map((item) => ({
    name: item.label,
    value: item.value,
    fill: item.color,
  }))

  const activityFeed = [
    ...topRiders.map(r => ({
      title: `🏍️ ${r.name || 'Rider'}`,
      detail: `${r.count} deliveries this month`,
      time: 'This month',
      type: 'rider'
    })),
    ...(recentOrderActivity > 0 ? [{
      title: `📦 ${recentOrderActivity} new orders`,
      detail: 'Placed in the last 24 hours',
      time: 'Last 24h',
      type: 'order'
    }] : []),
    ...(todayOrdersCount > 0 ? [{
      title: `🔥 Today: ${todayOrdersCount} orders`,
      detail: 'Total orders placed today',
      time: 'Today',
      type: 'today'
    }] : [])
  ]

  return (
    <div className="px-4 pb-10 lg:px-6 pt-4">
      <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_30px_120px_-60px_rgba(0,0,0,0.28)]">
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-full bg-white px-4 py-2 text-sm text-neutral-700 ring-1 ring-neutral-200">
              <span className="h-3 w-3 animate-ping rounded-full bg-neutral-800/70" />
              Updating metrics...
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 border-b border-neutral-200 bg-linear-to-br from-white via-neutral-50 to-neutral-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Admin Analytics & Overview</p>
              <h1 className="text-2xl font-semibold text-neutral-900">Dashboard & Analytics</h1>
            </div>

          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={selectedPeriod} onValueChange={(value) => {
              setSelectedPeriod(value)
              if (value === "custom") {
                setShowCalendar(true)
              }
            }}>
              <SelectTrigger className="min-w-[140px] border-neutral-300 bg-white text-neutral-900">
                <SelectValue placeholder="Overall" />
              </SelectTrigger>
              <SelectContent className="border-neutral-200 bg-white text-neutral-900">
                <SelectItem value="overall">Overall</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="year">This year</SelectItem>
                <SelectItem value="custom">Date to date</SelectItem>
              </SelectContent>
            </Select>
            {selectedPeriod === "custom" && (
              <div className="relative" ref={calendarRef}>
                <button
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="flex items-center gap-2 min-w-[180px] px-3 py-2 border border-neutral-300 rounded-md bg-white text-neutral-900 hover:bg-neutral-50 transition-colors"
                >
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">{dateRangeDisplay}</span>
                </button>
                {showCalendar && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowCalendar(false)}
                    />
                    <div className="absolute top-full right-0 mt-2 z-50 shadow-lg">
                      <DateRangeCalendar
                        startDate={startDate}
                        endDate={endDate}
                        onDateRangeChange={handleDateRangeChange}
                        onClose={() => setShowCalendar(false)}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          {/* Today's Quick Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
            <div className="flex flex-col items-center py-2">
              <span className="text-2xl font-bold text-blue-700">{todayOrdersCount}</span>
              <span className="text-xs text-blue-500 font-medium mt-0.5">Today's Orders</span>
            </div>
            <div className="flex flex-col items-center py-2 border-l border-blue-200">
              <span className="text-2xl font-bold text-amber-600">{pendingOrders}</span>
              <span className="text-xs text-amber-500 font-medium mt-0.5">Pending Now</span>
            </div>
            <div className="flex flex-col items-center py-2 border-l border-blue-200">
              <span className="text-2xl font-bold text-orange-600">{activeOrders}</span>
              <span className="text-xs text-orange-500 font-medium mt-0.5">Active / In Progress</span>
            </div>
            <div className="flex flex-col items-center py-2 border-l border-blue-200">
              <span className="text-2xl font-bold text-emerald-700">{completedOrders}</span>
              <span className="text-xs text-emerald-500 font-medium mt-0.5">Delivered (Period)</span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Gross revenue"
              value={`₹${revenueTotal.toLocaleString("en-IN")}`}
              helper="Rolling 12 months"
              icon={<ShoppingBag className="h-5 w-5 text-emerald-600" />}
              accent="bg-emerald-200/40"
              onClick={() => navigate('/admin/transaction-report')}
            />
            <MetricCard
              title="Commission earned"
              value={`₹${commissionTotal.toLocaleString("en-IN")}`}
              helper="Restaurant commission"
              icon={<ArrowUpRight className="h-5 w-5 text-indigo-600" />}
              accent="bg-indigo-200/40"
              onClick={() => navigate('/admin/restaurants/commission')}
            />
            <MetricCard
              title="Orders processed"
              value={totalAllOrders.toLocaleString("en-IN")}
              helper="All orders (all statuses)"
              icon={<Activity className="h-5 w-5 text-amber-600" />}
              accent="bg-amber-200/40"
              onClick={() => navigate('/admin/orders/all')}
            />
            <MetricCard
              title="Platform fee"
              value={`₹${platformFeeTotal.toLocaleString("en-IN")}`}
              helper="Total platform fees"
              icon={<CreditCard className="h-5 w-5 text-purple-600" />}
              accent="bg-purple-200/40"
              onClick={() => navigate('/admin/transaction-report')}
            />
            <MetricCard
              title="Delivery fee"
              value={`₹${deliveryFeeTotal.toLocaleString("en-IN")}`}
              helper="Total delivery fees"
              icon={<Truck className="h-5 w-5 text-blue-600" />}
              accent="bg-blue-200/40"
              onClick={() => navigate('/admin/delivery-partners/earnings')}
            />
            <MetricCard
              title="GST"
              value={`₹${gstTotal.toLocaleString("en-IN")}`}
              helper="Total GST collected"
              icon={<Receipt className="h-5 w-5 text-orange-600" />}
              accent="bg-orange-200/40"
              onClick={() => navigate('/admin/transaction-report')}
            />
            <MetricCard
              title="Total revenue"
              value={`₹${totalAdminEarnings.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              helper={`Comm ₹${commissionTotal.toFixed(0)} + Plat ₹${platformFeeTotal.toFixed(0)} + Del ₹${deliveryFeeTotal.toFixed(0)} + GST ₹${gstTotal.toFixed(0)}`}
              icon={<DollarSign className="h-5 w-5 text-green-600" />}
              accent="bg-green-200/40"
              onClick={() => navigate('/admin/transaction-report')}
            />
            <MetricCard
              title="Total restaurants"
              value={totalRestaurants.toLocaleString("en-IN")}
              helper="All registered restaurants"
              icon={<Store className="h-5 w-5 text-blue-600" />}
              accent="bg-blue-200/40"
              onClick={() => navigate('/admin/restaurants')}
            />
            <MetricCard
              title="Restaurant request pending"
              value={pendingRestaurantRequests.toLocaleString("en-IN")}
              helper="Awaiting approval"
              icon={<UserCheck className="h-5 w-5 text-orange-600" />}
              accent="bg-orange-200/40"
              onClick={() => navigate('/admin/restaurants/joining-request')}
            />
            <MetricCard
              title="Total delivery boys"
              value={totalDeliveryBoys.toLocaleString("en-IN")}
              helper="Approved delivery partners"
              icon={<Truck className="h-5 w-5 text-indigo-600" />}
              accent="bg-indigo-200/40"
              onClick={() => navigate('/admin/delivery-partners')}
            />
            <MetricCard
              title="Delivery boy request pending"
              value={pendingDeliveryBoyRequests.toLocaleString("en-IN")}
              helper="Awaiting verification"
              icon={<Clock className="h-5 w-5 text-yellow-600" />}
              accent="bg-yellow-200/40"
              onClick={() => navigate('/admin/delivery-partners/join-request')}
            />
            <MetricCard
              title="Total foods"
              value={totalFoods.toLocaleString("en-IN")}
              helper="Active menu items"
              icon={<Package className="h-5 w-5 text-purple-600" />}
              accent="bg-purple-200/40"
              onClick={() => navigate('/admin/foods')}
            />
            <MetricCard
              title="Total addons"
              value={totalAddons.toLocaleString("en-IN")}
              helper="Active addon items"
              icon={<Plus className="h-5 w-5 text-pink-600" />}
              accent="bg-pink-200/40"
              onClick={() => navigate('/admin/addons')}
            />
            <MetricCard
              title="Total customers"
              value={totalCustomers.toLocaleString("en-IN")}
              helper="Registered users"
              icon={<UserCircle className="h-5 w-5 text-cyan-600" />}
              accent="bg-cyan-200/40"
              onClick={() => navigate('/admin/customers')}
            />
            <MetricCard
              title="Pending orders"
              value={pendingOrders.toLocaleString("en-IN")}
              helper="Orders awaiting processing"
              icon={<Clock className="h-5 w-5 text-red-600" />}
              accent="bg-red-200/40"
              onClick={() => navigate('/admin/orders/pending')}
            />
            <MetricCard
              title="Completed orders"
              value={completedOrders.toLocaleString("en-IN")}
              helper="Successfully delivered"
              icon={<CheckCircle className="h-5 w-5 text-emerald-600" />}
              accent="bg-emerald-200/40"
              onClick={() => navigate('/admin/orders/delivered')}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-neutral-200 bg-white">
              <CardHeader className="flex flex-col gap-2 border-b border-neutral-200 pb-4">
                <CardTitle className="text-lg text-neutral-900">Revenue trajectory</CardTitle>
                <p className="text-sm text-neutral-500">
                  Commission and gross revenue with monthly order volume
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyData}>
                      <defs>
                        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="comFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" stroke="#6b7280" />
                      <YAxis yAxisId="left" stroke="#6b7280" />
                      <YAxis yAxisId="right" orientation="right" stroke="#ef4444" />
                      <Tooltip
                        contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12 }}
                        labelStyle={{ color: "#111827" }}
                        itemStyle={{ color: "#111827" }}
                      />
                      <Legend />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="revenue"
                        stroke="#0ea5e9"
                        fillOpacity={1}
                        fill="url(#revFill)"
                        name="Gross revenue"
                      />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="commission"
                        stroke="#a855f7"
                        fillOpacity={1}
                        fill="url(#comFill)"
                        name="Commission"
                      />
                      <Bar
                        yAxisId="right"
                        dataKey="orders"
                        fill="#ef4444"
                        radius={[6, 6, 0, 0]}
                        name="Orders"
                        barSize={10}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-neutral-200 bg-white">
              <CardHeader className="flex items-center justify-between border-b border-neutral-200 pb-4">
                <div>
                  <CardTitle className="text-lg text-neutral-900">Order mix</CardTitle>
                  <p className="text-sm text-neutral-500">Distribution by state</p>
                </div>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">
                  {orderStats.reduce((s, o) => s + o.value, 0)} orders
                </span>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12 }}
                        labelStyle={{ color: "#111827" }}
                        itemStyle={{ color: "#111827" }}
                      />
                      <Legend
                        formatter={(value) => <span style={{ color: "#111827", fontSize: 12 }}>{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {orderStats.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                        <p className="text-sm text-neutral-800">{item.label}</p>
                      </div>
                      <p className="text-sm font-semibold text-neutral-900">{item.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-neutral-200 bg-white">
              <CardHeader className="flex items-center justify-between border-b border-neutral-200 pb-4">
                <CardTitle className="text-lg text-neutral-900">Momentum snapshot</CardTitle>
                <span className="text-xs text-neutral-500">
                  {monthlyData.some(d => d.orders > 0) ? `Last ${monthlyData.slice(-6).length} periods` : 'No order data yet'}
                </span>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData.slice(-6)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" stroke="#6b7280" />
                      <YAxis yAxisId="left" stroke="#6b7280" />
                      <YAxis yAxisId="right" orientation="right" stroke="#0ea5e9" />
                      <Tooltip
                        contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12 }}
                        labelStyle={{ color: "#111827" }}
                        itemStyle={{ color: "#111827" }}
                      />
                      <Legend />
                      <Bar yAxisId="right" dataKey="orders" fill="#0ea5e9" radius={[8, 8, 0, 0]} name="Orders" />
                      <Bar yAxisId="left" dataKey="commission" fill="#a855f7" radius={[8, 8, 0, 0]} name="Commission" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-neutral-200 bg-white">
              <CardHeader className="border-b border-neutral-200 pb-4">
                <CardTitle className="text-lg text-neutral-900">Live signals</CardTitle>
                <p className="text-sm text-neutral-500">Ops notes and service health</p>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {activityFeed.length > 0 ? (
                  activityFeed.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                        <p className="text-xs text-neutral-600">{item.detail}</p>
                      </div>
                      <span className="text-xs text-neutral-500 shrink-0 ml-2">{item.time}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-neutral-400">
                    <p className="text-sm">No activity data available</p>
                    <p className="text-xs mt-1">Orders and rider data will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-neutral-200 bg-white">
              <CardHeader className="border-b border-neutral-200 pb-4">
                <CardTitle className="text-lg text-neutral-900">Order states</CardTitle>
                <p className="text-sm text-neutral-500">Quick glance by status</p>
              </CardHeader>
              <CardContent className="grid gap-3 pt-4">
                {orderStats.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold text-neutral-900"
                        style={{ background: `${item.color}1A`, color: item.color }}
                      >
                        {item.label.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <p className="text-sm text-neutral-900">{item.label}</p>
                        <p className="text-xs text-neutral-500">Tracked in {selectedPeriod}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-neutral-900">{item.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ title, value, helper, icon, accent, onClick }) {
  return (
    <Card
      className={`overflow-hidden border-neutral-200 bg-white p-0 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <CardContent className="relative flex flex-col gap-2 px-4 pb-4 pt-4">
        <div className={`absolute inset-0 ${accent} `} />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">{title}</p>
            <p className="text-2xl font-semibold text-neutral-900">{value}</p>
            <p className="text-xs text-neutral-500">{helper}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 ring-1 ring-neutral-200">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

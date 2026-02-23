import { useState, useMemo, useEffect } from "react"
import { Search, Download, ChevronDown, Filter, Briefcase, RefreshCw, Settings, ArrowUpDown, FileText, FileSpreadsheet, Code, Loader2, Calendar, IndianRupee, CheckCircle2, Wallet } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { exportReportsToCSV, exportReportsToExcel, exportReportsToPDF, exportReportsToJSON } from "../../components/reports/reportsExportUtils"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"
import { format } from "date-fns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default function RestaurantFinanceReport() {
    const [selectedRestaurant, setSelectedRestaurant] = useState("all")
    const [startDate, setStartDate] = useState(format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [loading, setLoading] = useState(false)
    const [settlements, setSettlements] = useState([])
    const [totals, setTotals] = useState({
        totalOrders: 0,
        totalEarnings: 0,
        totalCommission: 0
    })
    const [allRestaurants, setAllRestaurants] = useState([])
    const [isProcessing, setIsProcessing] = useState(false)

    // Fetch all restaurants for dropdown dynamically
    useEffect(() => {
        const fetchAllRestaurants = async () => {
            try {
                const response = await adminAPI.getRestaurants({ limit: 1000 })
                if (response?.data?.success && response.data.data?.restaurants) {
                    setAllRestaurants(response.data.data.restaurants)
                } else if (response?.data?.success && Array.isArray(response.data.data)) {
                    // Fallback if structure is different
                    setAllRestaurants(response.data.data)
                }
            } catch (error) {
                console.error("Error fetching restaurants:", error)
            }
        }
        fetchAllRestaurants()
    }, [])

    const fetchFinanceReport = async () => {
        try {
            setLoading(true)
            const params = {
                restaurantId: selectedRestaurant !== "all" ? selectedRestaurant : undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            }

            const response = await adminAPI.getRestaurantSettlements(params)

            if (response?.data?.success) {
                setSettlements(response.data.data.settlements || [])
                setTotals(response.data.data.totals || {
                    totalOrders: 0,
                    totalEarnings: 0,
                    totalCommission: 0
                })
            } else {
                setSettlements([])
                setTotals({ totalOrders: 0, totalEarnings: 0, totalCommission: 0 })
                if (response?.data?.message) {
                    toast.error(response.data.message)
                }
            }
        } catch (error) {
            console.error("Error fetching finance report:", error)
            toast.error("Failed to fetch finance report")
            setSettlements([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchFinanceReport()
    }, [])

    const handleApplyFilters = () => {
        fetchFinanceReport()
    }

    const handleMarkAsPaid = async () => {
        if (settlements.length === 0) {
            toast.error("No pending settlements to mark as paid")
            return
        }

        if (!window.confirm(`Are you sure you want to mark ${settlements.length} orders as paid? This will credit the amounts to the restaurant and reset the pending amount to zero.`)) {
            return
        }

        try {
            setIsProcessing(true)
            const settlementIds = settlements.map(s => s._id)
            const response = await adminAPI.markSettlementsProcessed(settlementIds)

            if (response?.data?.success) {
                toast.success(`Successfully marked ${settlementIds.length} settlements as paid`)
                fetchFinanceReport()
            } else {
                toast.error(response?.data?.message || "Failed to mark settlements as paid")
            }
        } catch (error) {
            console.error("Error marking settlements as paid:", error)
            toast.error("An error occurred while processing payment")
        } finally {
            setIsProcessing(false)
        }
    }

    const handleExport = (formatType) => {
        if (settlements.length === 0) {
            toast.error("No data to export")
            return
        }

        const headers = [
            { key: "orderNumber", label: "Order #" },
            { key: "createdAt", label: "Date" },
            { key: "restaurantName", label: "Restaurant" },
            { key: "foodPrice", label: "Food Price (₹)" },
            { key: "commission", label: "Commission (₹)" },
            { key: "netEarning", label: "Original Price (₹)" },
        ]

        const dataToExport = settlements.map(s => ({
            orderNumber: s.orderNumber,
            createdAt: format(new Date(s.createdAt), 'dd MMM yyyy HH:mm'),
            restaurantName: s.restaurantName,
            foodPrice: s.restaurantEarning.foodPrice,
            commission: s.restaurantEarning.commission,
            netEarning: s.restaurantEarning.netEarning,
        }))

        switch (formatType) {
            case "csv": exportReportsToCSV(dataToExport, headers, "finance_report"); break
            case "excel": exportReportsToExcel(dataToExport, headers, "finance_report"); break
            case "pdf": exportReportsToPDF(dataToExport, headers, "finance_report", "Restaurant Finance Report"); break
            case "json": exportReportsToJSON(dataToExport, "finance_report"); break
        }
    }

    return (
        <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Page Header - Matching RestaurantReport Style */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                            <Briefcase className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900">Restaurant Finance Report</h1>
                            <p className="text-slate-500 text-sm">View and manage restaurant settlements</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="border-slate-200 hover:bg-slate-50 text-slate-700 gap-2">
                                    <Download className="w-4 h-4" />
                                    <span>Export</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white border-slate-200">
                                <DropdownMenuLabel>Export Formats</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer gap-2">
                                    <FileText className="w-4 h-4 text-orange-500" /> CSV
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport("excel")} className="cursor-pointer gap-2">
                                    <FileSpreadsheet className="w-4 h-4 text-green-500" /> Excel
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport("pdf")} className="cursor-pointer gap-2">
                                    <FileText className="w-4 h-4 text-red-500" /> PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport("json")} className="cursor-pointer gap-2">
                                    <Code className="w-4 h-4 text-blue-500" /> JSON
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                            onClick={handleMarkAsPaid}
                            disabled={isProcessing || settlements.length === 0}
                            className="bg-green-600 hover:bg-green-700 text-white gap-2 shadow-sm"
                        >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Mark as Paid
                        </Button>
                    </div>
                </div>

                {/* Filters Section - Matching Dashboard Filter Style */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Select Restaurant</label>
                            <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
                                <SelectTrigger className="border-slate-200 focus:ring-slate-400">
                                    <SelectValue placeholder="All Restaurants" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    <SelectItem value="all">All Restaurants</SelectItem>
                                    {allRestaurants.map(r => (
                                        <SelectItem key={r._id} value={r._id}>{r.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Start Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="border-slate-200 pl-10 focus:ring-slate-400"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">End Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="border-slate-200 pl-10 focus:ring-slate-400"
                                />
                            </div>
                        </div>

                        <div className="flex items-end">
                            <Button onClick={handleApplyFilters} className="w-full bg-slate-800 hover:bg-slate-900 text-white gap-2">
                                <Filter className="w-4 h-4" /> Apply Filters
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Info Cards - Matching Admin Dashboard Style */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Orders</CardTitle>
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <RefreshCw className="w-4 h-4 text-blue-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-900">{totals.totalOrders}</div>
                            <p className="text-xs text-slate-500 mt-1">Total delivered orders</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Commission</CardTitle>
                            <div className="p-2 bg-red-50 rounded-lg">
                                <IndianRupee className="w-4 h-4 text-red-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-900">₹{totals.totalCommission.toLocaleString()}</div>
                            <p className="text-xs text-slate-500 mt-1">Admin commission shared</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-none shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-white">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider">Original Price (Net)</CardTitle>
                            <div className="p-2 bg-green-500/20 rounded-lg">
                                <Wallet className="w-4 h-4 text-green-400" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-white">₹{totals.totalEarnings.toLocaleString()}</div>
                            <p className="text-xs text-slate-400 mt-1">Net amount for restaurants</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Table Section - Matching Standard Table Style */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900">Settlement Details</h3>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-medium">
                            {settlements.length} reports
                        </Badge>
                    </div>

                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                            <p className="text-slate-500 font-medium">Loading records...</p>
                        </div>
                    ) : settlements.length > 0 ? (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="border-slate-100">
                                        <TableHead className="w-16 font-semibold text-slate-700">SL</TableHead>
                                        <TableHead className="font-semibold text-slate-700">Order #</TableHead>
                                        <TableHead className="font-semibold text-slate-700">Date</TableHead>
                                        <TableHead className="font-semibold text-slate-700">Restaurant</TableHead>
                                        <TableHead className="text-right font-semibold text-slate-700">Food Price</TableHead>
                                        <TableHead className="text-right font-semibold text-slate-700">Commission</TableHead>
                                        <TableHead className="text-right font-semibold text-slate-700 text-blue-600">Original Price</TableHead>
                                        <TableHead className="text-center font-semibold text-slate-700">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {settlements.map((s, index) => (
                                        <TableRow key={s._id} className="border-slate-50 hover:bg-slate-50/50">
                                            <TableCell className="font-medium text-slate-400">{index + 1}</TableCell>
                                            <TableCell className="font-bold text-slate-900">#{s.orderNumber}</TableCell>
                                            <TableCell className="text-slate-600">
                                                <div className="text-sm">
                                                    <div>{format(new Date(s.createdAt), 'dd MMM yyyy')}</div>
                                                    <div className="text-[10px] text-slate-400">{format(new Date(s.createdAt), 'HH:mm')}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium text-slate-700">{s.restaurantName}</TableCell>
                                            <TableCell className="text-right text-slate-600">₹{s.restaurantEarning.foodPrice.toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-red-500/80">₹{s.restaurantEarning.commission.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-bold text-blue-600">₹{s.restaurantEarning.netEarning.toLocaleString()}</TableCell>
                                            <TableCell className="text-center">
                                                {(() => {
                                                    const status = s.orderId?.status || 'delivered';
                                                    const isDelivered = status === 'delivered';
                                                    return (
                                                        <Badge className={isDelivered ? "bg-green-50 text-green-600 border-none font-semibold" : "bg-orange-50 text-orange-600 border-none font-semibold"}>
                                                            {isDelivered ? 'Delivered' : status.charAt(0).toUpperCase() + status.slice(1)}
                                                        </Badge>
                                                    );
                                                })()}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="py-24 text-center">
                            <div className="inline-flex p-4 rounded-full bg-slate-50 mb-4">
                                <Search className="w-8 h-8 text-slate-300" />
                            </div>
                            <h4 className="text-lg font-bold text-slate-900">No records found</h4>
                            <p className="text-slate-500 max-w-xs mx-auto mt-1">Change filters or try selecting a different restaurant</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

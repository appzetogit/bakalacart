import { useState, useMemo, useEffect } from "react"
import { Search, Trash2, Loader2, Filter, X, Eye, Check, Ban, ShoppingBag, Utensils } from "lucide-react"
import { adminAPI, restaurantAPI } from "@/lib/api"
import apiClient from "@/lib/api"
import { toast } from "sonner"
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
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default function FoodsList() {
  const [searchQuery, setSearchQuery] = useState("")
  const [foods, setFoods] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  // Filter states
  const [selectedRestaurant, setSelectedRestaurant] = useState("all")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedFoodType, setSelectedFoodType] = useState("all")
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState("all")
  const [selectedAvailability, setSelectedAvailability] = useState("all")

  // State for categories
  const [categories, setCategories] = useState([])

  // Fetch categories for filtering
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await adminAPI.getCategories({ limit: 1000 })
        const cats = response?.data?.data?.categories || response?.data?.categories || []
        setCategories(cats)
      } catch (error) {
        console.error("Error fetching categories:", error)
      }
    }
    fetchCategories()
  }, [])

  // Fetch all foods from all restaurants
  const fetchAllFoods = async () => {
    try {
      setLoading(true)

      // First, fetch all restaurants
      const restaurantsResponse = await adminAPI.getRestaurants({ limit: 1000 })
      const restaurants = restaurantsResponse?.data?.data?.restaurants ||
        restaurantsResponse?.data?.restaurants ||
        []

      if (restaurants.length === 0) {
        setFoods([])
        setLoading(false)
        return
      }

      // Fetch menu for each restaurant in parallel with batching
      const batchSize = 10
      const allFoods = []

      for (let i = 0; i < restaurants.length; i += batchSize) {
        const batch = restaurants.slice(i, i + batchSize)
        const batchPromises = batch.map(async (restaurant) => {
          try {
            const restaurantId = restaurant._id || restaurant.id
            const menuResponse = await restaurantAPI.getMenuByRestaurantId(restaurantId)
            const menu = menuResponse?.data?.data?.menu || menuResponse?.data?.menu

            const restaurantFoods = []
            if (menu && menu.sections) {
              menu.sections.forEach((section) => {
                if (section.items && Array.isArray(section.items)) {
                  section.items.forEach((item) => {
                    restaurantFoods.push({
                      id: item.id || `${restaurantId}-${section.id}-${item.name}`,
                      _id: item._id,
                      name: item.name || "Unnamed Item",
                      image: item.image || item.images?.[0] || "https://via.placeholder.com/40",
                      priority: "Normal",
                      status: item.isAvailable !== false && item.approvalStatus !== 'rejected',
                      restaurantId: restaurantId,
                      restaurantName: restaurant.name || "Unknown Restaurant",
                      sectionName: section.name || "Unknown Section",
                      categoryId: section.id,
                      price: item.price || 0,
                      foodType: item.foodType || "Non-Veg",
                      approvalStatus: (item.approvalStatus || 'pending').toLowerCase(),
                      isAvailable: item.isAvailable !== false,
                      itemSizeQuantity: item.itemSizeQuantity,
                      itemSizeUnit: item.itemSizeUnit,
                      servesInfo: item.servesInfo,
                      description: item.description,
                      originalItem: item
                    })
                  })
                }

                if (section.subsections && Array.isArray(section.subsections)) {
                  section.subsections.forEach((subsection) => {
                    if (subsection.items && Array.isArray(subsection.items)) {
                      subsection.items.forEach((item) => {
                        restaurantFoods.push({
                          id: item.id || `${restaurantId}-${section.id}-${subsection.id}-${item.name}`,
                          _id: item._id,
                          name: item.name || "Unnamed Item",
                          image: item.image || item.images?.[0] || "https://via.placeholder.com/40",
                          priority: "Normal",
                          status: item.isAvailable !== false && item.approvalStatus !== 'rejected',
                          restaurantId: restaurantId,
                          restaurantName: restaurant.name || "Unknown Restaurant",
                          sectionName: section.name || "Unknown Section",
                          subsectionName: subsection.name || "Unknown Subsection",
                          categoryId: section.id,
                          price: item.price || 0,
                          foodType: item.foodType || "Non-Veg",
                          approvalStatus: (item.approvalStatus || 'pending').toLowerCase(),
                          isAvailable: item.isAvailable !== false,
                          itemSizeQuantity: item.itemSizeQuantity,
                          itemSizeUnit: item.itemSizeUnit,
                          servesInfo: item.servesInfo,
                          description: item.description,
                          originalItem: item
                        })
                      })
                    }
                  })
                }
              })
            }
            return restaurantFoods
          } catch (err) {
            console.error(`Error fetching menu for restaurant ${restaurant.name}:`, err)
            return []
          }
        })

        const batchResults = await Promise.all(batchPromises)
        allFoods.push(...batchResults.flat())
      }

      setFoods(allFoods)
    } catch (error) {
      console.error("Error fetching foods:", error)
      toast.error("Failed to load foods from restaurants")
      setFoods([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllFoods()
  }, [])

  // Format ID to FOOD format (e.g., FOOD519399)
  const formatFoodId = (id) => {
    if (!id) return "FOOD000000"

    const idString = String(id)
    // Extract last 6 digits from the ID
    // Handle formats like "1768285554154-0.703896654519399" or "item-1768285554154-0.703896654519399"
    const parts = idString.split(/[-.]/)
    let lastDigits = ""

    // Get the last part and extract digits
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1]
      // Extract only digits from the last part
      const digits = lastPart.match(/\d+/g)
      if (digits && digits.length > 0) {
        // Get last 6 digits from all digits found
        const allDigits = digits.join("")
        lastDigits = allDigits.slice(-6).padStart(6, "0")
      }
    }

    // If no digits found, use a hash of the ID
    if (!lastDigits) {
      const hash = idString.split("").reduce((acc, char) => {
        return ((acc << 5) - acc) + char.charCodeAt(0) | 0
      }, 0)
      lastDigits = Math.abs(hash).toString().slice(-6).padStart(6, "0")
    }

    return `FOOD${lastDigits}`
  }

  // Get unique restaurants for filter dropdown
  const uniqueRestaurants = useMemo(() => {
    const restaurants = [...new Set(foods.map(food => food.restaurantName).filter(Boolean))]
    return restaurants.sort()
  }, [foods])

  const filteredFoods = useMemo(() => {
    let result = [...foods]

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(food =>
        food.name.toLowerCase().includes(query) ||
        food.id.toString().includes(query) ||
        food.restaurantName?.toLowerCase().includes(query)
      )
    }

    // Restaurant filter
    if (selectedRestaurant !== "all") {
      result = result.filter(food => food.restaurantName === selectedRestaurant)
    }

    // Category filter
    if (selectedCategory !== "all") {
      result = result.filter(food => food.sectionName === selectedCategory || food.categoryId === selectedCategory)
    }

    // Food Type filter
    if (selectedFoodType !== "all") {
      result = result.filter(food => {
        // Handle both "Veg"/"Non-Veg" and "veg"/"non-veg" formats
        const foodType = (food.foodType || "Non-Veg").toLowerCase().replace(/-/g, "-")
        const filterType = selectedFoodType.toLowerCase().replace(/-/g, "-")
        // Normalize: "non-veg" or "non veg" should match "Non-Veg"
        const normalizedFoodType = foodType.replace(/\s+/g, "-")
        const normalizedFilterType = filterType.replace(/\s+/g, "-")
        return normalizedFoodType === normalizedFilterType
      })
    }

    // Approval Status filter
    if (selectedApprovalStatus !== "all") {
      result = result.filter(food => {
        const status = (food.approvalStatus || "pending").toLowerCase().trim()
        const filterStatus = selectedApprovalStatus.toLowerCase().trim()
        return status === filterStatus
      })
    }

    // Availability filter
    if (selectedAvailability !== "all") {
      result = result.filter(food => {
        if (selectedAvailability === "available") {
          // Available: isAvailable is true AND approvalStatus is not rejected
          return food.isAvailable === true && food.approvalStatus !== 'rejected'
        } else if (selectedAvailability === "unavailable") {
          // Unavailable: isAvailable is false OR approvalStatus is rejected
          return food.isAvailable === false || food.approvalStatus === 'rejected'
        }
        return true
      })
    }

    return result
  }, [foods, searchQuery, selectedRestaurant, selectedFoodType, selectedApprovalStatus, selectedAvailability])

  // Reset all filters
  const resetFilters = () => {
    setSelectedRestaurant("all")
    setSelectedCategory("all")
    setSelectedFoodType("all")
    setSelectedApprovalStatus("all")
    setSelectedAvailability("all")
    setSearchQuery("")
  }

  // Check if any filter is active
  const hasActiveFilters = selectedRestaurant !== "all" ||
    selectedCategory !== "all" ||
    selectedFoodType !== "all" ||
    selectedApprovalStatus !== "all" ||
    selectedAvailability !== "all" ||
    searchQuery.trim() !== ""

  // Deletion handler
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this food item?")) return
    try {
      setDeleting(true)
      // Note: Admin deletion logic would typically involve a specific admin endpoint
      // For now, we simulate success for UI demonstration or need to implement backend
      toast.info("Delete functionality needs specific admin endpoint")
      setFoods(foods.filter(f => f.id !== id))
      toast.success("Food item removed from list")
    } catch (error) {
      console.error("Delete error:", error)
      toast.error("Failed to delete food item")
    } finally {
      setDeleting(false)
    }
  }

  // Approval handler
  const handleApprove = async (foodId) => {
    try {
      // Assuming adminAPI has an approveFoodItem method that takes foodId
      const response = await adminAPI.approveFoodItem(foodId)
      if (response.data?.success) {
        toast.success("Food item approved successfully")
        setFoods(foods.map(f => f.id === foodId ? { ...f, approvalStatus: 'approved' } : f))
        setSelectedFood(null) // Close dialog after action
      } else {
        toast.error(response.data?.message || "Failed to approve food item")
      }
    } catch (error) {
      console.error("Approval error:", error)
      toast.error("Failed to approve food item")
    }
  }

  // Reject handler
  const handleReject = async (foodId, reason = "Doesn't meet quality standards") => {
    try {
      // Assuming adminAPI has a rejectFoodItem method that takes foodId and reason
      const response = await adminAPI.rejectFoodItem(foodId, reason)
      if (response.data?.success) {
        toast.success("Food item rejected")
        setFoods(foods.map(f => f.id === foodId ? { ...f, approvalStatus: 'rejected' } : f))
        setSelectedFood(null) // Close dialog after action
      } else {
        toast.error(response.data?.message || "Failed to reject food item")
      }
    } catch (error) {
      console.error("Rejection error:", error)
      toast.error("Failed to reject food item")
    }
  }

  const handleToggleAvailability = async (food) => {
    try {
      // Use the restaurantId stored in the food object during fetch
      const response = await adminAPI.toggleRestaurantMenuItem(food.restaurantId, food.id);
      if (response.data?.success) {
        toast.success(response.data.message);
        // Update local state
        setFoods(foods.map(f => f.id === food.id ? { ...f, isAvailable: response.data.data.isAvailable } : f));
      }
    } catch (error) {
      console.error("Toggle availability error:", error);
      toast.error("Failed to update availability status");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 shadow-sm">Approved</Badge>
      case 'rejected':
        return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200 shadow-sm">Rejected</Badge>
      default:
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 shadow-sm">Pending</Badge>
    }
  }

  const stats = useMemo(() => {
    return {
      total: foods.length,
      pending: foods.filter(f => f.approvalStatus === 'pending').length,
      rejected: foods.filter(f => f.approvalStatus === 'rejected').length,
      approved: foods.filter(f => f.approvalStatus === 'approved').length,
    }
  }, [foods])

  return (
    <div className="p-4 lg:p-8 bg-slate-50 min-h-screen space-y-8">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Food Management</h1>
          <p className="text-slate-500 mt-1">Monitor and moderate food items across all restaurants</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 bg-white">
            <ShoppingBag className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {[
          { label: "Total Foods", value: stats.total, icon: Utensils, color: "blue" },
          { label: "Pending", value: stats.pending, icon: Loader2, color: "amber" },
          { label: "Approved", value: stats.approved, icon: Check, color: "emerald" },
          { label: "Rejected", value: stats.rejected, icon: Ban, color: "rose" },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-${stat.color}-50 text-${stat.color}-600`}>
              <stat.icon className={`w-6 h-6 ${stat.color === 'amber' ? 'animate-spin-slow' : ''}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Header Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
            <div className="grid grid-cols-2 gap-0.5">
              <div className="w-2 h-2 bg-white rounded-sm"></div>
              <div className="w-2 h-2 bg-white rounded-sm"></div>
              <div className="w-2 h-2 bg-white rounded-sm"></div>
              <div className="w-2 h-2 bg-white rounded-sm"></div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Food</h1>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Food List</h2>
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
              {filteredFoods.length}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 sm:flex-initial min-w-[200px]">
              <input
                type="text"
                placeholder="Ex : Foods"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-700">Filters</h3>
            </div>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear All
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Category Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Category
              </label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full h-9 text-sm bg-white">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category._id || category.id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Food Type Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Food Type
              </label>
              <Select value={selectedFoodType} onValueChange={setSelectedFoodType}>
                <SelectTrigger className="w-full h-9 text-sm bg-white">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="veg">Veg</SelectItem>
                  <SelectItem value="non-veg">Non-Veg</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Approval Status Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Approval Status
              </label>
              <Select value={selectedApprovalStatus} onValueChange={setSelectedApprovalStatus}>
                <SelectTrigger className="w-full h-9 text-sm bg-white">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Availability Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Availability
              </label>
              <Select value={selectedAvailability} onValueChange={setSelectedAvailability}>
                <SelectTrigger className="w-full h-9 text-sm bg-white">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Food ID
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Food Item
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Available
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                      <p className="text-sm text-slate-500">Loading foods from restaurants...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredFoods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
                      <p className="text-sm text-slate-500">No food items match your search</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredFoods.map((food, index) => (
                  <tr
                    key={food.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        #{formatFoodId(food.id)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200 shadow-sm">
                          <img
                            src={food.image}
                            alt={food.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = "https://via.placeholder.com/40"
                            }}
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{food.name}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-400 font-medium">{food.restaurantName}</span>
                            {(() => {
                              const sizeUnit = food.itemSizeUnit || food.unit
                              const isPiece = sizeUnit && sizeUnit.trim().toLowerCase() === 'piece'
                              const displayParts = [food.itemSizeQuantity, !isPiece ? sizeUnit : null].filter(Boolean)
                              return displayParts.length > 0 ? (
                                <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-1 rounded">
                                  {displayParts.join(' ')}
                                </span>
                              ) : null
                            })()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-slate-900">₹{food.price}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(food.approvalStatus)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleAvailability(food)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${food.isAvailable !== false ? "bg-blue-600" : "bg-gray-300"}`}
                        title={food.isAvailable !== false ? "Click to set as unavailable" : "Click to set as available"}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${food.isAvailable !== false ? "translate-x-5" : "translate-x-1"}`}
                        />
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedFood(food)}
                          className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(food.id)}
                          disabled={deleting}
                          className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete"
                        >
                          {deleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Food Dialog */}
      <Dialog open={!!selectedFood} onOpenChange={() => setSelectedFood(null)}>
        <DialogContent className="max-w-md bg-white p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Utensils className="w-5 h-5 text-orange-600" />
              Food Details
            </DialogTitle>
            <DialogDescription>
              Review and manage food item approval status
            </DialogDescription>
          </DialogHeader>

          {selectedFood && (
            <div className="p-6 space-y-6">
              {/* Image & Main Info */}
              <div className="flex gap-4 items-start">
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                  <img
                    src={selectedFood.image}
                    alt={selectedFood.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="font-bold text-lg text-slate-900 leading-tight">
                    {selectedFood.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${selectedFood.foodType === 'Veg' ? 'border-green-600 text-green-600 bg-green-50' : 'border-red-600 text-red-600 bg-red-50'
                      }`}>
                      {selectedFood.foodType}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">#{formatFoodId(selectedFood.id)}</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900 mt-2">₹{selectedFood.price}</p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Restaurant</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedFood.restaurantName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedFood.sectionName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Portion / Unit</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {(() => {
                      const sizeUnit = selectedFood.itemSizeUnit || selectedFood.unit || selectedFood.itemSize
                      const isPiece = sizeUnit && sizeUnit.trim().toLowerCase() === 'piece'
                      const displayParts = [selectedFood.itemSizeQuantity, !isPiece ? sizeUnit : null].filter(Boolean)
                      return displayParts.length > 0 ? displayParts.join(' ') : 'N/A'
                    })()}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Serves</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedFood.servesInfo || 'N/A'}</p>
                </div>
              </div>

              {/* Description */}
              {selectedFood.description && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</p>
                  <p className="text-xs text-slate-600 leading-relaxed italic">
                    "{selectedFood.description}"
                  </p>
                </div>
              )}

              {/* Approval Actions */}
              <div className="pt-4 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Management Action</p>
                <div className="flex gap-3">
                  {selectedFood.approvalStatus !== 'approved' && (
                    <Button
                      onClick={() => handleApprove(selectedFood.id)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-10"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </Button>
                  )}
                  {selectedFood.approvalStatus !== 'rejected' && (
                    <Button
                      variant="outline"
                      onClick={() => handleReject(selectedFood.id)}
                      className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 gap-2 h-10"
                    >
                      <Ban className="w-4 h-4" />
                      Reject
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

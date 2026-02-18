import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Download, ChevronDown, Eye, Settings, ArrowUpDown, Loader2, X, MapPin, Phone, Mail, Clock, Star, Building2, User, FileText, CreditCard, Calendar, Image as ImageIcon, ExternalLink, ShieldX, AlertTriangle, Trash2, Plus, Edit } from "lucide-react"
import { adminAPI, restaurantAPI } from "../../../../lib/api"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { exportRestaurantsToPDF } from "../../components/restaurants/restaurantsExportUtils"

// Import icons from Dashboard-icons
import locationIcon from "../../assets/Dashboard-icons/image1.png"
import restaurantIcon from "../../assets/Dashboard-icons/image2.png"
import inactiveIcon from "../../assets/Dashboard-icons/image3.png"

export default function RestaurantsList() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedRestaurant, setSelectedRestaurant] = useState(null)
  const [restaurantDetails, setRestaurantDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [banConfirmDialog, setBanConfirmDialog] = useState(null) // { restaurant, action: 'ban' | 'unban' }
  const [banning, setBanning] = useState(false)
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState(null) // { restaurant }
  const [deleting, setDeleting] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailRestaurantId, setEmailRestaurantId] = useState(null)
  const [emailDialog, setEmailDialog] = useState(null) // { restaurant, open: true/false }
  const [emailSubject, setEmailSubject] = useState("")
  const [emailDescription, setEmailDescription] = useState("")
  const [editDialog, setEditDialog] = useState(null) // { restaurant, open: true/false }
  const [editingData, setEditingData] = useState({
    name: "",
    phone: "",
    email: "",
    ownerName: "",
    ownerPhone: "",
    ownerEmail: "",
    openingTime: "",
    closingTime: ""
  })
  const [savingEdit, setSavingEdit] = useState(false)

  // Format Restaurant ID to REST format (e.g., REST422829)
  const formatRestaurantId = (id) => {
    if (!id) return "REST000000"

    const idString = String(id)
    // Extract last 6 digits from the ID
    // Handle formats like "REST-1768045396242-2829" or "1768045396242-2829"
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
      } else {
        // If no digits in last part, look for digits in all parts
        const allParts = parts.join("")
        const allDigits = allParts.match(/\d+/g)
        if (allDigits && allDigits.length > 0) {
          const combinedDigits = allDigits.join("")
          lastDigits = combinedDigits.slice(-6).padStart(6, "0")
        }
      }
    }

    // If no digits found, use a hash of the ID
    if (!lastDigits) {
      const hash = idString.split("").reduce((acc, char) => {
        return ((acc << 5) - acc) + char.charCodeAt(0) | 0
      }, 0)
      lastDigits = Math.abs(hash).toString().slice(-6).padStart(6, "0")
    }

    return `REST${lastDigits}`
  }

  // Fetch restaurants from backend API
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setLoading(true)
        setError(null)

        let response
        try {
          // Try admin API first
          response = await adminAPI.getRestaurants()
        } catch (adminErr) {
          // Fallback to regular restaurant API if admin endpoint doesn't exist
          console.log("Admin restaurants endpoint not available, using fallback")
          response = await restaurantAPI.getRestaurants()
        }

        if (response.data && response.data.success && response.data.data) {
          // Map backend data to frontend format
          const restaurantsData = response.data.data.restaurants || response.data.data || []

          const mappedRestaurants = restaurantsData.map((restaurant, index) => ({
            id: restaurant._id || restaurant.id || index + 1,
            _id: restaurant._id, // Preserve original _id for API calls
            name: restaurant.name || "N/A",
            ownerName: restaurant.ownerName || "N/A",
            ownerPhone: restaurant.ownerPhone || restaurant.phone || "N/A",
            zone: restaurant.location?.area || restaurant.location?.city || restaurant.zone || "N/A",
            cuisine: Array.isArray(restaurant.cuisines) && restaurant.cuisines.length > 0
              ? restaurant.cuisines[0]
              : (restaurant.cuisine || "N/A"),
            status: restaurant.isActive !== false, // Default to true if not set
            rating: restaurant.ratings?.average || restaurant.rating || 0,
            logo: restaurant.profileImage?.url || restaurant.logo || "https://via.placeholder.com/40",
            // Preserve original restaurant data for details modal
            originalData: restaurant,
          }))

          setRestaurants(mappedRestaurants)
        } else {
          setRestaurants([])
        }
      } catch (err) {
        console.error("Error fetching restaurants:", err)
        setError(err.message || "Failed to fetch restaurants")
        setRestaurants([])
      } finally {
        setLoading(false)
      }
    }

    fetchRestaurants()
  }, [])
  const [filters, setFilters] = useState({
    all: "All",
    businessModel: "",
    cuisine: "",
    zone: "",
  })

  const filteredRestaurants = useMemo(() => {
    let result = [...restaurants]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(restaurant =>
        restaurant.name.toLowerCase().includes(query) ||
        restaurant.ownerName.toLowerCase().includes(query) ||
        restaurant.ownerPhone.includes(query)
      )
    }

    if (filters.all !== "All") {
      if (filters.all === "Active") {
        result = result.filter(restaurant => restaurant.status === true)
      } else if (filters.all === "Inactive") {
        result = result.filter(restaurant => restaurant.status === false)
      }
    }

    if (filters.cuisine) {
      result = result.filter(restaurant =>
        restaurant.cuisine.toLowerCase().includes(filters.cuisine.toLowerCase())
      )
    }

    if (filters.zone) {
      result = result.filter(restaurant => restaurant.zone === filters.zone)
    }

    return result
  }, [restaurants, searchQuery, filters])

  // Sort Logic
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' })

  const handleSort = (key) => {
    let direction = 'ascending'
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending'
    }
    setSortConfig({ key, direction })
  }

  const sortedRestaurants = useMemo(() => {
    let sortableItems = [...filteredRestaurants]
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1
        }
        return 0
      })
    }
    return sortableItems
  }, [filteredRestaurants, sortConfig])

  /* Existing handleToggleStatus code */
  const handleToggleStatus = async (id) => {
    try {
      // Optimistically update UI
      const updatedRestaurants = restaurants.map(restaurant =>
        restaurant.id === id ? { ...restaurant, status: !restaurant.status } : restaurant
      )
      setRestaurants(updatedRestaurants)

      // Call API to update restaurant status
      await adminAPI.updateRestaurantStatus(id, !restaurants.find(r => r.id === id).status)
    } catch (err) {
      console.error("Error updating restaurant status:", err)
      // Revert on error
      setRestaurants(restaurants)
      toast.error("Failed to update status")
    }
  }

  const handleToggleOpen = async (id, currentOpenStatus) => {
    try {
      const newStatus = !currentOpenStatus;

      // Optimistically update UI
      setRestaurants(prevRestaurants =>
        prevRestaurants.map(restaurant =>
          (restaurant.id === id || restaurant._id === id)
            ? { ...restaurant, isRestaurantOpen: newStatus }
            : restaurant
        )
      );

      // Call API
      const response = await adminAPI.toggleRestaurantOpenStatus(id, newStatus);

      if (response.data?.success) {
        toast.success(`Restaurant ${newStatus ? 'Opened' : 'Closed'} successfully`);
      } else {
        throw new Error(response.data?.message || "Failed to update");
      }
    } catch (err) {
      console.error("Error updating restaurant open status:", err);
      // Revert UI on error
      setRestaurants(prevRestaurants =>
        prevRestaurants.map(restaurant =>
          (restaurant.id === id || restaurant._id === id)
            ? { ...restaurant, isRestaurantOpen: !(!currentOpenStatus) } // revert
            : restaurant
        )
      );
      toast.error("Failed to update store open status");
    }
  }

  const totalRestaurants = restaurants.length
  const activeRestaurants = restaurants.filter(r => r.status).length
  const inactiveRestaurants = restaurants.filter(r => !r.status).length

  // Get unique cuisines from restaurants for filter dropdown
  const uniqueCuisines = useMemo(() => {
    const cuisines = restaurants
      .map(r => r.cuisine)
      .filter(c => c && c !== "N/A")
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort()
    return cuisines
  }, [restaurants])

  // Show full phone number without masking
  const formatPhone = (phone) => {
    if (!phone) return ""
    return phone
  }

  const renderStars = (rating) => {
    return "★".repeat(rating) + "☆".repeat(5 - rating)
  }

  // Handle view restaurant details
  const handleViewDetails = async (restaurant) => {
    setSelectedRestaurant(restaurant)
    setLoadingDetails(true)
    setRestaurantDetails(null)

    try {
      // First, use original data if available (has all details)
      if (restaurant.originalData) {
        console.log("Using original restaurant data:", restaurant.originalData)
        setRestaurantDetails(restaurant.originalData)
        setLoadingDetails(false)
        return
      }

      // Try to fetch full restaurant details from API
      // Use _id if available, otherwise use id or restaurantId
      const restaurantId = restaurant._id || restaurant.id || restaurant.restaurantId
      let response = null

      if (restaurantId) {
        try {
          // Try admin API first if it exists
          if (adminAPI.getRestaurantById) {
            response = await adminAPI.getRestaurantById(restaurantId)
          }
        } catch (err) {
          console.log("Admin API failed, trying restaurant API:", err)
        }

        // Fallback to regular restaurant API
        if (!response || !response?.data?.success) {
          try {
            response = await restaurantAPI.getRestaurantById(restaurantId)
          } catch (err) {
            console.log("Restaurant API also failed:", err)
          }
        }
      }

      // Check response structure
      if (response?.data?.success) {
        const data = response.data.data
        // Handle different response structures
        if (data?.restaurant) {
          setRestaurantDetails(data.restaurant)
        } else if (data) {
          setRestaurantDetails(data)
        } else {
          // Fallback to restaurant data from list
          setRestaurantDetails(restaurant)
        }
      } else {
        // Use the restaurant data we already have
        console.log("Using restaurant data from list:", restaurant)
        setRestaurantDetails(restaurant)
      }
    } catch (err) {
      console.error("Error fetching restaurant details:", err)
      // Use the restaurant data we already have
      setRestaurantDetails(restaurant)
    } finally {
      setLoadingDetails(false)
    }
  }

  const closeDetailsModal = () => {
    setSelectedRestaurant(null)
    setRestaurantDetails(null)
  }

  // Handle ban/unban restaurant
  const handleBanRestaurant = (restaurant) => {
    const isBanned = !restaurant.status
    setBanConfirmDialog({
      restaurant,
      action: isBanned ? 'unban' : 'ban'
    })
  }

  const confirmBanRestaurant = async () => {
    if (!banConfirmDialog) return

    const { restaurant, action } = banConfirmDialog
    const isBanning = action === 'ban'
    const newStatus = !isBanning // false for ban, true for unban

    try {
      setBanning(true)
      const restaurantId = restaurant._id || restaurant.id

      // Update restaurant status via API
      try {
        await adminAPI.updateRestaurantStatus(restaurantId, newStatus)

        // Update local state on success
        setRestaurants(prevRestaurants =>
          prevRestaurants.map(r =>
            r.id === restaurant.id || r._id === restaurant._id
              ? { ...r, status: newStatus }
              : r
          )
        )

        // Close dialog
        setBanConfirmDialog(null)

        // Show success message
        console.log(`Restaurant ${isBanning ? 'banned' : 'unbanned'} successfully`)
      } catch (apiErr) {
        console.error("API Error:", apiErr)
        // If API fails, still update locally for better UX
        setRestaurants(prevRestaurants =>
          prevRestaurants.map(r =>
            r.id === restaurant.id || r._id === restaurant._id
              ? { ...r, status: newStatus }
              : r
          )
        )
        setBanConfirmDialog(null)
        alert(`Restaurant ${isBanning ? 'banned' : 'unbanned'} locally. Please check backend connection.`)
      }

    } catch (err) {
      console.error("Error banning/unbanning restaurant:", err)
      alert(`Failed to ${action} restaurant. Please try again.`)
    } finally {
      setBanning(false)
    }
  }

  const cancelBanRestaurant = () => {
    setBanConfirmDialog(null)
  }

  // Handle delete restaurant
  const handleDeleteRestaurant = (restaurant) => {
    setDeleteConfirmDialog({ restaurant })
  }

  const confirmDeleteRestaurant = async () => {
    if (!deleteConfirmDialog) return

    const { restaurant } = deleteConfirmDialog

    try {
      setDeleting(true)
      const restaurantId = restaurant._id || restaurant.id

      // Delete restaurant via API
      try {
        await adminAPI.deleteRestaurant(restaurantId)

        // Remove from local state on success
        setRestaurants(prevRestaurants =>
          prevRestaurants.filter(r =>
            r.id !== restaurant.id && r._id !== restaurant._id
          )
        )

        // Close dialog
        setDeleteConfirmDialog(null)

        // Show success message
        alert(`Restaurant "${restaurant.name}" deleted successfully!`)
      } catch (apiErr) {
        console.error("API Error:", apiErr)
        alert(apiErr.response?.data?.message || "Failed to delete restaurant. Please try again.")
      }

    } catch (err) {
      console.error("Error deleting restaurant:", err)
      alert("Failed to delete restaurant. Please try again.")
    } finally {
      setDeleting(false)
    }
  }

  const cancelDeleteRestaurant = () => {
    setDeleteConfirmDialog(null)
  }

  // Handle open email dialog
  const handleOpenEmailDialog = (restaurant) => {
    // Check multiple possible email locations
    const restaurantEmail =
      restaurant.email ||
      restaurant.ownerEmail ||
      restaurant.owner?.email ||
      restaurant.originalData?.email ||
      restaurant.originalData?.ownerEmail ||
      restaurant.originalData?.onboarding?.step1?.ownerEmail ||
      restaurant.originalData?.googleEmail ||
      restaurant.googleEmail

    // Allow dialog to open even if email not found - backend will validate
    // But show a warning if email is not found
    if (!restaurantEmail) {
      toast.warning("Restaurant email not found. Please ensure the restaurant has an email address before sending.")
    }

    setEmailDialog({
      restaurant,
      open: true
    })
    setEmailSubject("")
    setEmailDescription("")
  }

  // Handle close email dialog
  const handleCloseEmailDialog = () => {
    setEmailDialog(null)
    setEmailSubject("")
    setEmailDescription("")
  }

  // Handle send email
  const handleSendEmail = async () => {
    if (!emailDialog?.restaurant) return

    if (!emailSubject.trim()) {
      toast.error("Please enter email subject")
      return
    }

    if (!emailDescription.trim()) {
      toast.error("Please enter email description")
      return
    }

    const restaurantId = emailDialog.restaurant._id || emailDialog.restaurant.id

    // Check multiple possible email locations for display
    const restaurantEmail =
      emailDialog.restaurant.email ||
      emailDialog.restaurant.ownerEmail ||
      emailDialog.restaurant.owner?.email ||
      emailDialog.restaurant.originalData?.email ||
      emailDialog.restaurant.originalData?.ownerEmail ||
      emailDialog.restaurant.originalData?.onboarding?.step1?.ownerEmail ||
      emailDialog.restaurant.originalData?.googleEmail ||
      emailDialog.restaurant.googleEmail ||
      "restaurant"

    try {
      setSendingEmail(true)
      setEmailRestaurantId(restaurantId)

      const response = await adminAPI.sendRestaurantEmail(restaurantId, emailSubject.trim(), emailDescription.trim())

      if (response?.data?.success) {
        toast.success(`Email sent successfully to ${restaurantEmail}`)
        handleCloseEmailDialog()
      } else {
        toast.error(response?.data?.message || "Failed to send email")
      }
    } catch (error) {
      console.error("Error sending email:", error)
      const errorMessage = error.response?.data?.message || "Failed to send email. Please try again."
      toast.error(errorMessage)

      // If error is about email not found, close dialog after showing error
      if (errorMessage.includes("email not found") || errorMessage.includes("email not available")) {
        setTimeout(() => {
          handleCloseEmailDialog()
        }, 2000)
      }
    } finally {
      setSendingEmail(false)
      setEmailRestaurantId(null)
    }
  }

  // Handle edit click
  const handleEditClick = (restaurant) => {
    setEditDialog({
      restaurant,
      open: true
    })

    // Pre-fill data
    // Prioritize originalData if available, fallback to list data
    const data = restaurant.originalData || restaurant
    setEditingData({
      name: data.name || "",
      phone: data.phone || data.ownerPhone || "",
      email: data.email || data.ownerEmail || "",
      ownerName: data.ownerName || "",
      ownerPhone: data.ownerPhone || data.phone || "",
      ownerEmail: data.ownerEmail || data.email || "",
      openingTime: data.deliveryTimings?.openingTime || data.onboarding?.step2?.deliveryTimings?.openingTime || "09:00",
      closingTime: data.deliveryTimings?.closingTime || data.onboarding?.step2?.deliveryTimings?.closingTime || "22:00"
    })
  }

  // Handle update restaurant
  const handleUpdateRestaurant = async () => {
    if (!editDialog?.restaurant) return

    if (!editingData.name.trim()) {
      toast.error("Restaurant name is required")
      return
    }

    if (!editingData.phone.trim()) {
      toast.error("Phone number is required")
      return
    }

    const restaurantId = editDialog.restaurant._id || editDialog.restaurant.id
    const loadingToastId = toast.loading("Updating restaurant details...")

    try {
      setSavingEdit(true)

      // Prepare payload with deliveryTimings structure
      const updatePayload = { ...editingData }
      if (updatePayload.openingTime || updatePayload.closingTime) {
        updatePayload.deliveryTimings = {
          openingTime: updatePayload.openingTime,
          closingTime: updatePayload.closingTime
        }
        // Remove individual fields so they don't pollute the root object
        delete updatePayload.openingTime
        delete updatePayload.closingTime
      }

      console.log(`📤 Sending update for restaurant ${restaurantId}:`, updatePayload)

      const response = await adminAPI.updateRestaurant(restaurantId, updatePayload)

      if (response?.data?.success) {
        toast.success("Restaurant updated successfully", { id: loadingToastId })
        setEditDialog(null)

        // Update local state directly to avoid inconsistent mapping
        setRestaurants(prev => prev.map(r => {
          const rId = r._id || r.id
          if (rId === restaurantId) {
            // New delivery timings object
            const newDeliveryTimings = {
              openingTime: editingData.openingTime,
              closingTime: editingData.closingTime
            }

            // Merge changes into the existing mapped restaurant object
            return {
              ...r,
              name: editingData.name,
              ownerName: editingData.ownerName,
              ownerPhone: editingData.ownerPhone || editingData.phone,
              // Update deliveryTimings at root if it exists or needs to be added
              deliveryTimings: {
                ...(r.deliveryTimings || {}),
                ...newDeliveryTimings
              },
              originalData: {
                ...r.originalData,
                ...editingData,
                // Ensure core fields are updated in the root of originalData too
                name: editingData.name,
                phone: editingData.phone,
                ownerPhone: editingData.ownerPhone,
                ownerEmail: editingData.ownerEmail,
                ownerName: editingData.ownerName,
                email: editingData.email,
                // Explicitly update deliveryTimings in originalData
                deliveryTimings: {
                  ...(r.originalData?.deliveryTimings || {}),
                  ...newDeliveryTimings
                },
                // Also update onboarding step 2 if present for consistency
                onboarding: r.originalData?.onboarding ? {
                  ...r.originalData.onboarding,
                  step2: r.originalData.onboarding.step2 ? {
                    ...r.originalData.onboarding.step2,
                    deliveryTimings: {
                      ...(r.originalData.onboarding.step2.deliveryTimings || {}),
                      ...newDeliveryTimings
                    }
                  } : r.originalData.onboarding.step2
                } : r.originalData?.onboarding
              }
            }
          }
          return r
        }))
      } else {
        const errorMsg = response?.data?.message || "Failed to update restaurant"
        toast.error(errorMsg, { id: loadingToastId })
      }
    } catch (error) {
      console.error("❌ Error updating restaurant:", error)
      const errorMessage = error.response?.data?.message || error.message || "Failed to update restaurant. Please try again."
      toast.error(errorMessage, { id: loadingToastId })
    } finally {
      setSavingEdit(false)
    }
  }

  // Handle export functionality
  const handleExport = () => {
    const dataToExport = filteredRestaurants.length > 0 ? filteredRestaurants : restaurants
    const filename = "restaurants_list"
    exportRestaurantsToPDF(dataToExport, filename)
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">Restaurants List</h1>
            </div>

          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* Total Restaurants */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Total restaurants</p>
                <p className="text-2xl font-bold text-slate-900">{totalRestaurants}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <img src={locationIcon} alt="Location" className="w-8 h-8" />
              </div>
            </div>
          </div>

          {/* Active Restaurants */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Active restaurants</p>
                <p className="text-2xl font-bold text-slate-900">{activeRestaurants}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <img src={restaurantIcon} alt="Restaurant" className="w-8 h-8" />
              </div>
            </div>
          </div>

          {/* Inactive Restaurants */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Inactive restaurants</p>
                <p className="text-2xl font-bold text-slate-900">{inactiveRestaurants}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
                <img src={inactiveIcon} alt="Inactive" className="w-8 h-8" />
              </div>
            </div>
          </div>
        </div>

        {/* Restaurants List Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-slate-900">Restaurants List</h2>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/admin/restaurants/add")}
                className="px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Restaurant</span>
              </button>
              <div className="relative flex-1 sm:flex-initial min-w-[250px]">
                <input
                  type="text"
                  placeholder="Ex: search by Restaurant n"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all">
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
                  <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExport} className="cursor-pointer flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>



              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all">
                    <Settings className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                  <DropdownMenuLabel>Table Settings</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-normal text-slate-500">Sort By</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => handleSort('name')} className="cursor-pointer gap-2">
                    <span>Name</span>
                    {sortConfig.key === 'name' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort('rating')} className="cursor-pointer gap-2">
                    <span>Rating</span>
                    {sortConfig.key === 'rating' && (sortConfig.direction === 'ascending' ? '↑' : '↓')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => {
                    setSortConfig({ key: null, direction: 'ascending' })
                    setSearchQuery("")
                    setFilters({ all: "All", businessModel: "", cuisine: "", zone: "" })
                  }} className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50">
                    Reset All Filters
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-3 text-slate-600">Loading restaurants...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20">
                <p className="text-lg font-semibold text-red-600 mb-1">Error Loading Data</p>
                <p className="text-sm text-slate-500">{error}</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider cursor-pointer" onClick={() => handleSort(null)}>
                      <div className="flex items-center gap-1">
                        <span>SL</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">
                        <span>Restaurant Info</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('ownerName')}>
                      <div className="flex items-center gap-1">
                        <span>Owner Info</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('zone')}>
                      <div className="flex items-center gap-1">
                        <span>Zone</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('cuisine')}>
                      <div className="flex items-center gap-1">
                        <span>Cuisine</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('slug')}>
                      <div className="flex items-center gap-1">
                        <span>Slug</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('status')}>
                      <div className="flex items-center gap-1">
                        <span>Status</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('isRestaurantOpen')}>
                      <div className="flex items-center gap-1">
                        <span>Store Open</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {sortedRestaurants.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
                          <p className="text-sm text-slate-500">No restaurants match your search</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedRestaurants.map((restaurant, index) => (
                      <tr
                        key={restaurant.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-700">{index + 1}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <img
                                src={restaurant.logo}
                                alt={restaurant.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.src = "https://via.placeholder.com/40"
                                }}
                              />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-slate-900">{restaurant.name}</span>
                              <span className="text-xs text-slate-500">ID #{formatRestaurantId(restaurant.originalData?.restaurantId || restaurant.originalData?._id || restaurant._id || restaurant.id)}</span>
                              <span className="text-xs text-slate-500">{renderStars(restaurant.rating)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900">{restaurant.ownerName}</span>
                            <span className="text-xs text-slate-500">{formatPhone(restaurant.ownerPhone)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700">{restaurant.zone}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700">{restaurant.cuisine}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700">{restaurant.slug || (restaurant.name ? restaurant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : 'N/A')}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleStatus(restaurant.id)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${restaurant.status ? "bg-blue-600" : "bg-slate-300"
                              }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${restaurant.status ? "translate-x-6" : "translate-x-1"
                                }`}
                            />
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleOpen(restaurant.id || restaurant._id, restaurant.isRestaurantOpen !== false)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${restaurant.isRestaurantOpen !== false ? "bg-green-600" : "bg-red-400"
                              }`}
                            title={restaurant.isRestaurantOpen !== false ? "Store is Open" : "Store is Closed (Manual Override)"}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${restaurant.isRestaurantOpen !== false ? "translate-x-6" : "translate-x-1"
                                }`}
                            />
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleViewDetails(restaurant)}
                              className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditClick(restaurant)}
                              className="p-1.5 rounded text-amber-600 hover:bg-amber-50 transition-colors"
                              title="Edit Restaurant"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleBanRestaurant(restaurant)}
                              className={`p-1.5 rounded transition-colors ${!restaurant.status
                                ? "text-green-600 hover:bg-green-50"
                                : "text-red-600 hover:bg-red-50"
                                }`}
                              title={!restaurant.status ? "Unban Restaurant" : "Ban Restaurant"}
                            >
                              <ShieldX className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEmailDialog(restaurant)}
                              disabled={sendingEmail && emailRestaurantId === (restaurant._id || restaurant.id)}
                              className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Send Email"
                            >
                              {sendingEmail && emailRestaurantId === (restaurant._id || restaurant.id) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Mail className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteRestaurant(restaurant)}
                              className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete Restaurant"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div >

      {/* Restaurant Details Modal */}
      {
        selectedRestaurant && (
          <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeDetailsModal}>
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-bold text-slate-900">Restaurant Details</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const restaurant = restaurants.find(r => (r._id || r.id) === (selectedRestaurant._id || selectedRestaurant.id));
                      if (restaurant) {
                        closeDetailsModal();
                        handleEditClick(restaurant);
                      }
                    }}
                    className="flex items-center gap-2 text-amber-600 border-amber-200 hover:bg-amber-50"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </Button>
                </div>
                <button
                  onClick={closeDetailsModal}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {loadingDetails && (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="ml-3 text-slate-600">Loading details...</span>
                  </div>
                )}
                {!loadingDetails && (restaurantDetails || selectedRestaurant) && (
                  <div className="space-y-6">
                    {/* Restaurant Basic Info */}
                    <div className="flex items-start gap-6 pb-6 border-b border-slate-200">
                      <div className="w-24 h-24 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                        <img
                          src={restaurantDetails?.profileImage?.url || restaurantDetails?.logo || selectedRestaurant?.logo || selectedRestaurant?.originalData?.profileImage?.url || "https://via.placeholder.com/96"}
                          alt={restaurantDetails?.name || selectedRestaurant?.name || "Restaurant"}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = "https://via.placeholder.com/96"
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">
                          {restaurantDetails?.name || selectedRestaurant?.name || "N/A"}
                        </h3>
                        <div className="flex items-center gap-4 flex-wrap">
                          {(restaurantDetails?.ratings?.average || selectedRestaurant?.originalData?.ratings?.average) && (
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-medium text-slate-700">
                                {(restaurantDetails?.ratings?.average || selectedRestaurant?.originalData?.ratings?.average || 0).toFixed(1)} ({(restaurantDetails?.ratings?.count || selectedRestaurant?.originalData?.ratings?.count || 0)} reviews)
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-slate-600">
                            <Building2 className="w-4 h-4" />
                            <span className="text-sm">{formatRestaurantId(restaurantDetails?.restaurantId || restaurantDetails?._id || selectedRestaurant?.id || selectedRestaurant?._id)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Owner Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-lg font-semibold text-slate-900 mb-4">Owner Information</h4>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <User className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500">Owner Name</p>
                              <p className="text-sm font-medium text-slate-900">
                                {restaurantDetails?.ownerName || selectedRestaurant?.ownerName || selectedRestaurant?.originalData?.ownerName || "N/A"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Phone className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500">Phone</p>
                              <p className="text-sm font-medium text-slate-900">
                                {restaurantDetails?.ownerPhone || restaurantDetails?.phone || selectedRestaurant?.ownerPhone || selectedRestaurant?.originalData?.ownerPhone || selectedRestaurant?.originalData?.phone || "N/A"}
                              </p>
                            </div>
                          </div>
                          {restaurantDetails?.ownerEmail && (
                            <div className="flex items-center gap-3">
                              <Mail className="w-5 h-5 text-slate-400" />
                              <div>
                                <p className="text-xs text-slate-500">Email</p>
                                <p className="text-sm font-medium text-slate-900">{restaurantDetails.ownerEmail}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Location & Contact */}
                      <div>
                        <h4 className="text-lg font-semibold text-slate-900 mb-4">Location & Contact</h4>
                        <div className="space-y-3">
                          {restaurantDetails?.location && (
                            <div className="flex items-start gap-3">
                              <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                              <div>
                                <p className="text-xs text-slate-500">Address</p>
                                <p className="text-sm font-medium text-slate-900">
                                  {restaurantDetails.location.addressLine1 || ""}
                                  {restaurantDetails.location.addressLine2 && `, ${restaurantDetails.location.addressLine2}`}
                                  {restaurantDetails.location.area && `, ${restaurantDetails.location.area}`}
                                  {restaurantDetails.location.city && `, ${restaurantDetails.location.city}`}
                                  {!restaurantDetails.location.addressLine1 && !restaurantDetails.location.area && !restaurantDetails.location.city && selectedRestaurant.zone}
                                </p>
                              </div>
                            </div>
                          )}
                          {restaurantDetails?.primaryContactNumber && (
                            <div className="flex items-center gap-3">
                              <Phone className="w-5 h-5 text-slate-400" />
                              <div>
                                <p className="text-xs text-slate-500">Primary Contact</p>
                                <p className="text-sm font-medium text-slate-900">{restaurantDetails.primaryContactNumber}</p>
                              </div>
                            </div>
                          )}
                          {restaurantDetails?.email && (
                            <div className="flex items-center gap-3">
                              <Mail className="w-5 h-5 text-slate-400" />
                              <div>
                                <p className="text-xs text-slate-500">Restaurant Email</p>
                                <p className="text-sm font-medium text-slate-900">{restaurantDetails.email}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Cuisine & Timings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-lg font-semibold text-slate-900 mb-4">Cuisine & Details</h4>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Cuisines</p>
                            <div className="flex flex-wrap gap-2">
                              {restaurantDetails?.cuisines && Array.isArray(restaurantDetails.cuisines) && restaurantDetails.cuisines.length > 0 ? (
                                restaurantDetails.cuisines.map((cuisine, idx) => (
                                  <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                    {cuisine}
                                  </span>
                                ))
                              ) : (
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                  {restaurantDetails?.cuisine || selectedRestaurant.cuisine || "N/A"}
                                </span>
                              )}
                            </div>
                          </div>
                          {restaurantDetails?.offer && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Current Offer</p>
                              <p className="text-sm font-medium text-green-600">{restaurantDetails.offer}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-lg font-semibold text-slate-900 mb-4">Timings & Status</h4>
                        <div className="space-y-3">
                          {restaurantDetails?.deliveryTimings && (
                            <div className="flex items-center gap-3">
                              <Clock className="w-5 h-5 text-slate-400" />
                              <div>
                                <p className="text-xs text-slate-500">Delivery Timings</p>
                                <p className="text-sm font-medium text-slate-900">
                                  {restaurantDetails.deliveryTimings.openingTime || "N/A"} - {restaurantDetails.deliveryTimings.closingTime || "N/A"}
                                </p>
                              </div>
                            </div>
                          )}
                          {restaurantDetails?.estimatedDeliveryTime && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Estimated Delivery Time</p>
                              <p className="text-sm font-medium text-slate-900">{restaurantDetails.estimatedDeliveryTime}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Status</p>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${(restaurantDetails?.isActive !== false) ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                              }`}>
                              {(restaurantDetails?.isActive !== false) ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Registration Information */}
                    {(restaurantDetails?.createdAt || restaurantDetails?.updatedAt) && (
                      <div className="pt-6 border-t border-slate-200">
                        <h4 className="text-lg font-semibold text-slate-900 mb-4">Registration Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {restaurantDetails.createdAt && (
                            <div className="flex items-center gap-3">
                              <Calendar className="w-5 h-5 text-slate-400" />
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Registration Date & Time</p>
                                <p className="font-medium text-slate-900">
                                  {new Date(restaurantDetails.createdAt).toLocaleString('en-IN', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                          )}
                          {restaurantDetails.updatedAt && (
                            <div className="flex items-center gap-3">
                              <Calendar className="w-5 h-5 text-slate-400" />
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Last Updated</p>
                                <p className="font-medium text-slate-900">
                                  {new Date(restaurantDetails.updatedAt).toLocaleString('en-IN', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                          )}
                          {restaurantDetails.restaurantId && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Restaurant ID</p>
                              <p className="font-medium text-slate-900">{formatRestaurantId(restaurantDetails.restaurantId)}</p>
                            </div>
                          )}
                          {(restaurantDetails.slug || restaurantDetails.name) && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Slug</p>
                              <p className="font-medium text-slate-900">{restaurantDetails.slug || (restaurantDetails.name ? restaurantDetails.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : 'N/A')}</p>
                            </div>
                          )}
                          {restaurantDetails.phoneVerified !== undefined && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Phone Verified</p>
                              <p className="font-medium text-slate-900">{restaurantDetails.phoneVerified ? "Yes" : "No"}</p>
                            </div>
                          )}
                          {restaurantDetails.signupMethod && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Signup Method</p>
                              <p className="font-medium text-slate-900 capitalize">{restaurantDetails.signupMethod}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Registration Documents - PAN, GST, FSSAI, Bank */}
                    {restaurantDetails?.onboarding?.step3 && (
                      <div className="pt-6 border-t border-slate-200">
                        <h4 className="text-lg font-semibold text-slate-900 mb-4">Registration Documents</h4>
                        <div className="space-y-6">
                          {/* PAN Details */}
                          {restaurantDetails.onboarding.step3.pan && (
                            <div className="bg-slate-50 rounded-lg p-4">
                              <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                PAN Details
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                {restaurantDetails.onboarding.step3.pan.panNumber && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">PAN Number</p>
                                    <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step3.pan.panNumber}</p>
                                  </div>
                                )}
                                {restaurantDetails.onboarding.step3.pan.nameOnPan && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Name on PAN</p>
                                    <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step3.pan.nameOnPan}</p>
                                  </div>
                                )}
                                {restaurantDetails.onboarding.step3.pan.image?.url && (
                                  <div className="md:col-span-2">
                                    <p className="text-xs text-slate-500 mb-2">PAN Document</p>
                                    <a
                                      href={restaurantDetails.onboarding.step3.pan.image.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                                    >
                                      <ImageIcon className="w-4 h-4" />
                                      <span>View PAN Document</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* GST Details */}
                          {restaurantDetails.onboarding.step3.gst && (
                            <div className="bg-slate-50 rounded-lg p-4">
                              <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                GST Details
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">GST Registered</p>
                                  <p className="font-medium text-slate-900">
                                    {restaurantDetails.onboarding.step3.gst.isRegistered ? "Yes" : "No"}
                                  </p>
                                </div>
                                {restaurantDetails.onboarding.step3.gst.gstNumber && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">GST Number</p>
                                    <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step3.gst.gstNumber}</p>
                                  </div>
                                )}
                                {restaurantDetails.onboarding.step3.gst.legalName && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Legal Name</p>
                                    <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step3.gst.legalName}</p>
                                  </div>
                                )}
                                {restaurantDetails.onboarding.step3.gst.address && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">GST Address</p>
                                    <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step3.gst.address}</p>
                                  </div>
                                )}
                                {restaurantDetails.onboarding.step3.gst.image?.url && (
                                  <div className="md:col-span-2">
                                    <p className="text-xs text-slate-500 mb-2">GST Document</p>
                                    <a
                                      href={restaurantDetails.onboarding.step3.gst.image.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                                    >
                                      <ImageIcon className="w-4 h-4" />
                                      <span>View GST Document</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* FSSAI Details */}
                          {restaurantDetails.onboarding.step3.fssai && (
                            <div className="bg-slate-50 rounded-lg p-4">
                              <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                FSSAI Details
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                {restaurantDetails.onboarding.step3.fssai.registrationNumber && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">FSSAI Registration Number</p>
                                    <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step3.fssai.registrationNumber}</p>
                                  </div>
                                )}
                                {restaurantDetails.onboarding.step3.fssai.expiryDate && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">FSSAI Expiry Date</p>
                                    <p className="font-medium text-slate-900">
                                      {new Date(restaurantDetails.onboarding.step3.fssai.expiryDate).toLocaleDateString('en-IN', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                      })}
                                    </p>
                                  </div>
                                )}
                                {restaurantDetails.onboarding.step3.fssai.image?.url && (
                                  <div className="md:col-span-2">
                                    <p className="text-xs text-slate-500 mb-2">FSSAI Document</p>
                                    <a
                                      href={restaurantDetails.onboarding.step3.fssai.image.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                                    >
                                      <ImageIcon className="w-4 h-4" />
                                      <span>View FSSAI Document</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Bank Details */}
                          {restaurantDetails.onboarding.step3.bank && (
                            <div className="bg-slate-50 rounded-lg p-4">
                              <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                <CreditCard className="w-4 h-4" />
                                Bank Details
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                {restaurantDetails.onboarding.step3.bank.accountNumber && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Account Number</p>
                                    <p className="font-medium text-slate-900">
                                      {restaurantDetails.onboarding.step3.bank.accountNumber}
                                    </p>
                                  </div>
                                )}
                                {restaurantDetails.onboarding.step3.bank.ifscCode && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">IFSC Code</p>
                                    <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step3.bank.ifscCode}</p>
                                  </div>
                                )}
                                {restaurantDetails.onboarding.step3.bank.accountHolderName && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Account Holder Name</p>
                                    <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step3.bank.accountHolderName}</p>
                                  </div>
                                )}
                                {restaurantDetails.onboarding.step3.bank.accountType && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Account Type</p>
                                    <p className="font-medium text-slate-900 capitalize">{restaurantDetails.onboarding.step3.bank.accountType}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Onboarding Step 1 Details */}
                    {restaurantDetails?.onboarding?.step1 && (
                      <div className="pt-6 border-t border-slate-200">
                        <h4 className="text-lg font-semibold text-slate-900 mb-4">Registration Step 1 Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {restaurantDetails.onboarding.step1.restaurantName && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Restaurant Name (at registration)</p>
                              <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step1.restaurantName}</p>
                            </div>
                          )}
                          {restaurantDetails.onboarding.step1.ownerName && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Owner Name (at registration)</p>
                              <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step1.ownerName}</p>
                            </div>
                          )}
                          {restaurantDetails.onboarding.step1.ownerEmail && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Owner Email (at registration)</p>
                              <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step1.ownerEmail}</p>
                            </div>
                          )}
                          {restaurantDetails.onboarding.step1.ownerPhone && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Owner Phone (at registration)</p>
                              <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step1.ownerPhone}</p>
                            </div>
                          )}
                          {restaurantDetails.onboarding.step1.primaryContactNumber && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Primary Contact (at registration)</p>
                              <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step1.primaryContactNumber}</p>
                            </div>
                          )}
                          {restaurantDetails.onboarding.step1.location && (
                            <div className="md:col-span-2">
                              <p className="text-xs text-slate-500 mb-1">Location (at registration)</p>
                              <p className="font-medium text-slate-900">
                                {restaurantDetails.onboarding.step1.location.addressLine1 || ""}
                                {restaurantDetails.onboarding.step1.location.addressLine2 && `, ${restaurantDetails.onboarding.step1.location.addressLine2}`}
                                {restaurantDetails.onboarding.step1.location.area && `, ${restaurantDetails.onboarding.step1.location.area}`}
                                {restaurantDetails.onboarding.step1.location.city && `, ${restaurantDetails.onboarding.step1.location.city}`}
                                {restaurantDetails.onboarding.step1.location.landmark && `, ${restaurantDetails.onboarding.step1.location.landmark}`}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Onboarding Step 2 Details */}
                    {restaurantDetails?.onboarding?.step2 && (
                      <div className="pt-6 border-t border-slate-200">
                        <h4 className="text-lg font-semibold text-slate-900 mb-4">Registration Step 2 Details</h4>
                        <div className="space-y-4">
                          {restaurantDetails.onboarding.step2.cuisines && Array.isArray(restaurantDetails.onboarding.step2.cuisines) && restaurantDetails.onboarding.step2.cuisines.length > 0 && (
                            <div>
                              <p className="text-xs text-slate-500 mb-2">Cuisines (at registration)</p>
                              <div className="flex flex-wrap gap-2">
                                {restaurantDetails.onboarding.step2.cuisines.map((cuisine, idx) => (
                                  <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                                    {cuisine}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {restaurantDetails.onboarding.step2.deliveryTimings && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Opening Time (at registration)</p>
                                <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step2.deliveryTimings.openingTime || "N/A"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Closing Time (at registration)</p>
                                <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step2.deliveryTimings.closingTime || "N/A"}</p>
                              </div>
                            </div>
                          )}
                          {restaurantDetails.onboarding.step2.openDays && Array.isArray(restaurantDetails.onboarding.step2.openDays) && restaurantDetails.onboarding.step2.openDays.length > 0 && (
                            <div>
                              <p className="text-xs text-slate-500 mb-2">Open Days (at registration)</p>
                              <div className="flex flex-wrap gap-2">
                                {restaurantDetails.onboarding.step2.openDays.map((day, idx) => (
                                  <span key={idx} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium capitalize">
                                    {day}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {restaurantDetails.onboarding.step2.profileImageUrl?.url && (
                            <div>
                              <p className="text-xs text-slate-500 mb-2">Profile Image (at registration)</p>
                              <a
                                href={restaurantDetails.onboarding.step2.profileImageUrl.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block"
                              >
                                <img
                                  src={restaurantDetails.onboarding.step2.profileImageUrl.url}
                                  alt="Profile"
                                  className="w-32 h-32 rounded-lg object-cover border border-slate-200 hover:border-blue-500 transition-colors"
                                  onError={(e) => {
                                    e.target.src = "https://via.placeholder.com/128"
                                  }}
                                />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Onboarding Step 3 Details */}
                    {restaurantDetails?.onboarding?.step3 && (
                      <div className="pt-6 border-t border-slate-200">
                        <h4 className="text-lg font-semibold text-slate-900 mb-4">Registration Step 3 Details</h4>
                        <div className="space-y-6">

                          {/* FSSAI Details */}
                          {restaurantDetails.onboarding.step3.fssai && (
                            <div className="bg-slate-50 rounded-lg p-4">
                              <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                FSSAI Details
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                {restaurantDetails.onboarding.step3.fssai.fssaiNumber && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">FSSAI Number</p>
                                    <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step3.fssai.fssaiNumber}</p>
                                  </div>
                                )}
                                {restaurantDetails.onboarding.step3.fssai.fssaiExpiryDate && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Expiry Date</p>
                                    <p className="font-medium text-slate-900">{new Date(restaurantDetails.onboarding.step3.fssai.fssaiExpiryDate).toLocaleDateString()}</p>
                                  </div>
                                )}
                                {restaurantDetails.onboarding.step3.fssai.image?.url && (
                                  <div className="md:col-span-2">
                                    <p className="text-xs text-slate-500 mb-2">FSSAI Document</p>
                                    <a
                                      href={restaurantDetails.onboarding.step3.fssai.image.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                                    >
                                      <ImageIcon className="w-4 h-4" />
                                      <span>View FSSAI Document</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Bank Details */}
                          {restaurantDetails.onboarding.step3.bank && (
                            <div className="bg-slate-50 rounded-lg p-4">
                              <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                <CreditCard className="w-4 h-4" />
                                Bank Details
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                {restaurantDetails.onboarding.step3.bank.accountNumber && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Account Number</p>
                                    <p className="font-medium text-slate-900">
                                      {restaurantDetails.onboarding.step3.bank.accountNumber}
                                    </p>
                                  </div>
                                )}
                                {restaurantDetails.onboarding.step3.bank.ifscCode && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">IFSC Code</p>
                                    <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step3.bank.ifscCode}</p>
                                  </div>
                                )}
                                {restaurantDetails.onboarding.step3.bank.accountHolderName && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Account Holder Name</p>
                                    <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step3.bank.accountHolderName}</p>
                                  </div>
                                )}
                                {restaurantDetails.onboarding.step3.bank.accountType && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Account Type</p>
                                    <p className="font-medium text-slate-900 capitalize">{restaurantDetails.onboarding.step3.bank.accountType}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Pan Card Details */}
                          {restaurantDetails.onboarding.step3.pan && (
                            <div className="bg-slate-50 rounded-lg p-4">
                              <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Pan Card Details
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                {restaurantDetails.onboarding.step3.pan.panNumber && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Pan Number</p>
                                    <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step3.pan.panNumber}</p>
                                  </div>
                                )}
                                {restaurantDetails.onboarding.step3.pan.image?.url && (
                                  <div className="md:col-span-2">
                                    <p className="text-xs text-slate-500 mb-2">Pan Card Document</p>
                                    <a
                                      href={restaurantDetails.onboarding.step3.pan.image.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                                    >
                                      <ImageIcon className="w-4 h-4" />
                                      <span>View Pan Card Document</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                    )}

                    {/* Onboarding Step 4 Details */}
                    {restaurantDetails?.onboarding?.step4 && (
                      <div className="pt-6 border-t border-slate-200">
                        <h4 className="text-lg font-semibold text-slate-900 mb-4">Registration Step 4 Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {restaurantDetails.onboarding.step4.estimatedDeliveryTime && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Estimated Delivery Time (at registration)</p>
                              <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step4.estimatedDeliveryTime}</p>
                            </div>
                          )}
                          {restaurantDetails.onboarding.step4.distance && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Distance (at registration)</p>
                              <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step4.distance}</p>
                            </div>
                          )}
                          {restaurantDetails.onboarding.step4.featuredDish && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Featured Dish (at registration)</p>
                              <p className="font-medium text-slate-900">{restaurantDetails.onboarding.step4.featuredDish}</p>
                            </div>
                          )}
                          {restaurantDetails.onboarding.step4.offer && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Offer (at registration)</p>
                              <p className="font-medium text-green-600">{restaurantDetails.onboarding.step4.offer}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Additional Information */}
                    {(restaurantDetails?.slug || restaurantDetails?.restaurantId || restaurantDetails?.phoneVerified !== undefined || restaurantDetails?.signupMethod) && (
                      <div className="pt-6 border-t border-slate-200">
                        <h4 className="text-lg font-semibold text-slate-900 mb-4">Additional Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {restaurantDetails?.slug && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Slug</p>
                              <p className="font-medium text-slate-900">{restaurantDetails.slug}</p>
                            </div>
                          )}
                          {restaurantDetails?.restaurantId && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Restaurant ID</p>
                              <p className="font-medium text-slate-900">{formatRestaurantId(restaurantDetails.restaurantId)}</p>
                            </div>
                          )}
                          {restaurantDetails?.phoneVerified !== undefined && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Phone Verified</p>
                              <p className="font-medium text-slate-900">{restaurantDetails.phoneVerified ? "Yes" : "No"}</p>
                            </div>
                          )}
                          {restaurantDetails?.signupMethod && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Signup Method</p>
                              <p className="font-medium text-slate-900 capitalize">{restaurantDetails.signupMethod}</p>
                            </div>
                          )}
                          {restaurantDetails?.onboarding?.completedSteps !== undefined && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Onboarding Steps Completed</p>
                              <p className="font-medium text-slate-900">{restaurantDetails.onboarding.completedSteps} / 4</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!loadingDetails && !restaurantDetails && !selectedRestaurant && (
                  <div className="flex flex-col items-center justify-center py-20">
                    <p className="text-lg font-semibold text-slate-700 mb-2">No Details Available</p>
                    <p className="text-sm text-slate-500">Unable to load restaurant details</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Ban/Unban Confirmation Dialog */}
      {
        banConfirmDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={cancelBanRestaurant}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${banConfirmDialog.action === 'ban' ? 'bg-red-100' : 'bg-green-100'
                    }`}>
                    <AlertTriangle className={`w-6 h-6 ${banConfirmDialog.action === 'ban' ? 'text-red-600' : 'text-green-600'
                      }`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {banConfirmDialog.action === 'ban' ? 'Ban Restaurant' : 'Unban Restaurant'}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {banConfirmDialog.restaurant.name}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-700 mb-6">
                  {banConfirmDialog.action === 'ban'
                    ? 'Are you sure you want to ban this restaurant? They will not be able to receive orders or access their account.'
                    : 'Are you sure you want to unban this restaurant? They will be able to receive orders and access their account again.'
                  }
                </p>

                <div className="flex items-center gap-3">
                  <button
                    onClick={cancelBanRestaurant}
                    disabled={banning}
                    className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmBanRestaurant}
                    disabled={banning}
                    className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${banConfirmDialog.action === 'ban'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'
                      }`}
                  >
                    {banning ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {banConfirmDialog.action === 'ban' ? 'Banning...' : 'Unbanning...'}
                      </span>
                    ) : (
                      banConfirmDialog.action === 'ban' ? 'Ban Restaurant' : 'Unban Restaurant'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Delete Confirmation Dialog */}
      {
        deleteConfirmDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={cancelDeleteRestaurant}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Delete Restaurant</h3>
                    <p className="text-sm text-slate-600">
                      {deleteConfirmDialog.restaurant.name}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-700 mb-6">
                  Are you sure you want to delete this restaurant? This action cannot be undone and will permanently remove all restaurant data, including orders, menu items, and settings.
                </p>

                <div className="flex items-center gap-3">
                  <button
                    onClick={cancelDeleteRestaurant}
                    disabled={deleting}
                    className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteRestaurant}
                    disabled={deleting}
                    className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Deleting...
                      </span>
                    ) : (
                      "Delete Restaurant"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Send Email Dialog */}
      <Dialog open={emailDialog?.open || false} onOpenChange={(open) => {
        if (!open) {
          handleCloseEmailDialog()
        }
      }}>
        <DialogContent className="sm:max-w-2xl w-[95%] max-w-[650px] p-0 border-0 shadow-2xl bg-gradient-to-br from-white via-slate-50 to-white">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 px-6 py-5 rounded-t-lg">
            <DialogHeader className="mb-0">
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <span>Send Email to Restaurant</span>
              </DialogTitle>
              <p className="text-sm text-blue-100 mt-2 font-normal">
                Compose and send a custom email message to the restaurant
              </p>
            </DialogHeader>
          </div>

          {emailDialog?.restaurant && (
            <div className="px-6 py-6 space-y-6">
              {/* Restaurant Info Card */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-white shadow-md ring-2 ring-white flex-shrink-0">
                      <img
                        src={emailDialog.restaurant.logo || emailDialog.restaurant.originalData?.logo || emailDialog.restaurant.originalData?.profileImage?.url || "https://via.placeholder.com/64"}
                        alt={emailDialog.restaurant.name || "Restaurant"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = "https://via.placeholder.com/64"
                        }}
                      />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center">
                      <Mail className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4 text-slate-500" />
                      <p className="font-bold text-slate-900 text-base truncate">
                        {emailDialog.restaurant.name || "Restaurant"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <p className="text-sm text-slate-700 truncate">
                        {emailDialog.restaurant.email ||
                          emailDialog.restaurant.ownerEmail ||
                          emailDialog.restaurant.owner?.email ||
                          emailDialog.restaurant.originalData?.email ||
                          emailDialog.restaurant.originalData?.ownerEmail ||
                          emailDialog.restaurant.originalData?.onboarding?.step1?.ownerEmail ||
                          emailDialog.restaurant.originalData?.googleEmail ||
                          emailDialog.restaurant.googleEmail ||
                          "No email found"}
                      </p>
                    </div>
                    {!(emailDialog.restaurant.email ||
                      emailDialog.restaurant.ownerEmail ||
                      emailDialog.restaurant.owner?.email ||
                      emailDialog.restaurant.originalData?.email ||
                      emailDialog.restaurant.originalData?.ownerEmail ||
                      emailDialog.restaurant.originalData?.onboarding?.step1?.ownerEmail ||
                      emailDialog.restaurant.originalData?.googleEmail ||
                      emailDialog.restaurant.googleEmail) && (
                        <div className="mt-2 flex items-center gap-2 px-2 py-1 bg-amber-50 border border-amber-200 rounded-md">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <p className="text-xs text-amber-700 font-medium">
                            Email not found. Please add an email address to the restaurant profile.
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              </div>

              {/* Email Form */}
              <div className="space-y-5">
                {/* Subject Field */}
                <div className="space-y-2.5">
                  <Label htmlFor="email-subject" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500" />
                    Email Subject
                    <span className="text-red-500 font-bold">*</span>
                  </Label>
                  <Input
                    id="email-subject"
                    type="text"
                    placeholder="e.g., Important Update, Account Information, etc."
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    disabled={sendingEmail}
                    className="w-full h-11 border-slate-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg text-sm transition-all"
                  />
                  {!emailSubject.trim() && (
                    <p className="text-xs text-slate-500">Enter a clear and concise subject line</p>
                  )}
                </div>

                {/* Description Field */}
                <div className="space-y-2.5">
                  <Label htmlFor="email-description" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500" />
                    Email Message
                    <span className="text-red-500 font-bold">*</span>
                  </Label>
                  <Textarea
                    id="email-description"
                    placeholder="Write your message here. Be clear and professional in your communication..."
                    value={emailDescription}
                    onChange={(e) => setEmailDescription(e.target.value)}
                    disabled={sendingEmail}
                    rows={10}
                    className="w-full resize-none border-slate-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg text-sm transition-all"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      {emailDescription.length} characters
                    </p>
                    {!emailDescription.trim() && (
                      <p className="text-xs text-slate-500">Enter a detailed message for the restaurant</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer with Actions */}
          <DialogFooter className="px-6 py-4 bg-slate-50 border-t border-slate-200 rounded-b-lg flex gap-3">
            <Button
              variant="outline"
              onClick={handleCloseEmailDialog}
              disabled={sendingEmail}
              className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-medium"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={sendingEmail || !emailSubject.trim() || !emailDescription.trim()}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingEmail ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending Email...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Mail className="w-4 h-4" />
                  Send Email
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Restaurant Modal */}
      <Dialog open={!!editDialog?.open} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="max-w-2xl bg-white rounded-xl shadow-2xl p-0 overflow-hidden border-none cursor-default">
          <DialogHeader className="px-8 py-6 bg-gradient-to-r from-amber-600 to-amber-500 text-white">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                  <Edit className="w-6 h-6" />
                  Edit Restaurant
                </DialogTitle>
                <p className="text-amber-50 text-sm mt-1 opacity-90">
                  Update restaurant details and contact information
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="px-8 py-8 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {/* Restaurant Name */}
              <div className="space-y-2.5">
                <Label htmlFor="edit-name" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  Restaurant Name
                  <span className="text-red-500 font-bold">*</span>
                </Label>
                <Input
                  id="edit-name"
                  placeholder="Enter restaurant name"
                  value={editingData.name}
                  onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                  disabled={savingEdit}
                  className="w-full h-11 border-slate-300 focus:border-amber-500 focus:ring-amber-500 rounded-lg text-sm transition-all shadow-sm"
                />
              </div>

              {/* Restaurant Phone */}
              <div className="space-y-2.5">
                <Label htmlFor="edit-phone" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-500" />
                  Restaurant Phone
                  <span className="text-red-500 font-bold">*</span>
                </Label>
                <Input
                  id="edit-phone"
                  placeholder="Enter phone number"
                  value={editingData.phone}
                  onChange={(e) => setEditingData({ ...editingData, phone: e.target.value })}
                  disabled={savingEdit}
                  className="w-full h-11 border-slate-300 focus:border-amber-500 focus:ring-amber-500 rounded-lg text-sm transition-all shadow-sm"
                />
              </div>

              {/* Restaurant Email */}
              <div className="space-y-2.5">
                <Label htmlFor="edit-email" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-500" />
                  Restaurant Email
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  placeholder="Enter email address"
                  value={editingData.email}
                  onChange={(e) => setEditingData({ ...editingData, email: e.target.value })}
                  disabled={savingEdit}
                  className="w-full h-11 border-slate-300 focus:border-amber-500 focus:ring-amber-500 rounded-lg text-sm transition-all shadow-sm"
                />
              </div>

              {/* Owner Name */}
              <div className="space-y-2.5">
                <Label htmlFor="edit-owner-name" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-500" />
                  Owner Name
                </Label>
                <Input
                  id="edit-owner-name"
                  placeholder="Enter owner name"
                  value={editingData.ownerName}
                  onChange={(e) => setEditingData({ ...editingData, ownerName: e.target.value })}
                  disabled={savingEdit}
                  className="w-full h-11 border-slate-300 focus:border-amber-500 focus:ring-amber-500 rounded-lg text-sm transition-all shadow-sm"
                />
              </div>

              {/* Owner Phone */}
              <div className="space-y-2.5">
                <Label htmlFor="edit-owner-phone" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-500" />
                  Owner Phone
                </Label>
                <Input
                  id="edit-owner-phone"
                  placeholder="Enter owner phone"
                  value={editingData.ownerPhone}
                  onChange={(e) => setEditingData({ ...editingData, ownerPhone: e.target.value })}
                  disabled={savingEdit}
                  className="w-full h-11 border-slate-300 focus:border-amber-500 focus:ring-amber-500 rounded-lg text-sm transition-all shadow-sm"
                />
              </div>

              {/* Owner Email */}
              <div className="space-y-2.5">
                <Label htmlFor="edit-owner-email" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-500" />
                  Owner Email
                </Label>
                <Input
                  id="edit-owner-email"
                  type="email"
                  placeholder="Enter owner email"
                  value={editingData.ownerEmail}
                  onChange={(e) => setEditingData({ ...editingData, ownerEmail: e.target.value })}
                  disabled={savingEdit}
                  className="w-full h-11 border-slate-300 focus:border-amber-500 focus:ring-amber-500 rounded-lg text-sm transition-all shadow-sm"
                />
              </div>

              {/* Opening Time */}
              <div className="space-y-2.5">
                <Label htmlFor="edit-opening-time" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  Opening Time
                </Label>
                <Input
                  id="edit-opening-time"
                  type="time"
                  value={editingData.openingTime || ''}
                  onChange={(e) => setEditingData({ ...editingData, openingTime: e.target.value })}
                  disabled={savingEdit}
                  className="w-full h-11 border-slate-300 focus:border-amber-500 focus:ring-amber-500 rounded-lg text-sm transition-all shadow-sm"
                />
              </div>

              {/* Closing Time */}
              <div className="space-y-2.5">
                <Label htmlFor="edit-closing-time" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  Closing Time
                </Label>
                <Input
                  id="edit-closing-time"
                  type="time"
                  value={editingData.closingTime || ''}
                  onChange={(e) => setEditingData({ ...editingData, closingTime: e.target.value })}
                  disabled={savingEdit}
                  className="w-full h-11 border-slate-300 focus:border-amber-500 focus:ring-amber-500 rounded-lg text-sm transition-all shadow-sm"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-8 py-5 bg-slate-50 border-t border-slate-200 flex gap-4">
            <Button
              variant="outline"
              onClick={() => setEditDialog(null)}
              disabled={savingEdit}
              className="flex-1 h-11 border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRestaurant}
              disabled={savingEdit}
              className="flex-1 h-11 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white font-bold shadow-md hover:shadow-lg transition-all rounded-lg"
            >
              {savingEdit ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Settings className="w-4 h-4" />
                  Update Details
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  )
}

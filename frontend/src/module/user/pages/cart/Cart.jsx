import { useState, useEffect, useRef, useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Plus, Minus, ArrowLeft, ChevronRight, Clock, MapPin, Phone, FileText, Utensils, Tag, Percent, Truck, Leaf, Share2, ChevronUp, X, Check, Settings, CreditCard, Building2, Sparkles, Banknote, Edit2, Trash2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import confetti from "canvas-confetti"

import AnimatedPage from "../../components/AnimatedPage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCart } from "../../context/CartContext"
import { useProfile } from "../../context/ProfileContext"
import { useOrders } from "../../context/OrdersContext"
import { useLocation as useUserLocation } from "../../hooks/useLocation"
import { useZone } from "../../hooks/useZone"
import { useLocationSelector } from "../../components/UserLayout"
import { orderAPI, restaurantAPI, adminAPI, userAPI, API_ENDPOINTS } from "@/lib/api"
import { API_BASE_URL } from "@/lib/api/config"
import { initRazorpayPayment } from "@/lib/utils/razorpay"
import { toast } from "sonner"
import AddressFormModal from "../../components/AddressFormModal"



// Removed hardcoded suggested items - now fetching approved addons from backend
// Coupons will be fetched from backend based on items in cart

/**
 * Format full address string from address object
 * @param {Object} address - Address object with street, additionalDetails, city, state, zipCode, or formattedAddress
 * @returns {String} Formatted address string
 */
const formatFullAddress = (address) => {
  if (!address) return ""

  // IF STREET (BUILDING NAME) IS PRESENT, ALWAYS USE PARTS TO ENSURE EDITS SHOW
  if (address.street) {
    const addressParts = []
    if (address.street) addressParts.push(address.street)
    if (address.additionalDetails) addressParts.push(address.additionalDetails)
    if (address.city) addressParts.push(address.city)
    if (address.state) addressParts.push(address.state)
    if (address.zipCode) addressParts.push(address.zipCode)
    return addressParts.filter(Boolean).join(', ')
  }

  // Priority 2: Use formattedAddress if available (for live location addresses)
  if (address.formattedAddress && address.formattedAddress !== "Select location") {
    return address.formattedAddress
  }

  // Priority 3: Use address field if available
  if (address.address && address.address !== "Select location") {
    return address.address
  }

  return ""
}



export default function Cart() {
  const navigate = useNavigate()

  // Defensive check: Ensure CartProvider is available
  let cartContext;
  try {
    cartContext = useCart();
  } catch (error) {
    console.error('❌ CartProvider not found. Make sure Cart component is rendered within UserLayout.');
    // Return early with error message
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] dark:bg-[#0a0a0a]">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Cart Error</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Cart functionality is not available. Please refresh the page.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const { cart, updateQuantity, addToCart, getCartCount, clearCart, cleanCartForRestaurant } = cartContext;
  const { getDefaultAddress, getDefaultPaymentMethod, addresses, paymentMethods, userProfile, deleteAddress, loading: profileLoading } = useProfile()
  const { createOrder } = useOrders()
  const { location: currentLocation, updateLocation } = useUserLocation() // Get live location address
  const { openLocationSelector } = useLocationSelector()
  const { zoneId } = useZone(currentLocation) // Get user's zone

  const [showCoupons, setShowCoupons] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponCode, setCouponCode] = useState("")
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("razorpay") // razorpay | cash
  const [deliveryFleet, setDeliveryFleet] = useState("standard")
  const [showFleetOptions, setShowFleetOptions] = useState(false)
  const [note, setNote] = useState("")
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [sendCutlery, setSendCutlery] = useState(true)
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [showBillDetails, setShowBillDetails] = useState(false)
  const [showPlacingOrder, setShowPlacingOrder] = useState(false)
  const [orderProgress, setOrderProgress] = useState(0)
  const [showOrderSuccess, setShowOrderSuccess] = useState(false)
  const [placedOrderId, setPlacedOrderId] = useState(null)
  const [showPaymentSheet, setShowPaymentSheet] = useState(false)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [addressToEdit, setAddressToEdit] = useState(null)
  const [addressToDelete, setAddressToDelete] = useState(null)

  // Restaurant and pricing state
  const [restaurantData, setRestaurantData] = useState(null)
  const [loadingRestaurant, setLoadingRestaurant] = useState(false)
  const [pricing, setPricing] = useState(null)
  const [loadingPricing, setLoadingPricing] = useState(false)

  // Addons state
  const [addons, setAddons] = useState([])
  const [loadingAddons, setLoadingAddons] = useState(false)

  // Coupons state - fetched from backend
  const [availableCoupons, setAvailableCoupons] = useState([])
  const [loadingCoupons, setLoadingCoupons] = useState(false)

  // Fee settings from database (used as fallback if pricing not available)
  const [feeSettings, setFeeSettings] = useState({
    deliveryFee: 0, // Will be set from admin settings
    freeDeliveryThreshold: 149,
    platformFee: 5,
    gstRate: 5,
    deliveryFeeRanges: [],
  })


  const cartCount = getCartCount()
  const savedAddress = getDefaultAddress()

  // Priority: Use manual selection if available, otherwise use default saved address
  const defaultAddress = useMemo(() => {
    // If we have a manual selection (from overlay or labels), prioritize it
    if (currentLocation?.formattedAddress && currentLocation.formattedAddress !== "Select location") {
      // Find matching saved address to enrich with label/ID if possible
      const matchingSaved = addresses.find(addr =>
        (currentLocation.id && (addr.id === currentLocation.id || addr._id === currentLocation.id)) ||
        (currentLocation.addressId && (addr.id === currentLocation.addressId || addr._id === currentLocation.addressId)) ||
        (addr.label && currentLocation.label && addr.label === currentLocation.label)
      );

      const combined = {
        ...savedAddress,
        ...matchingSaved,
        ...currentLocation,
        // Ensure core identifiers and labels are preserved from the best source
        id: currentLocation.id || currentLocation.addressId || matchingSaved?.id || matchingSaved?._id || savedAddress?.id,
        label: matchingSaved?.label || currentLocation.label || savedAddress?.label,
        formattedAddress: currentLocation.formattedAddress,
        address: currentLocation.address || currentLocation.formattedAddress,
        street: currentLocation.street || currentLocation.address || matchingSaved?.street || savedAddress?.street || "",
        city: currentLocation.city || matchingSaved?.city || savedAddress?.city || "",
        state: currentLocation.state || matchingSaved?.state || savedAddress?.state || "",
        zipCode: currentLocation.zipCode || currentLocation.postalCode || matchingSaved?.zipCode || savedAddress?.zipCode || "",
        area: currentLocation.area || matchingSaved?.area || savedAddress?.area || "",
        additionalDetails: currentLocation.additionalDetails || currentLocation.area || (currentLocation.isManual ? "" : (matchingSaved?.additionalDetails || savedAddress?.additionalDetails)),
        location: currentLocation.latitude && currentLocation.longitude ? {
          type: 'Point',
          coordinates: [currentLocation.longitude, currentLocation.latitude]
        } : (matchingSaved?.location || savedAddress?.location)
      };
      return combined;
    }

    return savedAddress
  }, [currentLocation, savedAddress, addresses])

  const defaultPayment = getDefaultPaymentMethod()

  // Identify which address label is active for visual feedback
  const activeAddressLabel = useMemo(() => {
    if (!defaultAddress) return null;
    return defaultAddress.label || null;
  }, [defaultAddress]);



  // Get restaurant ID from cart or restaurant data
  // Priority: restaurantData > cart[0].restaurantId
  // DO NOT use cart[0].restaurant as slug fallback - it creates wrong slugs
  const restaurantId = cart.length > 0
    ? (restaurantData?._id || restaurantData?.restaurantId || cart[0]?.restaurantId || null)
    : null

  // Stable restaurant ID for addons fetch (memoized to prevent dependency array issues)
  // Prefer restaurantData IDs (more reliable) over slug from cart
  const restaurantIdForAddons = useMemo(() => {
    // Only use restaurantData if it's loaded, otherwise wait
    if (restaurantData) {
      return restaurantData._id || restaurantData.restaurantId || null
    }
    // If restaurantData is not loaded yet, return null to wait
    return null
  }, [restaurantData])

  // --- AUTO-SELECT FIX ---
  // Auto-select the default address if none is currently selected in the UI
  // This ensures the red checkmark appears on the first load if an address exists.
  useEffect(() => {
    // If we have saved addresses but nothing is explicitly selected (no id in currentLocation)
    // and we have a default saved address, select it automatically
    // This solves the issue of user "not knowing" which address is used.
    if (!loadingRestaurant && addresses && addresses.length > 0 &&
      !currentLocation?.id && !currentLocation?.addressId &&
      savedAddress && savedAddress.id) {

      console.log("📍 [AUTO-SELECT] Synchronizing currentLocation with default saved address");
      handleSelectAddress(savedAddress);
    }
  }, [addresses, currentLocation?.id, currentLocation?.addressId, savedAddress, loadingRestaurant]);



  // Lock body scroll and scroll to top when any full-screen modal opens
  useEffect(() => {
    if (showPlacingOrder || showOrderSuccess) {
      // Lock body scroll
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
      document.body.style.top = `-${window.scrollY}px`

      // Scroll window to top
      window.scrollTo({ top: 0, behavior: 'instant' })
    } else {
      // Restore body scroll
      const scrollY = document.body.style.top
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1)
      }
    }

    return () => {
      // Cleanup on unmount
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
    }
  }, [showPlacingOrder, showOrderSuccess])

  // Fetch restaurant data when cart has items
  useEffect(() => {
    const fetchRestaurantData = async () => {
      if (cart.length === 0) {
        setRestaurantData(null)
        return
      }

      // If we already have restaurantData, don't fetch again
      if (restaurantData) {
        return
      }

      setLoadingRestaurant(true)

      // Strategy 1: Try using restaurantId from cart if available
      if (cart[0]?.restaurantId) {
        try {
          const cartRestaurantId = cart[0].restaurantId;
          const cartRestaurantName = cart[0].restaurant;

          console.log("🔄 Fetching restaurant data by restaurantId from cart:", cartRestaurantId)
          const response = await restaurantAPI.getRestaurantById(cartRestaurantId)
          const data = response?.data?.data?.restaurant || response?.data?.restaurant

          if (data) {
            // CRITICAL: Validate that fetched restaurant matches cart items
            const fetchedRestaurantId = data.restaurantId || data._id?.toString();
            const fetchedRestaurantName = data.name;

            // Check if restaurantId matches
            const restaurantIdMatches =
              fetchedRestaurantId === cartRestaurantId ||
              data._id?.toString() === cartRestaurantId ||
              data.restaurantId === cartRestaurantId;

            // Check if restaurant name matches (if available in cart)
            const restaurantNameMatches =
              !cartRestaurantName ||
              fetchedRestaurantName?.toLowerCase().trim() === cartRestaurantName.toLowerCase().trim();

            if (!restaurantIdMatches) {
              console.error('❌ CRITICAL: Fetched restaurant ID does not match cart restaurantId!', {
                cartRestaurantId: cartRestaurantId,
                fetchedRestaurantId: fetchedRestaurantId,
                fetched_id: data._id?.toString(),
                fetched_restaurantId: data.restaurantId,
                cartRestaurantName: cartRestaurantName,
                fetchedRestaurantName: fetchedRestaurantName
              });
              // Don't set restaurantData if IDs don't match - this prevents wrong restaurant assignment
              setLoadingRestaurant(false);
              return;
            }

            if (!restaurantNameMatches) {
              console.warn('⚠️ WARNING: Restaurant name mismatch:', {
                cartRestaurantName: cartRestaurantName,
                fetchedRestaurantName: fetchedRestaurantName
              });
              // Still proceed but log warning
            }

            console.log("✅ Restaurant data loaded from cart restaurantId:", {
              _id: data._id,
              restaurantId: data.restaurantId,
              name: data.name,
              cartRestaurantId: cartRestaurantId,
              cartRestaurantName: cartRestaurantName
            })
            setRestaurantData(data)
            setLoadingRestaurant(false)
            return
          }
        } catch (error) {
          console.warn("⚠️ Failed to fetch by cart restaurantId, trying fallback...", error)
        }
      }

      // Strategy 2: If no restaurantId in cart, search by restaurant name
      if (cart[0]?.restaurant && !restaurantData) {
        try {
          console.log("🔍 Searching restaurant by name:", cart[0].restaurant)
          const searchResponse = await restaurantAPI.getRestaurants({ limit: 100 })
          const restaurants = searchResponse?.data?.data?.restaurants || searchResponse?.data?.data || []
          console.log("📋 Fetched", restaurants.length, "restaurants for name search")

          // Try exact match first
          let matchingRestaurant = restaurants.find(r =>
            r.name?.toLowerCase().trim() === cart[0].restaurant?.toLowerCase().trim()
          )

          // If no exact match, try partial match
          if (!matchingRestaurant) {
            console.log("🔍 No exact match, trying partial match...")
            matchingRestaurant = restaurants.find(r =>
              r.name?.toLowerCase().includes(cart[0].restaurant?.toLowerCase().trim()) ||
              cart[0].restaurant?.toLowerCase().trim().includes(r.name?.toLowerCase())
            )
          }

          if (matchingRestaurant) {
            // CRITICAL: Validate that the found restaurant matches cart items
            const cartRestaurantName = cart[0]?.restaurant?.toLowerCase().trim();
            const foundRestaurantName = matchingRestaurant.name?.toLowerCase().trim();

            if (cartRestaurantName && foundRestaurantName && cartRestaurantName !== foundRestaurantName) {
              console.error("❌ CRITICAL: Restaurant name mismatch!", {
                cartRestaurantName: cart[0]?.restaurant,
                foundRestaurantName: matchingRestaurant.name,
                cartRestaurantId: cart[0]?.restaurantId,
                foundRestaurantId: matchingRestaurant.restaurantId || matchingRestaurant._id
              });
              // Don't set restaurantData if names don't match - this prevents wrong restaurant assignment
              setLoadingRestaurant(false);
              return;
            }

            console.log("✅ Found restaurant by name:", {
              name: matchingRestaurant.name,
              _id: matchingRestaurant._id,
              restaurantId: matchingRestaurant.restaurantId,
              slug: matchingRestaurant.slug,
              cartRestaurantName: cart[0]?.restaurant
            })
            setRestaurantData(matchingRestaurant)
            setLoadingRestaurant(false)
            return
          } else {
            console.warn("⚠️ Restaurant not found even by name search. Searched in", restaurants.length, "restaurants")
            if (restaurants.length > 0) {
              console.log("📋 Available restaurant names:", restaurants.map(r => r.name).slice(0, 10))
            }
          }
        } catch (searchError) {
          console.warn("⚠️ Error searching restaurants by name:", searchError)
        }
      }

      // If all strategies fail, set to null
      setRestaurantData(null)
      setLoadingRestaurant(false)
    }

    fetchRestaurantData()
  }, [cart.length, cart[0]?.restaurantId, cart[0]?.restaurant])

  // Fetch approved addons for the restaurant
  useEffect(() => {
    const fetchAddonsWithId = async (idToUse) => {

      console.log("🔍 Addons fetch - Using ID:", {
        restaurantData: restaurantData ? {
          _id: restaurantData._id,
          restaurantId: restaurantData.restaurantId,
          name: restaurantData.name
        } : 'Not loaded',
        cartRestaurantId: restaurantId,
        idToUse: idToUse
      })

      // Convert to string for validation
      const idString = String(idToUse)
      console.log("🔍 Restaurant ID string:", idString, "Type:", typeof idString, "Length:", idString.length)

      // Validate ID format (should be ObjectId or restaurantId format)
      const isValidIdFormat = /^[a-zA-Z0-9\-_]+$/.test(idString) && idString.length >= 3

      if (!isValidIdFormat) {
        console.warn("⚠️ Restaurant ID format invalid:", idString)
        setAddons([])
        return
      }

      try {
        setLoadingAddons(true)
        console.log("🚀 Fetching addons for restaurant ID:", idString)
        const response = await restaurantAPI.getAddonsByRestaurantId(idString)
        console.log("✅ Addons API response received:", response?.data)
        console.log("📦 Response structure:", {
          success: response?.data?.success,
          data: response?.data?.data,
          addons: response?.data?.data?.addons,
          directAddons: response?.data?.addons
        })

        const data = response?.data?.data?.addons || response?.data?.addons || []
        console.log("📊 Fetched addons count:", data.length)
        console.log("📋 Fetched addons data:", JSON.stringify(data, null, 2))

        if (data.length === 0) {
          console.warn("⚠️ No addons returned from API. Response:", response?.data)
        } else {
          console.log("✅ Successfully fetched", data.length, "addons:", data.map(a => a.name))
        }

        setAddons(data)
      } catch (error) {
        // Log error for debugging
        console.error("❌ Addons fetch error:", {
          code: error.code,
          status: error.response?.status,
          message: error.message,
          url: error.config?.url,
          data: error.response?.data
        })
        // Silently handle network errors and 404 errors
        // Network errors (ERR_NETWORK) happen when backend is not running - this is OK for development
        // 404 errors mean restaurant might not have addons or restaurant not found - also OK
        if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404) {
          console.error("Error fetching addons:", error)
        }
        // Continue with cart even if addons fetch fails
        setAddons([])
      } finally {
        setLoadingAddons(false)
      }
    }

    const fetchAddons = async () => {
      if (cart.length === 0) {
        setAddons([])
        return
      }

      // Wait for restaurantData to be loaded (including fallback search)
      if (loadingRestaurant) {
        console.log("⏳ Waiting for restaurantData to load (including fallback search)...")
        return
      }

      // Must have restaurantData to fetch addons
      if (!restaurantData) {
        console.warn("⚠️ No restaurantData available for addons fetch")
        setAddons([])
        return
      }

      // Use restaurantData ID (most reliable)
      const idToUse = restaurantData._id || restaurantData.restaurantId
      if (!idToUse) {
        console.warn("⚠️ No valid restaurant ID in restaurantData")
        setAddons([])
        return
      }

      console.log("✅ Using restaurantData ID for addons:", idToUse)
      fetchAddonsWithId(idToUse)
    }

    fetchAddons()
  }, [restaurantData, cart.length, loadingRestaurant])

  // Fetch coupons for items in cart
  useEffect(() => {
    const fetchCouponsForCartItems = async () => {
      if (cart.length === 0 || !restaurantId) {
        setAvailableCoupons([])
        return
      }

      console.log(`[CART-COUPONS] Fetching coupons for ${cart.length} items in cart`)
      setLoadingCoupons(true)

      const allCoupons = []
      const uniqueCouponCodes = new Set()

      // Fetch coupons for each item in cart
      for (const cartItem of cart) {
        if (!cartItem.id) {
          console.log(`[CART-COUPONS] Skipping item without id:`, cartItem)
          continue
        }

        try {
          console.log(`[CART-COUPONS] Fetching coupons for itemId: ${cartItem.id}, name: ${cartItem.name}`)
          const response = await restaurantAPI.getCouponsByItemIdPublic(restaurantId, cartItem.id)

          if (response?.data?.success && response?.data?.data?.coupons) {
            const coupons = response.data.data.coupons
            console.log(`[CART-COUPONS] Found ${coupons.length} coupons for item ${cartItem.id}`)

            // Add coupons, avoiding duplicates
            coupons.forEach(coupon => {
              if (!uniqueCouponCodes.has(coupon.couponCode)) {
                uniqueCouponCodes.add(coupon.couponCode)
                // Convert backend coupon format to frontend format
                allCoupons.push({
                  code: coupon.couponCode,
                  discount: coupon.originalPrice - coupon.discountedPrice,
                  discountPercentage: coupon.discountPercentage,
                  minOrder: coupon.minOrderValue || 0,
                  description: `Save ₹${coupon.originalPrice - coupon.discountedPrice} with '${coupon.couponCode}'`,
                  originalPrice: coupon.originalPrice,
                  discountedPrice: coupon.discountedPrice,
                  itemId: cartItem.id,
                  itemName: cartItem.name,
                })
              }
            })
          }
        } catch (error) {
          console.error(`[CART-COUPONS] Error fetching coupons for item ${cartItem.id}:`, error)
        }
      }

      console.log(`[CART-COUPONS] Total unique coupons found: ${allCoupons.length}`, allCoupons)
      setAvailableCoupons(allCoupons)
      setLoadingCoupons(false)
    }

    fetchCouponsForCartItems()
  }, [cart, restaurantId])

  // Fetch fee settings function (reusable)
  const fetchFeeSettings = async () => {
    try {
      const response = await adminAPI.getPublicFeeSettings()
      if (response.data.success && response.data.data.feeSettings) {
        const settings = response.data.data.feeSettings
        setFeeSettings({
          deliveryFee: settings.deliveryFee ?? 0, // Use admin value, 0 if not set
          freeDeliveryThreshold: settings.freeDeliveryThreshold ?? 149,
          platformFee: settings.platformFee ?? 5,
          gstRate: settings.gstRate ?? 5,
          deliveryFeeRanges: settings.deliveryFeeRanges || [],
        })
      }
    } catch (error) {
      console.error('Error fetching fee settings:', error)
      // Keep default values on error
    }
  }

  // Fetch fee settings on mount
  useEffect(() => {
    fetchFeeSettings()
  }, [])

  // Calculate pricing from backend whenever cart, address, or coupon changes
  useEffect(() => {
    const calculatePricing = async () => {
      if (cart.length === 0 || !defaultAddress) {
        setPricing(null)
        return
      }

      try {
        setLoadingPricing(true)

        // Re-fetch fee settings to get latest admin updates
        await fetchFeeSettings()

        const items = cart.map(item => ({
          itemId: item.id,
          name: item.name,
          price: item.price, // Price should already be in INR
          quantity: item.quantity || 1,
          image: item.image,
          description: item.description,
          isVeg: item.isVeg !== false
        }))

        const response = await orderAPI.calculateOrder({
          items,
          restaurantId: restaurantData?.restaurantId || restaurantData?._id || restaurantId || null,
          deliveryAddress: defaultAddress,
          couponCode: appliedCoupon?.code || couponCode || null,
          deliveryFleet: deliveryFleet || 'standard'
        })

        if (response?.data?.success && response?.data?.data?.pricing) {
          setPricing(response.data.data.pricing)

          // Update applied coupon if backend returns one
          if (response.data.data.pricing.appliedCoupon && !appliedCoupon) {
            const coupon = availableCoupons.find(c => c.code === response.data.data.pricing.appliedCoupon.code)
            if (coupon) {
              setAppliedCoupon(coupon)
            }
          }
        }
      } catch (error) {
        // Network errors or 404 errors - silently handle, fallback to frontend calculation
        if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404) {
          console.error("Error calculating pricing:", error)
        }
        // Fallback to frontend calculation if backend fails
        setPricing(null)
      } finally {
        setLoadingPricing(false)
      }
    }

    calculatePricing()
  }, [cart, defaultAddress, appliedCoupon, couponCode, deliveryFleet, restaurantId])

  // Calculate delivery fee based on ranges (same logic as backend)
  const calculateDeliveryFeeFromRanges = (orderValue, settings) => {
    // Priority 1: Check if delivery fee ranges are configured
    if (settings.deliveryFeeRanges && Array.isArray(settings.deliveryFeeRanges) && settings.deliveryFeeRanges.length > 0) {
      // Sort ranges by min value to ensure proper checking
      const sortedRanges = [...settings.deliveryFeeRanges].sort((a, b) => a.min - b.min);

      console.log('Checking ranges for order value:', orderValue, 'Ranges:', sortedRanges);

      // Find matching range (orderValue >= min && orderValue < max)
      for (let i = 0; i < sortedRanges.length; i++) {
        const range = sortedRanges[i];
        const isLastRange = i === sortedRanges.length - 1;

        if (isLastRange) {
          if (orderValue >= range.min && orderValue <= range.max) {
            console.log('Matched last range:', range, 'Fee:', range.fee);
            return range.fee; // Return the fee from range (even if it's 0)
          }
        } else {
          if (orderValue >= range.min && orderValue < range.max) {
            console.log('Matched range:', range, 'Fee:', range.fee);
            return range.fee; // Return the fee from range (even if it's 0)
          }
        }
      }
      console.log('No range matched for order value:', orderValue);
      // If we reach here, no range matched - continue to next priority
    }

    // Priority 2: Use admin settings for free delivery threshold (only if no ranges matched)
    if (orderValue >= settings.freeDeliveryThreshold) {
      console.log('Using free delivery threshold, returning 0');
      return 0;
    }

    // Priority 3: Default delivery fee from admin settings
    console.log('Using default delivery fee:', settings.deliveryFee);
    return settings.deliveryFee ?? 0;
  }

  // Use frontend calculation for subtotal to ensure immediate updates when quantity changes
  // Stale pricing from backend causes lag/mismatch
  const subtotal = cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0)

  // Calculate delivery fee: prioritize frontend calculation from ranges if ranges exist
  // Only use backend pricing if no ranges are configured or if backend explicitly returns a non-zero value
  const calculatedDeliveryFee = calculateDeliveryFeeFromRanges(subtotal, feeSettings)

  // If ranges are configured, use frontend calculation (ranges take priority)
  // Otherwise, use backend pricing if available
  const hasRanges = feeSettings.deliveryFeeRanges && feeSettings.deliveryFeeRanges.length > 0;
  const deliveryFee = hasRanges
    ? (appliedCoupon?.freeDelivery ? 0 : calculatedDeliveryFee)
    : (pricing?.deliveryFee ?? (appliedCoupon?.freeDelivery ? 0 : calculatedDeliveryFee))

  const platformFee = Math.round(pricing?.platformFee || feeSettings.platformFee || 5)
  // GST should be calculated on subtotal after discount (matching backend logic)
  const discount = pricing?.discount || (appliedCoupon ? Math.min(appliedCoupon.discount, subtotal * 0.5) : 0)
  const taxableAmount = subtotal - discount

  // Always calculate GST on frontend to ensure it matches the current subtotal
  // Stale pricing.tax allows old tax amount to persist after subtotal change
  const gstCharges = Math.round(taxableAmount * ((feeSettings.gstRate || 5) / 100))

  const totalBeforeDiscount = subtotal + deliveryFee + platformFee + gstCharges

  // Always calculate total on frontend
  // pricing?.total is removed to prevent stale total from showing
  const total = Math.round(totalBeforeDiscount - discount)

  // Verify calculation matches
  const calculatedTotal = Math.round(subtotal + deliveryFee + platformFee + gstCharges - discount)
  if (Math.abs(total - calculatedTotal) > 1 && import.meta.env.DEV) {
    console.warn('⚠️ [CART CALCULATION MISMATCH]', {
      subtotal,
      deliveryFee,
      platformFee,
      gstCharges,
      discount,
      totalBeforeDiscount,
      expectedTotal: calculatedTotal,
      actualTotal: total,
      difference: total - calculatedTotal
    })
  }

  // Debug: Log calculation breakdown
  if (import.meta.env.DEV) {
    console.log('💰 [CART CALCULATION]', {
      subtotal,
      deliveryFee,
      platformFee,
      gstCharges,
      discount,
      taxableAmount,
      totalBeforeDiscount,
      total,
      calculatedTotal,
      calculation: `${subtotal} + ${deliveryFee} + ${platformFee} + ${gstCharges} - ${discount} = ${total}`
    })
  }
  const savings = pricing?.savings || (discount + (subtotal > 500 ? 32 : 0))

  // Restaurant name from data or cart
  const restaurantName = restaurantData?.name || cart[0]?.restaurant || "Restaurant"

  const handleEditAddress = (e, address) => {
    e.stopPropagation()
    setAddressToEdit(address)
    setShowAddressForm(true)
  }

  const handleDeleteAddress = (e, addressId) => {
    e.stopPropagation()
    setAddressToDelete(addressId)
  }

  const confirmDeleteAddress = async () => {
    if (!addressToDelete) return
    try {
      await deleteAddress(addressToDelete)
      toast.success("Address deleted successfully")
    } catch (error) {
      toast.error("Failed to delete address")
    } finally {
      setAddressToDelete(null)
    }
  }
  const handleSelectAddress = async (address) => {
    try {
      if (!address) {
        toast.error(`Invalid address selected`)
        return
      }

      // Get coordinates from address location
      const coordinates = address.location?.coordinates || []
      const longitude = coordinates[0]
      const latitude = coordinates[1]

      // Format location data
      const street = address.street || ""
      const city = address.city || ""
      const state = address.state || ""
      const area = address.additionalDetails || ""
      const zipCode = address.zipCode || ""

      const formattedAddr = area
        ? `${area}, ${street}, ${city}, ${state}, ${zipCode}`
        : `${street}, ${city}, ${state}, ${zipCode}`

      // Create local location data object
      const locationData = {
        city,
        state,
        address: `${street}, ${city}`,
        area,
        zipCode,
        latitude,
        longitude,
        formattedAddress: formattedAddr,
        id: address.id || address._id, // Store ID to keep selection active
        label: address.label,
        isManual: true,
        timestamp: Date.now()
      }

      // --- OPTIMISTIC UI: Update local state INSTANTLY ---
      // This removes the "Lag" or "Loading" feeling
      localStorage.setItem("userLocation", JSON.stringify(locationData))
      updateLocation(locationData)
      toast.success(`Address selected!`, { id: "address-selection" })

      // --- BACKGROUND SYNC: Update backend without blocking UI ---
      // We don't await this to keep the UI snappy
      userAPI.updateLocation({
        latitude,
        longitude,
        address: `${street}, ${city}`,
        city,
        state,
        area,
        zipCode,
        formattedAddress: formattedAddr
      }).catch(err => {
        console.warn("⚠️ Background location update failed:", err.message)
        // We don't show an error toast here to avoid confusing the user
        // since the local state is already set and consistent.
      });

    } catch (error) {
      console.error(`Error selecting address:`, error)
      toast.error(`Failed to select address. Please try again.`)
    }
  }

  const handleApplyCoupon = async (coupon) => {
    if (subtotal >= coupon.minOrder) {
      setAppliedCoupon(coupon)
      setCouponCode(coupon.code)
      setShowCoupons(false)

      // Recalculate pricing with new coupon
      if (cart.length > 0 && defaultAddress) {
        try {
          const items = cart.map(item => ({
            itemId: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1,
            image: item.image,
            description: item.description,
            isVeg: item.isVeg !== false
          }))

          const response = await orderAPI.calculateOrder({
            items,
            restaurantId: restaurantData?.restaurantId || restaurantData?._id || restaurantId || null,
            deliveryAddress: defaultAddress,
            couponCode: coupon.code,
            deliveryFleet: deliveryFleet || 'standard'
          })

          if (response?.data?.success && response?.data?.data?.pricing) {
            setPricing(response.data.data.pricing)
          }
        } catch (error) {
          console.error("Error recalculating pricing:", error)
        }
      }
    }
  }


  const handleRemoveCoupon = async () => {
    setAppliedCoupon(null)
    setCouponCode("")

    // Recalculate pricing without coupon
    if (cart.length > 0 && defaultAddress) {
      try {
        const items = cart.map(item => ({
          itemId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1,
          image: item.image,
          description: item.description,
          isVeg: item.isVeg !== false,
          itemSize: item.itemSize || "",
          itemSizeQuantity: item.itemSizeQuantity || "",
          itemSizeUnit: item.itemSizeUnit || ""
        }))

        const response = await orderAPI.calculateOrder({
          items,
          restaurantId: restaurantData?.restaurantId || restaurantData?._id || restaurantId || null,
          deliveryAddress: defaultAddress,
          couponCode: null,
          deliveryFleet: deliveryFleet || 'standard'
        })

        if (response?.data?.success && response?.data?.data?.pricing) {
          setPricing(response.data.data.pricing)
        }
      } catch (error) {
        console.error("Error recalculating pricing:", error)
      }
    }
  }


  const handlePlaceOrder = async (methodOverride = null) => {
    const finalPaymentMethod = methodOverride || selectedPaymentMethod;

    // --- STRICT ADDRESS VALIDATION ---
    // Ensure both defaultAddress (data) and currentLocation.id (UI selection highlight) are consistent
    const hasSelection = !!(currentLocation?.id || currentLocation?.addressId);
    // A complete address MUST be a saved address (has ID) and have all core fields
    const isComplete = !!(defaultAddress?.id && defaultAddress?.street && defaultAddress?.city && defaultAddress?.zipCode);

    if (!defaultAddress || !hasSelection || !isComplete) {
      toast.error("Please select a complete delivery address (Building, City, and Pin Code are required).", {
        description: !isComplete && defaultAddress ? "Your selected address is missing some details. Please edit it." : "No address selected."
      })

      // Scroll to the address section if possible
      const section = document.getElementById('delivery-address-section');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add a temporary highlight effect
        section.classList.add('ring-2', 'ring-red-500', 'animate-pulse');
        setTimeout(() => section.classList.remove('ring-2', 'ring-red-500', 'animate-pulse'), 3000);
      }

      return
    }



    if (cart.length === 0) {
      alert("Your cart is empty")
      return
    }

    // Check if restaurant is accepting orders
    if (restaurantData && restaurantData.isAcceptingOrders === false) {
      console.error('❌ Cannot place order: Restaurant is currently closed!');
      alert('This restaurant is currently closed and not accepting orders. Please try again during their business hours.');
      setIsPlacingOrder(false);
      return;
    }

    setIsPlacingOrder(true)

    // Use API_BASE_URL from config (supports both dev and production)

    try {
      console.log("🛒 Starting order placement process...")
      console.log("📦 Cart items:", cart.map(item => ({ id: item.id, name: item.name, quantity: item.quantity, price: item.price })))
      console.log("💰 Applied coupon:", appliedCoupon?.code || "None")
      console.log("📍 Delivery address:", defaultAddress?.label || defaultAddress?.city)

      // Ensure couponCode is included in pricing
      const orderPricing = pricing || {
        subtotal,
        deliveryFee,
        tax: gstCharges,
        platformFee,
        discount,
        total,
        couponCode: appliedCoupon?.code || null
      };

      // Add couponCode if not present but coupon is applied
      if (!orderPricing.couponCode && appliedCoupon?.code) {
        orderPricing.couponCode = appliedCoupon.code;
      }

      // Include all cart items (main items + addons)
      // Note: Addons are added as separate cart items when user clicks the + button
      const orderItems = cart.map(item => ({
        itemId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        image: item.image || "",
        description: item.description || "",
        isVeg: item.isVeg !== false,
        itemSize: item.itemSize || "",
        itemSizeQuantity: item.itemSizeQuantity || "",
        itemSizeUnit: item.itemSizeUnit || "",
        unit: item.unit || ""
      }))

      console.log("📋 Order items to send:", orderItems)
      console.log("💵 Order pricing:", orderPricing)

      // Check API base URL before making request (for debugging)
      const fullUrl = `${API_BASE_URL}${API_ENDPOINTS.ORDER.CREATE}`;
      console.log("🌐 Making request to:", fullUrl)
      console.log("🔑 Authentication token present:", !!localStorage.getItem('accessToken') || !!localStorage.getItem('user_accessToken'))

      // CRITICAL: Validate restaurant ID before placing order
      // Ensure we're using the correct restaurant from restaurantData (most reliable)
      const finalRestaurantId = restaurantData?.restaurantId || restaurantData?._id || null;
      const finalRestaurantName = restaurantData?.name || null;

      if (!finalRestaurantId) {
        console.error('❌ CRITICAL: Cannot place order - Restaurant ID is missing!');
        console.error('📋 Debug info:', {
          restaurantData: restaurantData ? {
            _id: restaurantData._id,
            restaurantId: restaurantData.restaurantId,
            name: restaurantData.name
          } : 'Not loaded',
          cartRestaurantId: restaurantId,
          cartRestaurantName: cart[0]?.restaurant,
          cartItems: cart.map(item => ({
            id: item.id,
            name: item.name,
            restaurant: item.restaurant,
            restaurantId: item.restaurantId
          }))
        });
        alert('Error: Restaurant information is missing. Please refresh the page and try again.');
        setIsPlacingOrder(false);
        return;
      }

      // CRITICAL: Validate that ALL cart items belong to the SAME restaurant
      const cartRestaurantIds = cart
        .map(item => item.restaurantId)
        .filter(Boolean)
        .map(id => String(id).trim()); // Normalize to string and trim

      const cartRestaurantNames = cart
        .map(item => item.restaurant)
        .filter(Boolean)
        .map(name => name.trim().toLowerCase()); // Normalize names

      // Get unique values (after normalization)
      const uniqueRestaurantIds = [...new Set(cartRestaurantIds)];
      const uniqueRestaurantNames = [...new Set(cartRestaurantNames)];

      // Check if cart has items from multiple restaurants
      // Note: If restaurant names match, allow even if IDs differ (same restaurant, different ID format)
      if (uniqueRestaurantNames.length > 1) {
        // Different restaurant names = definitely different restaurants
        console.error('❌ CRITICAL ERROR: Cart contains items from multiple restaurants!', {
          restaurantIds: uniqueRestaurantIds,
          restaurantNames: uniqueRestaurantNames,
          cartItems: cart.map(item => ({
            id: item.id,
            name: item.name,
            restaurant: item.restaurant,
            restaurantId: item.restaurantId
          }))
        });

        // Automatically clean cart to keep items from the restaurant matching restaurantData
        if (finalRestaurantId && finalRestaurantName) {
          console.log('🧹 Auto-cleaning cart to keep items from:', finalRestaurantName);
          cleanCartForRestaurant(finalRestaurantId, finalRestaurantName);
          toast.error('Cart contained items from different restaurants. Items from other restaurants have been removed.');
        } else {
          // If restaurantData is not available, keep items from first restaurant in cart
          const firstRestaurantId = cart[0]?.restaurantId;
          const firstRestaurantName = cart[0]?.restaurant;
          if (firstRestaurantId && firstRestaurantName) {
            console.log('🧹 Auto-cleaning cart to keep items from first restaurant:', firstRestaurantName);
            cleanCartForRestaurant(firstRestaurantId, firstRestaurantName);
            toast.error('Cart contained items from different restaurants. Items from other restaurants have been removed.');
          } else {
            toast.error('Cart contains items from different restaurants. Please clear cart and try again.');
          }
        }

        setIsPlacingOrder(false);
        return;
      }

      // If restaurant names match but IDs differ, that's OK (same restaurant, different ID format)
      // But log a warning in development
      if (uniqueRestaurantIds.length > 1 && uniqueRestaurantNames.length === 1) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Cart items have different restaurant IDs but same name. This is OK if IDs are in different formats.', {
            restaurantIds: uniqueRestaurantIds,
            restaurantName: uniqueRestaurantNames[0]
          });
        }
      }

      // Validate that cart items' restaurantId matches the restaurantData
      if (cartRestaurantIds.length > 0) {
        const cartRestaurantId = cartRestaurantIds[0];

        // Check if cart restaurantId matches restaurantData
        const restaurantIdMatches =
          cartRestaurantId === finalRestaurantId ||
          cartRestaurantId === restaurantData?._id?.toString() ||
          cartRestaurantId === restaurantData?.restaurantId;

        if (!restaurantIdMatches) {
          console.error('❌ CRITICAL ERROR: Cart restaurantId does not match restaurantData!', {
            cartRestaurantId: cartRestaurantId,
            finalRestaurantId: finalRestaurantId,
            restaurantDataId: restaurantData?._id?.toString(),
            restaurantDataRestaurantId: restaurantData?.restaurantId,
            restaurantDataName: restaurantData?.name,
            cartRestaurantName: cartRestaurantNames[0]
          });
          alert(`Error: Cart items belong to "${cartRestaurantNames[0] || 'Unknown Restaurant'}" but restaurant data doesn't match. Please refresh the page and try again.`);
          setIsPlacingOrder(false);
          return;
        }
      }

      // Validate restaurant name matches
      if (cartRestaurantNames.length > 0 && finalRestaurantName) {
        const cartRestaurantName = cartRestaurantNames[0];
        if (cartRestaurantName.toLowerCase().trim() !== finalRestaurantName.toLowerCase().trim()) {
          console.error('❌ CRITICAL ERROR: Restaurant name mismatch!', {
            cartRestaurantName: cartRestaurantName,
            finalRestaurantName: finalRestaurantName
          });
          alert(`Error: Cart items belong to "${cartRestaurantName}" but restaurant data shows "${finalRestaurantName}". Please refresh the page and try again.`);
          setIsPlacingOrder(false);
          return;
        }
      }

      // Log order details for debugging
      console.log('✅ Order validation passed - Placing order with restaurant:', {
        restaurantId: finalRestaurantId,
        restaurantName: finalRestaurantName,
        restaurantDataId: restaurantData?._id,
        restaurantDataRestaurantId: restaurantData?.restaurantId,
        cartRestaurantId: cartRestaurantIds[0],
        cartRestaurantName: cartRestaurantNames[0],
        cartItemCount: cart.length
      });

      // FINAL VALIDATION: Double-check restaurantId before sending to backend
      const cartRestaurantId = cart[0]?.restaurantId;
      if (cartRestaurantId && cartRestaurantId !== finalRestaurantId &&
        cartRestaurantId !== restaurantData?._id?.toString() &&
        cartRestaurantId !== restaurantData?.restaurantId) {
        console.error('❌ CRITICAL: Final validation failed - restaurantId mismatch!', {
          cartRestaurantId: cartRestaurantId,
          finalRestaurantId: finalRestaurantId,
          restaurantDataId: restaurantData?._id?.toString(),
          restaurantDataRestaurantId: restaurantData?.restaurantId,
          cartRestaurantName: cart[0]?.restaurant,
          finalRestaurantName: finalRestaurantName
        });
        alert('Error: Restaurant information mismatch detected. Please refresh the page and try again.');
        setIsPlacingOrder(false);
        return;
      }

      // BUILD COMPLETE ADDRESS STRING FOR BACKEND LOGS AND RIDER VIEW
      const fullAddressString = [
        defaultAddress?.street,
        defaultAddress?.additionalDetails
      ].filter(Boolean).join(", ").trim();

      const orderPayload = {
        items: orderItems,
        address: {
          ...defaultAddress,
          formattedAddress: formatFullAddress(defaultAddress)
        },
        restaurantId: finalRestaurantId,
        restaurantName: finalRestaurantName,
        pricing: orderPricing,
        deliveryFleet: deliveryFleet || 'standard',
        note: note || "",
        sendCutlery: sendCutlery !== false,
        deliveryAddressDetails: fullAddressString || formatFullAddress(defaultAddress) || "",
        paymentMethod: finalPaymentMethod,
        zoneId: zoneId // CRITICAL: Pass zoneId for strict zone validation
      };
      // Log final order details (including paymentMethod for COD debugging)
      console.log('📤 FINAL: Sending order to backend with:', {
        restaurantId: finalRestaurantId,
        restaurantName: finalRestaurantName,
        itemCount: orderItems.length,
        totalAmount: orderPricing.total,
        paymentMethod: finalPaymentMethod
      });


      // Create order in backend
      const orderResponse = await orderAPI.createOrder(orderPayload)

      console.log("✅ Order created successfully:", orderResponse.data)

      const { order, razorpay } = orderResponse.data.data

      if (finalPaymentMethod === "cash") {
        toast.success("Order placed with Cash on Delivery")
        setPlacedOrderId(order?.orderId || order?.id || null)
        setShowOrderSuccess(true)
        clearCart()
        setPricing(null)
        setAppliedCoupon(null)
        setCouponCode("")
        setNote("")
        setIsPlacingOrder(false)
        return
      }


      if (!razorpay || !razorpay.orderId || !razorpay.key) {
        console.error("❌ Razorpay initialization failed:", { razorpay, order })
        throw new Error(razorpay ? "Razorpay payment gateway is not configured. Please contact support." : "Failed to initialize payment")
      }

      console.log("💳 Razorpay order created:", {
        orderId: razorpay.orderId,
        amount: razorpay.amount,
        currency: razorpay.currency,
        keyPresent: !!razorpay.key
      })

      // Get user info for Razorpay prefill
      const userInfo = userProfile || {}
      const userPhone = userInfo.phone || defaultAddress?.phone || ""
      const userEmail = userInfo.email || ""
      const userName = userInfo.name || ""

      // Format phone number (remove non-digits, take last 10 digits)
      const formattedPhone = userPhone.replace(/\D/g, "").slice(-10)

      console.log("👤 User info for payment:", {
        name: userName,
        email: userEmail,
        phone: formattedPhone
      })

      // Initialize Razorpay payment
      await initRazorpayPayment({
        key: razorpay.key,
        amount: razorpay.amount, // Already in paise from backend
        currency: razorpay.currency || 'INR',
        order_id: razorpay.orderId,
        name: "Bakalaa",
        image: '/bakalalogo.png',
        description: `Order ${order.orderId} - ₹${(razorpay.amount / 100).toFixed(2)}`,
        prefill: {
          name: userName,
          email: userEmail,
          contact: formattedPhone
        },
        notes: {
          orderId: order.orderId,
          userId: userInfo.id || "",
          restaurantId: restaurantId || "unknown"
        },
        handler: async (response) => {
          try {
            console.log("✅ Payment successful, verifying...", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id
            })

            // Verify payment with backend
            const verifyResponse = await orderAPI.verifyPayment({
              orderId: order.id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            })

            console.log("✅ Payment verification response:", verifyResponse.data)

            if (verifyResponse.data.success) {
              // Payment successful
              console.log("🎉 Order placed successfully:", {
                orderId: order.orderId,
                paymentId: verifyResponse.data.data?.payment?.paymentId
              })
              setPlacedOrderId(order.orderId)
              setShowOrderSuccess(true)
              clearCart()
              setPricing(null)
              setAppliedCoupon(null)
              setCouponCode("")
              setNote("")
              setIsPlacingOrder(false)
            } else {
              throw new Error(verifyResponse.data.message || "Payment verification failed")
            }
          } catch (error) {
            console.error("❌ Payment verification error:", error)
            const errorMessage = error?.response?.data?.message || error?.message || "Payment verification failed. Please contact support."
            alert(errorMessage)
            setIsPlacingOrder(false)
          }
        },
        onError: (error) => {
          console.error("❌ Razorpay payment error:", error)
          // Don't show alert for user cancellation
          if (error?.code !== 'PAYMENT_CANCELLED' && error?.message !== 'PAYMENT_CANCELLED') {
            const errorMessage = error?.description || error?.message || "Payment failed. Please try again."
            alert(errorMessage)
          }
          setIsPlacingOrder(false)
        },
        onClose: () => {
          console.log("⚠️ Payment modal closed by user")
          setIsPlacingOrder(false)
        }
      })
    } catch (error) {
      console.error("❌ Order creation error:", error)

      let errorMessage = "Failed to create order. Please try again."

      // Handle network errors
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        const backendUrl = API_BASE_URL.replace('/api', '');
        errorMessage = `Network Error: Cannot connect to backend server.\n\n` +
          `Expected backend URL: ${backendUrl}\n\n` +
          `Please check:\n` +
          `1. Backend server is running\n` +
          `2. Backend is accessible at ${backendUrl}\n` +
          `3. Check browser console (F12) for more details\n\n` +
          `If backend is not running, start it with:\n` +
          `cd bakalacart/backend && npm start`

        console.error("🔴 Network Error Details:", {
          code: error.code,
          message: error.message,
          config: {
            url: error.config?.url,
            baseURL: error.config?.baseURL,
            fullUrl: error.config?.baseURL + error.config?.url,
            method: error.config?.method
          },
          backendUrl: backendUrl,
          apiBaseUrl: API_BASE_URL
        })

        // Try to test backend connectivity
        try {
          fetch(backendUrl + '/health', { method: 'GET', signal: AbortSignal.timeout(5000) })
            .then(response => {
              if (response.ok) {
                console.log("✅ Backend health check passed - server is running")
              } else {
                console.warn("⚠️ Backend health check returned:", response.status)
              }
            })
            .catch(fetchError => {
              console.error("❌ Backend health check failed:", fetchError.message)
              console.error("💡 Make sure backend server is running at:", backendUrl)
            })
        } catch (fetchTestError) {
          console.error("❌ Could not test backend connectivity:", fetchTestError.message)
        }
      }
      // Handle timeout errors
      else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = "Request timed out. The server is taking too long to respond. Please try again."
      }
      // Handle other axios errors
      else if (error.response) {
        // Server responded with error status
        errorMessage = error.response.data?.message || `Server error: ${error.response.status}`
      }
      // Handle other errors
      else if (error.message) {
        errorMessage = error.message
      }

      alert(errorMessage)
      setIsPlacingOrder(false)
    }
  }

  const handleGoToOrders = () => {
    setShowOrderSuccess(false)
    navigate(`/orders/${placedOrderId}?confirmed=true`)
  }

  // Handle share click
  const handleShare = async () => {
    // Determine share URL - prefer restaurant detail page if restaurant data is available
    const shareUrl = restaurantData?.slug
      ? `${window.location.origin}/restaurants/${restaurantData?.slug || restaurantData?.restaurantId || restaurantId}`
      : window.location.origin

    const shareText = restaurantName
      ? `Check out ${restaurantName} on Bakalaa! ${shareUrl}`
      : `Check out Bakalaa for amazing food! ${shareUrl}`

    const shareData = {
      title: 'Bakalaa',
      text: shareText,
      url: shareUrl,
    }

    // Try Web Share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share(shareData)
        toast.success("Shared successfully")
      } catch (error) {
        // User cancelled or error occurred
        if (error.name !== "AbortError") {
          // Fallback to copy to clipboard for genuine errors
          await copyToClipboard(shareUrl)
        }
      }
    } else {
      // Fallback to copy to clipboard for unsupported browsers
      await copyToClipboard(shareUrl)
    }
  }

  // Copy to clipboard helper
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Link copied to clipboard!")
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = text
      textArea.style.position = "fixed"
      textArea.style.opacity = "0"
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand("copy")
        toast.success("Link copied to clipboard!")
      } catch (err) {
        toast.error("Failed to copy link")
      }
      document.body.removeChild(textArea)
    }
  }

  // Empty cart state - but don't show if order success or placing order modal is active
  if (cart.length === 0 && !showOrderSuccess && !showPlacingOrder) {
    return (
      <AnimatedPage className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
        <div className="bg-white dark:bg-[#1a1a1a] border-b dark:border-gray-800 sticky top-0 z-10">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <ArrowLeft className="h-5 w-5 text-gray-800 dark:text-white" />
            </button>
            <span className="font-semibold text-gray-800 dark:text-white">Cart</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Utensils className="h-10 w-10 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">Your cart is empty</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">Add items from a restaurant to start a new order</p>
          <Button
            onClick={() => navigate('/')}
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-8 h-12 font-semibold shadow-lg shadow-red-200 dark:shadow-none transition-all active:scale-95"
          >
            Browse Restaurants
          </Button>
        </div>
      </AnimatedPage>
    )
  }

  return (
    <div className="relative min-h-screen bg-white dark:bg-[#0a0a0a]">
      {/* Header - Sticky at top */}
      <div className="bg-white dark:bg-[#1a1a1a] border-b dark:border-gray-800 sticky top-0 z-20 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-3 md:px-6 py-2 md:py-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{restaurantName}</p>
                  {restaurantData && restaurantData.isAcceptingOrders === false && (
                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse flex-shrink-0">Closed</span>
                  )}
                </div>
                <p className="text-sm md:text-base font-medium text-gray-800 dark:text-white truncate">
                  {restaurantData?.estimatedDeliveryTime || "10-15 mins"} to <span className="font-semibold">Location</span>
                  <span className="text-gray-400 dark:text-gray-500 ml-1 text-xs md:text-sm">{defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || defaultAddress?.city || "Select address") : "Select address"}</span>
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-40 md:pb-48">
        {/* Savings Banner */}
        {savings > 0 && (
          <div className="bg-blue-100 dark:bg-blue-900/20 px-4 md:px-6 py-2 md:py-3 flex-shrink-0">
            <div className="max-w-7xl mx-auto">
              <p className="text-sm md:text-base font-medium text-blue-800 dark:text-blue-200">
                🎉 You saved ₹{savings} on this order
              </p>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 px-4 md:px-6 py-4 md:py-6">
            {/* Left Column - Cart Items and Details */}
            <div className="lg:col-span-2 space-y-2 md:space-y-4">
              {/* Cart Items */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                <div className="flex items-center justify-between mb-3 md:mb-4 border-b border-gray-100 dark:border-gray-800 pb-2 md:pb-3">
                  <h3 className="text-sm md:text-base font-bold text-gray-800 dark:text-gray-200">
                    Cart Items ({getCartCount()})
                  </h3>
                  <button
                    onClick={() => {
                      if (window.confirm("Are you sure you want to clear your cart?")) {
                        clearCart();
                        toast.info("Cart has been cleared");
                      }
                    }}
                    className="flex items-center gap-1 text-xs md:text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 px-2 py-1 rounded-md transition-colors"
                  >
                    <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                    Clear Cart
                  </button>
                </div>
                <div className="space-y-3 md:space-y-4">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 md:gap-4">
                      {/* Veg/Non-veg indicator */}
                      <div className={`w-4 h-4 md:w-5 md:h-5 border-2 ${item.isVeg !== false ? 'border-green-600' : 'border-red-600'} flex items-center justify-center mt-1 flex-shrink-0`}>
                        <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${item.isVeg !== false ? 'bg-green-600' : 'bg-red-600'}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200 leading-tight">
                          {item.name} {(() => {
                            const sizeUnit = item.itemSizeUnit || item.unit
                            const isPiece = sizeUnit && sizeUnit.trim().toLowerCase() === 'piece'
                            const displayParts = [item.itemSizeQuantity, !isPiece ? sizeUnit : null].filter(Boolean)
                            return displayParts.length > 0 ? (
                              <span className="text-gray-500 dark:text-gray-400 font-bold ml-1">
                                ({displayParts.join(' ')})
                              </span>
                            ) : ''
                          })()}
                        </p>
                        <button
                          onClick={() => {
                            if (restaurantData?.slug || restaurantData?.restaurantId || cart[0]?.restaurantId) {
                              const slug = restaurantData?.slug || restaurantData?.restaurantId || cart[0]?.restaurantId;
                              navigate(`/restaurants/${slug}`);
                            } else {
                              toast.error("Restaurant details not found");
                            }
                          }}
                          className="text-xs md:text-sm text-blue-600 dark:text-blue-400 font-medium flex items-center gap-0.5 mt-0.5"
                        >
                          Edit <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3 md:gap-4">
                        {/* Quantity controls */}
                        <div className="flex items-center border border-red-600 dark:border-red-500 rounded">
                          <button
                            className="px-2 md:px-3 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3 md:h-4 md:w-4" />
                          </button>
                          <span className="px-2 md:px-3 text-sm md:text-base font-semibold text-red-600 dark:text-red-400 min-w-[20px] md:min-w-[24px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            className="px-2 md:px-3 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3 md:h-4 md:w-4" />
                          </button>
                        </div>

                        <p className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200 min-w-[50px] md:min-w-[70px] text-right">
                          ₹{((item.price || 0) * (item.quantity || 1)).toFixed(0)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add more items */}
                <button
                  onClick={() => {
                    if (restaurantData?.slug) {
                      navigate(`/restaurants/${restaurantData.slug}`);
                    } else {
                      navigate(-1);
                    }
                  }}
                  className="flex items-center gap-2 mt-4 md:mt-6 text-red-600 dark:text-red-400"
                >
                  <Plus className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="text-sm md:text-base font-medium">Add more items</span>
                </button>
              </div>


              {/* Note & Cutlery */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl flex flex-col sm:flex-row gap-2 md:gap-3">
                <button
                  onClick={() => setShowNoteInput(!showNoteInput)}
                  className="flex-1 flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border border-gray-200 dark:border-gray-700 rounded-lg md:rounded-xl text-sm md:text-base text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <FileText className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="truncate">{note || "Add a note for the restaurant"}</span>
                </button>
                <button
                  onClick={() => setSendCutlery(!sendCutlery)}
                  className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border rounded-lg md:rounded-xl text-sm md:text-base ${sendCutlery ? 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300' : 'border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'}`}
                >
                  <Utensils className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="whitespace-nowrap">{sendCutlery ? "Don't send cutlery" : "No cutlery"}</span>
                </button>
              </div>

              {/* Note Input */}
              {showNoteInput && (
                <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add cooking instructions, allergies, etc."
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg md:rounded-xl p-3 md:p-4 text-sm md:text-base resize-none h-20 md:h-24 focus:outline-none focus:border-red-600 dark:focus:border-red-500 bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100"
                  />
                </div>
              )}

              {/* Complete your meal section - Approved Addons */}
              {addons.length > 0 && (
                <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                  <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                      <span className="text-xs md:text-base">🍽️</span>
                    </div>
                    <span className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200">Complete your meal with</span>
                  </div>
                  {loadingAddons ? (
                    <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mx-4 md:-mx-6 px-4 md:px-6 scrollbar-hide">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex-shrink-0 w-28 md:w-36 animate-pulse">
                          <div className="w-full h-28 md:h-36 bg-gray-200 dark:bg-gray-700 rounded-lg md:rounded-xl" />
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mt-1 w-2/3" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mx-4 md:-mx-6 px-4 md:px-6 scrollbar-hide">
                      {addons.map((addon) => (
                        <div key={addon.id} className="flex-shrink-0 w-28 md:w-36">
                          <div className="relative bg-gray-100 dark:bg-gray-800 rounded-lg md:rounded-xl overflow-hidden">
                            <img
                              src={addon.image || (addon.images && addon.images[0]) || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop"}
                              alt={addon.name}
                              className="w-full h-28 md:h-36 object-cover rounded-lg md:rounded-xl"
                              onError={(e) => {
                                e.target.onerror = null
                                e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop"
                              }}
                            />
                            <div className="absolute top-1 md:top-2 left-1 md:left-2">
                              <div className="w-3.5 h-3.5 md:w-4 md:h-4 bg-white border border-green-600 flex items-center justify-center rounded">
                                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-600" />
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                // Use restaurant info from existing cart items to ensure format consistency
                                const cartRestaurantId = cart[0]?.restaurantId || restaurantId;
                                const cartRestaurantName = cart[0]?.restaurant || restaurantName;

                                if (!cartRestaurantId || !cartRestaurantName) {
                                  console.error('❌ Cannot add addon: Missing restaurant information', {
                                    cartRestaurantId,
                                    cartRestaurantName,
                                    restaurantId,
                                    restaurantName,
                                    cartItem: cart[0]
                                  });
                                  toast.error('Restaurant information is missing. Please refresh the page.');
                                  return;
                                }

                                addToCart({
                                  id: addon.id,
                                  name: addon.name,
                                  price: addon.price,
                                  image: addon.image || (addon.images && addon.images[0]) || "",
                                  description: addon.description || "",
                                  isVeg: true,
                                  restaurant: cartRestaurantName,
                                  restaurantId: cartRestaurantId
                                });
                              }}
                              className="absolute bottom-1 md:bottom-2 right-1 md:right-2 w-6 h-6 md:w-7 md:h-7 bg-white border border-red-600 rounded flex items-center justify-center shadow-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 text-red-600" />
                            </button>
                          </div>
                          <p className="text-xs md:text-sm font-medium text-gray-800 dark:text-gray-200 mt-1.5 md:mt-2 line-clamp-2 leading-tight">{addon.name}</p>
                          {addon.description && (
                            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{addon.description}</p>
                          )}
                          <p className="text-xs md:text-sm text-gray-800 dark:text-gray-200 font-semibold mt-0.5">₹{addon.price}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Coupon Section */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg md:rounded-xl p-3 md:p-4">
                    <div className="flex items-center gap-2 md:gap-3">
                      <Tag className="h-4 w-4 md:h-5 md:w-5 text-red-600 dark:text-red-400" />
                      <div>
                        <p className="text-sm md:text-base font-medium text-red-700 dark:text-red-300">'{appliedCoupon.code}' applied</p>
                        <p className="text-xs md:text-sm text-red-600 dark:text-red-400">You saved ₹{discount}</p>
                      </div>
                    </div>
                    <button onClick={handleRemoveCoupon} className="text-gray-500 dark:text-gray-400 text-xs md:text-sm font-medium">Remove</button>
                  </div>
                ) : loadingCoupons ? (
                  <div className="flex items-center gap-2 md:gap-3">
                    <Percent className="h-4 w-4 md:h-5 md:w-5 text-gray-600 dark:text-gray-400" />
                    <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">Loading coupons...</p>
                  </div>
                ) : availableCoupons.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 md:gap-3">
                        <Percent className="h-4 w-4 md:h-5 md:w-5 text-gray-600 dark:text-gray-400" />
                        <div>
                          <p className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200">
                            Save ₹{availableCoupons[0].discount} with '{availableCoupons[0].code}'
                          </p>
                          {availableCoupons.length > 1 && (
                            <button onClick={() => setShowCoupons(!showCoupons)} className="text-xs md:text-sm text-blue-600 dark:text-blue-400 font-medium">
                              View all coupons →
                            </button>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 md:h-8 text-xs md:text-sm border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => handleApplyCoupon(availableCoupons[0])}
                        disabled={subtotal < availableCoupons[0].minOrder}
                      >
                        {subtotal < availableCoupons[0].minOrder ? `Min ₹${availableCoupons[0].minOrder}` : 'APPLY'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 md:gap-3">
                    <Percent className="h-4 w-4 md:h-5 md:w-5 text-gray-600 dark:text-gray-400" />
                    <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">No coupons available</p>
                  </div>
                )}

                {/* Coupons List */}
                {showCoupons && !appliedCoupon && availableCoupons.length > 0 && (
                  <div className="mt-3 md:mt-4 space-y-2 md:space-y-3 border-t dark:border-gray-700 pt-3 md:pt-4">
                    {availableCoupons.map((coupon) => (
                      <div key={coupon.code} className="flex items-center justify-between py-2 md:py-3 border-b border-dashed dark:border-gray-700 last:border-0">
                        <div>
                          <p className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200">{coupon.code}</p>
                          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{coupon.description}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 md:h-7 text-xs md:text-sm border-red-600 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => handleApplyCoupon(coupon)}
                          disabled={subtotal < coupon.minOrder}
                        >
                          {subtotal < coupon.minOrder ? `Min ₹${coupon.minOrder}` : 'APPLY'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Delivery Time */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                <div className="flex items-center gap-3 md:gap-4">
                  <Clock className="h-4 w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm md:text-base text-gray-800 dark:text-gray-200">Delivery in <span className="font-semibold">{restaurantData?.estimatedDeliveryTime || "10-15 mins"}</span></p>
                  </div>
                </div>
              </div>

              {/* Delivery Fleet selection removed as per request - default 'standard' is used in background */}

              {/* Delivery Address Section */}
              <div id="delivery-address-section" className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-4 md:py-6 rounded-lg md:rounded-xl">
                <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-gray-800 pb-2 md:pb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 md:h-5 md:w-5 text-red-600 dark:text-red-400" />
                    <h3 className="text-sm md:text-base font-bold text-gray-800 dark:text-gray-200">
                      Delivery Address
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowAddressForm(true)}
                    className="flex items-center gap-1 text-xs md:text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 px-2 py-1 rounded-md transition-colors"
                  >
                    <Plus className="h-3 w-3 md:h-4 md:w-4" />
                    Add New
                  </button>
                </div>

                {/* Address List - Horizontal Scroll */}
                <div className="mb-2">
                  {profileLoading ? (
                    // Loading skeleton while addresses are being fetched
                    <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 md:-mx-6 px-4 md:px-6 scrollbar-hide">
                      {[1, 2].map(i => (
                        <div key={i} className="flex-shrink-0 w-[240px] p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 animate-pulse">
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3"></div>
                          <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                          <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                        </div>
                      ))}
                    </div>
                  ) : addresses && addresses.length > 0 ? (
                    <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 -mx-4 md:-mx-6 px-4 md:px-6 scrollbar-hide">
                      {addresses.map((address) => {
                        const isSelected = currentLocation?.id === address.id || currentLocation?.addressId === address.id || currentLocation?.id === address._id || currentLocation?.addressId === address._id;

                        return (
                          <div
                            key={address.id || address._id}
                            onClick={() => handleSelectAddress(address)}
                            className={`flex-shrink-0 w-[240px] md:w-[280px] p-4 rounded-xl border transition-all cursor-pointer relative shadow-sm ${isSelected
                              ? 'border-red-600 bg-red-50/20 dark:bg-red-900/10'
                              : 'border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/30 hover:border-gray-200 dark:hover:border-gray-700'
                              }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="bg-white dark:bg-gray-800 p-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                                  {address.label?.toLowerCase() === 'home' ? <Building2 className="h-3.5 w-3.5 text-gray-500" /> : <MapPin className="h-3.5 w-3.5 text-gray-500" />}
                                </div>
                                <p className={`font-bold text-sm truncate ${isSelected ? 'text-red-700 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                  {address.label || "Address"}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={(e) => handleEditAddress(e, address)} className="p-1 hover:bg-white dark:hover:bg-gray-800 rounded transition-colors"><Edit2 className="h-3 w-3 text-gray-400" /></button>
                                <button onClick={(e) => handleDeleteAddress(e, address.id || address._id)} className="p-1 hover:bg-white dark:hover:bg-gray-800 rounded transition-colors"><Trash2 className="h-3 w-3 text-gray-400" /></button>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed h-8">
                              {[address.street, address.area, address.city].filter(Boolean).join(', ')}
                            </p>
                            {isSelected && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-[#1a1a1a]">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50/50 dark:bg-gray-800/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                      <MapPin className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">No saved addresses found</p>
                      <p className="text-xs text-gray-400 mt-1">Click "+ Add New" to add your delivery address</p>
                    </div>
                  )}
                </div>


              </div>
              {/* Personal Details */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl">
                <Link to="/profile/edit" className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <Phone className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Deliver to</p>
                      <p className="text-sm md:text-base text-gray-800 dark:text-gray-200 font-medium">
                        {userProfile?.name || "Guest"}, {userProfile?.phone || "+91-XXXXXXXXXX"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </Link>
              </div>

              {/* Bill Details */}
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl lg:hidden">
                <button
                  onClick={() => setShowBillDetails(!showBillDetails)}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-3 md:gap-4">
                    <FileText className="h-4 w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400" />
                    <div className="text-left">
                      <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                        <span className="text-sm md:text-base text-gray-800 dark:text-gray-200">Total Bill</span>
                        <span className="text-sm md:text-base text-gray-400 dark:text-gray-500 line-through">₹{totalBeforeDiscount.toFixed(0)}</span>
                        <span className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200">₹{total.toFixed(0)}</span>
                        {savings > 0 && (
                          <span className="text-xs md:text-sm bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-1.5 md:px-2 py-0.5 rounded font-medium">You saved ₹{savings}</span>
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Incl. taxes and charges</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />
                </button>

                {showBillDetails && (
                  <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-dashed dark:border-gray-700 space-y-2 md:space-y-3">
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-gray-600 dark:text-gray-400">Item Total</span>
                      <span className="text-gray-800 dark:text-gray-200">₹{subtotal.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-gray-600 dark:text-gray-400">Shipping Charges</span>
                      <span className={deliveryFee === 0 ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-gray-200"}>
                        {deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-gray-600 dark:text-gray-400">Platform Fee</span>
                      <span className="text-gray-800 dark:text-gray-200">₹{platformFee}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-gray-600 dark:text-gray-400">GST and Restaurant Charges</span>
                      <span className="text-gray-800 dark:text-gray-200">₹{gstCharges}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-sm md:text-base text-red-600 dark:text-red-400">
                        <span>Coupon Discount</span>
                        <span>-₹{discount}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm md:text-base font-semibold pt-2 md:pt-3 border-t dark:border-gray-700">
                      <span>To Pay</span>
                      <span>₹{total.toFixed(0)}</span>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Right Column - Order Summary (Desktop) */}
            <div className="lg:col-span-1 hidden lg:block">
              <div className="lg:sticky lg:top-24 space-y-4 md:space-y-6">
                {/* Bill Summary Card */}
                <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-4 md:py-5 rounded-lg md:rounded-xl border border-gray-200 dark:border-gray-700">
                  <h3 className="text-base md:text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 md:mb-4">Order Summary</h3>
                  <div className="space-y-2 md:space-y-3">
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-gray-600 dark:text-gray-400">Item Total</span>
                      <span className="text-gray-800 dark:text-gray-200">₹{subtotal.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-gray-600 dark:text-gray-400">Shipping Charges</span>
                      <span className={deliveryFee === 0 ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-gray-200"}>
                        {deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-gray-600 dark:text-gray-400">Platform Fee</span>
                      <span className="text-gray-800 dark:text-gray-200">₹{platformFee}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-gray-600 dark:text-gray-400">GST and Restaurant Charges</span>
                      <span className="text-gray-800 dark:text-gray-200">₹{gstCharges}</span>
                    </div>
                    {(discount > 0 || (pricing?.discount && pricing.discount > 0)) && (
                      <div className="flex justify-between text-sm md:text-base text-red-600 dark:text-red-400">
                        <span>Coupon Discount</span>
                        <span>-₹{Math.round(discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base md:text-lg font-bold pt-3 md:pt-4 border-t dark:border-gray-700">
                      <span>Total</span>
                      <span className="text-green-600 dark:text-green-400">₹{total.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sticky - Place Order */}
      <div className="bg-white dark:bg-[#1a1a1a] border-t dark:border-gray-800 shadow-lg z-30 flex-shrink-0 fixed bottom-0 left-0 right-0">
        <div className="max-w-7xl mx-auto">
          <div className="px-4 md:px-6 py-3 md:py-4">
            <div className="w-full max-w-md md:max-w-lg mx-auto">
              {/* Pay Using */}
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  <div className="leading-tight">
                    <p className="text-[11px] md:text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      PAY USING
                    </p>
                    <p className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200">
                      {selectedPaymentMethod === "razorpay"
                        ? "Razorpay"
                        : "Cash on Delivery"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Address Selection & Completion Check for Button State - REQUIRED FOR PREVENTING ORDERS WITHOUT ADDRESS */}
              {(() => {
                // Check if an address is selected at all
                // Note: We now prioritize SAVED addresses for the selection to be valid
                const isAddressSelected = !!(
                  currentLocation?.id ||
                  currentLocation?.addressId
                );

                // Check if the selected address is complete (Required for delivery)
                // It must be a saved address (has ID) and contain all required delivery details
                const isAddressComplete = !!(
                  defaultAddress?.id &&
                  defaultAddress?.street &&
                  defaultAddress?.city &&
                  defaultAddress?.zipCode
                );

                const isRestaurantClosed = restaurantData && restaurantData.isAcceptingOrders === false;

                // Final check: Must be selected AND complete
                const canPlaceOrder = isAddressSelected && isAddressComplete && !isRestaurantClosed;

                return (
                  <Button
                    size="lg"
                    onClick={() => {
                      if (isPlacingOrder) return
                      setShowPaymentSheet(true)
                    }}
                    disabled={isPlacingOrder || !canPlaceOrder}
                    className="w-full bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700 text-white px-6 md:px-10 h-14 md:h-16 rounded-lg md:rounded-xl text-base md:text-lg font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="text-left mr-3 md:mr-4">
                      <p className="text-sm md:text-base opacity-90">₹{total.toFixed(0)}</p>
                      <p className="text-xs md:text-sm opacity-75">TOTAL</p>
                    </div>
                    <span className="font-bold text-base md:text-lg">
                      {isPlacingOrder
                        ? "Processing..."
                        : isRestaurantClosed
                          ? "Closed"
                          : !isAddressSelected
                            ? "Select Address"
                            : !isAddressComplete
                              ? "Complete Address"
                              : selectedPaymentMethod === "razorpay"
                                ? "Select Payment"
                                : "Place Order"}
                    </span>
                    <ChevronRight className="h-5 w-5 md:h-6 md:w-6 ml-2" />
                  </Button>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Placing Order Modal */}
      {showPlacingOrder && (
        <div className="fixed inset-0 z-[60] h-screen w-screen overflow-hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Modal Sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl overflow-hidden"
            style={{ animation: 'slideUpModal 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div className="px-6 py-8">
              {/* Title */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Confirm Order Details</h2>
                {selectedPaymentMethod === "cash" && (
                  <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-full border border-amber-200 uppercase tracking-tighter animate-pulse">COD Verification</span>
                )}
              </div>

              {/* Payment Info */}
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-xl border border-gray-200 flex items-center justify-center bg-white shadow-sm">
                  <CreditCard className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedPaymentMethod === "razorpay"
                      ? `Pay ₹${total.toFixed(2)} online (Razorpay)`
                      : `Pay on delivery (COD)`}
                  </p>
                </div>
              </div>

              {/* Delivery Address */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-xl border border-gray-200 flex items-center justify-center bg-gray-50">
                  <svg className="w-7 h-7 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path d="M9 22V12h6v10" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-lg font-bold text-gray-900">VERIFY DELIVERY ADDRESS</p>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 leading-snug">
                    {defaultAddress?.label ? `${defaultAddress.label.toUpperCase()}: ` : ""}
                    {defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || "Address") : "Select an address"}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative mb-6">
                <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-100 ease-linear"
                    style={{
                      width: `${orderProgress}%`,
                      boxShadow: '0 0 10px rgba(34, 197, 94, 0.5)'
                    }}
                  />
                </div>
                {/* Animated shimmer effect */}
                <div
                  className="absolute inset-0 h-2.5 rounded-full overflow-hidden pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                    animation: 'shimmer 1.5s infinite',
                    width: `${orderProgress}%`
                  }}
                />
              </div>

              {/* Cancel Button */}
              <button
                onClick={() => {
                  setShowPlacingOrder(false)
                  setIsPlacingOrder(false)
                }}
                className="w-full text-right"
              >
                <span className="text-green-600 font-semibold text-base hover:text-green-700 transition-colors">
                  CANCEL
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Success Celebration Page */}
      {showOrderSuccess && (
        <div
          className="fixed inset-0 z-[70] bg-white flex flex-col items-center justify-center h-screen w-screen overflow-hidden"
          style={{ animation: 'fadeIn 0.3s ease-out' }}
        >
          {/* Confetti Background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Animated confetti pieces */}
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute w-3 h-3 rounded-sm"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-10%`,
                  backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 6)],
                  animation: `confettiFall ${2 + Math.random() * 2}s linear ${Math.random() * 2}s infinite`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            ))}
          </div>

          {/* Success Content */}
          <div className="relative z-10 flex flex-col items-center px-6">
            {/* Success Tick Circle */}
            <div
              className="relative mb-8"
              style={{ animation: 'scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both' }}
            >
              {/* Outer ring animation */}
              <div
                className="absolute inset-0 w-32 h-32 rounded-full border-4 border-green-500"
                style={{
                  animation: 'ringPulse 1.5s ease-out infinite',
                  opacity: 0.3
                }}
              />
              {/* Main circle */}
              <div className="w-32 h-32 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-2xl">
                <svg
                  className="w-16 h-16 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ animation: 'checkDraw 0.5s ease-out 0.5s both' }}
                >
                  <path d="M5 12l5 5L19 7" className="check-path" />
                </svg>
              </div>
              {/* Sparkles */}
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                  style={{
                    top: '50%',
                    left: '50%',
                    animation: `sparkle 0.6s ease-out ${0.3 + i * 0.1}s both`,
                    transform: `rotate(${i * 60}deg) translateY(-80px)`,
                  }}
                />
              ))}
            </div>

            {/* Location Info */}
            <div
              className="text-center"
              style={{ animation: 'slideUp 0.5s ease-out 0.6s both' }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-5 h-5 text-red-500">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {defaultAddress?.city || "Your Location"}
                </h2>
              </div>
              <p className="text-gray-500 text-base">
                {defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || "Delivery Address") : "Delivery Address"}
              </p>
            </div>

            {/* Order Placed Message */}
            <div
              className="mt-12 text-center"
              style={{ animation: 'slideUp 0.5s ease-out 0.8s both' }}
            >
              <h3 className="text-3xl font-bold text-green-600 mb-2">
                {(selectedPaymentMethod === "cash" || selectedPaymentMethod === "cod") ? "Order Confirmed!" : "Payment Successful!"}
              </h3>
              <p className="text-gray-600">Your delicious food is on its way</p>
            </div>

            {/* Action Button */}
            <button
              onClick={handleGoToOrders}
              className="mt-10 bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-12 rounded-xl shadow-lg transition-all hover:shadow-xl hover:scale-105"
              style={{ animation: 'slideUp 0.5s ease-out 1s both' }}
            >
              Track Your Order
            </button>
          </div>
        </div>
      )}

      {/* Payment Method Sheet */}
      <AnimatePresence>
        {showPaymentSheet && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPaymentSheet(false)}
              className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm"
            />
            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1a1a1a] rounded-t-[32px] z-[101] px-6 pb-10 pt-4 shadow-2xl safe-area-inset-bottom"
            >
              {/* Handle */}
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6" />

              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-1">Payment Method</h2>
              <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mb-6">Choose your preferred payment option</p>

              {/* Delivery Address Preview in Payment Sheet - CRITICAL FOR VERIFICATION */}
              <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800 rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-orange-600" />
                  <span className="text-[10px] md:text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider">Confirming Delivery Address</span>
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
                  {defaultAddress?.label ? `${defaultAddress.label.toUpperCase()}: ` : ""}
                  {[defaultAddress?.street, defaultAddress?.city].filter(Boolean).join(', ')}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
                  {formatFullAddress(defaultAddress)}
                </p>
                {/* Manual Address Selector Link */}
                <button
                  onClick={() => {
                    setShowPaymentSheet(false);
                    const section = document.getElementById('delivery-address-section');
                    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="mt-2 text-xs font-bold text-red-600 dark:text-red-400 underline decoration-red-600/30 underline-offset-4"
                >
                  NOT THE RIGHT ADDRESS? CHANGE
                </button>
              </div>

              <div className="space-y-4">
                {/* Online Payment Option */}
                <div
                  className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer ${selectedPaymentMethod === "razorpay" ? 'border-green-600 bg-green-50/50 dark:bg-green-900/10' : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'}`}
                  onClick={() => {
                    setSelectedPaymentMethod("razorpay");
                    setShowPaymentSheet(false);
                    // Start payment process immediately for Online Payment
                    setTimeout(() => handlePlaceOrder("razorpay"), 300);
                  }}
                >
                  <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 dark:text-white">Online Payment</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Pay with card, UPI, or wallet</p>
                  </div>
                  {selectedPaymentMethod === "razorpay" && (
                    <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>

                {/* Cash on Delivery Option */}
                <div
                  className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer ${selectedPaymentMethod === "cash" ? 'border-green-600 bg-green-50/50 dark:bg-green-900/10' : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'}`}
                  onClick={() => {
                    setSelectedPaymentMethod("cash");
                    setShowPaymentSheet(false);
                    setTimeout(() => handlePlaceOrder("cash"), 300);
                  }}
                >
                  <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center relative">
                    <Banknote className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                    {/* COD Label indicator */}
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white dark:border-gray-900"></div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900 dark:text-white">Cash on Delivery</p>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Place order now, pay later</p>
                  </div>
                  {selectedPaymentMethod === "cash" && (
                    <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Animation Styles */}
      <style>{`
        @keyframes fadeInBackdrop {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUpBannerSmooth {
          from {
            transform: translateY(100%) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes slideUpBanner {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes shimmerBanner {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes scaleInBounce {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes pulseRing {
          0% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.4);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }
        @keyframes checkMarkDraw {
          0% {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            stroke-dasharray: 100;
            stroke-dashoffset: 0;
            opacity: 1;
          }
        }
        @keyframes slideUpFull {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes slideUpModal {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes checkDraw {
          0% {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
          }
          100% {
            stroke-dasharray: 100;
            stroke-dashoffset: 0;
          }
        }
        @keyframes ringPulse {
          0% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.3);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }
        @keyframes sparkle {
          0% {
            transform: rotate(var(--rotation, 0deg)) translateY(0) scale(0);
            opacity: 1;
          }
          100% {
            transform: rotate(var(--rotation, 0deg)) translateY(-80px) scale(1);
            opacity: 0;
          }
        }
        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes confettiFall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-slideUpFull {
          animation: slideUpFull 0.3s ease-out;
        }
        .check-path {
          stroke-dasharray: 100;
          stroke-dashoffset: 0;
        }
      `}</style>
      <AddressFormModal
        isOpen={showAddressForm}
        editAddress={addressToEdit}
        onClose={() => {
          setShowAddressForm(false)
          setAddressToEdit(null)
        }}
        onSaveSuccess={(newAddress) => {
          // Automatically select the new address
          if (newAddress) {
            handleSelectAddress(newAddress)
          }
          setShowAddressForm(false)
          setAddressToEdit(null)
        }}
      />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {addressToDelete && (
          <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAddressToDelete(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-[#1a1a1a] rounded-3xl p-6 shadow-2xl"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="h-8 w-8 text-red-600 dark:text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Delete Address?</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">Are you sure you want to delete this address? This action cannot be undone.</p>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setAddressToDelete(null)}
                    className="flex-1 h-12 rounded-xl border-gray-200 dark:border-gray-800 font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmDeleteAddress}
                    className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}


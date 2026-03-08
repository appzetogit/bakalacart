import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react"
import { authAPI, userAPI } from "@/lib/api"

const ProfileContext = createContext(null)

// Helper function to check if current page is an auth page
const isAuthPage = () => {
  const pathname = window.location.pathname;
  const authPaths = [
    '/auth/sign-in',
    '/auth/otp',
    '/auth/callback',
    '/restaurant/login',
    '/restaurant/signup',
    '/restaurant/signup-email',
    '/restaurant/auth/sign-in',
    '/restaurant/forgot-password',
    '/restaurant/otp',
    '/restaurant/auth/google-callback',
    '/restaurant/welcome',
    '/delivery/sign-in',
    '/delivery/signup',
    '/delivery/otp',
    '/delivery/welcome',
    '/delivery/terms',
    '/admin/login'
  ];
  return authPaths.some(path => pathname.startsWith(path));
};

export function ProfileProvider({ children }) {
  const [userProfile, setUserProfile] = useState(() => {
    // First, try to get from localStorage (user_user from auth)
    const userStr = localStorage.getItem("user_user")
    if (userStr) {
      try {
        return JSON.parse(userStr)
      } catch (e) {
        console.error("Error parsing user_user from localStorage:", e)
      }
    }

    // Fallback to userProfile from localStorage
    const saved = localStorage.getItem("userProfile")
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error("Error parsing userProfile from localStorage:", e)
      }
    }

    // Default empty profile
    return null
  })

  const [addresses, setAddresses] = useState(() => {
    // Pre-load from localStorage so addresses are immediately available on render
    const saved = localStorage.getItem("userAddresses")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      } catch (e) { /* ignore */ }
    }
    return []
  })

  // CRITICAL: Check if we have data in localStorage to prevent loading blink
  // Also check if we're on an auth page - never show loading on auth pages
  const hasLocalData = (() => {
    try {
      // If we're on an auth page, never show loading
      if (isAuthPage()) {
        return true // Pretend we have data to prevent loading
      }
      
      // Check if we have user profile
      const userStr = localStorage.getItem("user_user") || localStorage.getItem("userProfile")
      const hasUser = userStr && userStr !== 'null' && userStr !== 'undefined'
      
      // Check if we have addresses
      const saved = localStorage.getItem("userAddresses")
      const hasAddresses = saved && saved !== 'null' && saved !== 'undefined'
      
      // If we have either user or addresses, don't show loading
      return hasUser || hasAddresses
    } catch (e) { /* ignore */ }
    return false
  })()

  // CRITICAL: Never show loading on initial mount if we have local data or are on auth page
  // This prevents blink in Flutter WebView
  const [loading, setLoading] = useState(() => {
    // Always return false on initial mount to prevent any blink
    // We'll handle loading state more carefully in useEffect
    return false
  })

  // Helper function to deduplicate addresses by ID
  const deduplicateAddresses = useCallback((addressList) => {
    if (!Array.isArray(addressList) || addressList.length === 0) return []

    // Remove duplicates by ID (keep first occurrence)
    const uniqueById = addressList.filter((address, index, self) => {
      // Find by _id or id
      const addrId = address._id || address.id;
      if (!addrId) return true; // Keep addresses without ID

      const firstIndex = self.findIndex(addr => (addr._id || addr.id) === addrId)
      return index === firstIndex
    })

    return uniqueById
  }, [])

  // Memoized deduplicated addresses - always use this instead of raw addresses
  const deduplicatedAddresses = useMemo(() => {
    return deduplicateAddresses(addresses)
  }, [addresses, deduplicateAddresses])

  const [paymentMethods, setPaymentMethods] = useState(() => {
    const saved = localStorage.getItem("userPaymentMethods")
    return saved ? JSON.parse(saved) : [
      {
        id: "1",
        cardNumber: "1234",
        cardHolder: "John Doe",
        expiryMonth: "12",
        expiryYear: "2025",
        cvv: "123",
        isDefault: true,
        type: "visa",
      },
      {
        id: "2",
        cardNumber: "5678",
        cardHolder: "John Doe",
        expiryMonth: "12",
        expiryYear: "2026",
        cvv: "456",
        isDefault: false,
        type: "mastercard",
      },
    ]
  })

  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem("userFavorites")
    return saved ? JSON.parse(saved) : []
  })

  // Dish favorites state - stored in localStorage for persistence
  const [dishFavorites, setDishFavorites] = useState(() => {
    const saved = localStorage.getItem("userDishFavorites")
    return saved ? JSON.parse(saved) : []
  })

  // VegMode state - stored in localStorage for persistence
  const [vegMode, setVegMode] = useState(() => {
    const saved = localStorage.getItem("userVegMode")
    // Default to false (OFF) if not set
    return saved !== null ? saved === "true" : false
  })

  // Save to localStorage whenever userProfile, addresses or paymentMethods change
  useEffect(() => {
    localStorage.setItem("userProfile", JSON.stringify(userProfile))
  }, [userProfile])

  useEffect(() => {
    // Always save deduplicated addresses to localStorage
    const deduplicated = deduplicateAddresses(addresses)
    localStorage.setItem("userAddresses", JSON.stringify(deduplicated))
  }, [addresses, deduplicateAddresses])

  useEffect(() => {
    localStorage.setItem("userPaymentMethods", JSON.stringify(paymentMethods))
  }, [paymentMethods])

  useEffect(() => {
    localStorage.setItem("userFavorites", JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    localStorage.setItem("userDishFavorites", JSON.stringify(dishFavorites))
  }, [dishFavorites])

  useEffect(() => {
    localStorage.setItem("userVegMode", vegMode.toString())
  }, [vegMode])

  // Fetch user profile and addresses from API on mount and when authentication changes
  useEffect(() => {
    // CRITICAL: Defer initialization to allow app to render first
    let initTimeout = null
    let isMounted = true
    // Capture hasLocalData value at effect start
    const hasLocalDataValue = hasLocalData

    const fetchUserProfile = async () => {
      // Check if user is authenticated
      const isAuthenticated = localStorage.getItem("user_authenticated") === "true" ||
        localStorage.getItem("user_accessToken")

      if (!isAuthenticated) {
        // Only update state if different to prevent unnecessary re-renders
        if (userProfile !== null) {
          setUserProfile(null)
        }
        if (addresses.length > 0) {
          setAddresses([])
        }
        if (favorites.length > 0) {
          setFavorites([])
        }
        if (dishFavorites.length > 0) {
          setDishFavorites([])
        }
        // Reset payment methods to default dummy cards or empty
        const savedPayments = localStorage.getItem("userPaymentMethods")
        if (!savedPayments && paymentMethods.length === 0) {
          setPaymentMethods([
            {
              id: "1",
              cardNumber: "1234",
              cardHolder: "John Doe",
              expiryMonth: "12",
              expiryYear: "2025",
              cvv: "123",
              isDefault: true,
              type: "visa",
            },
            {
              id: "2",
              cardNumber: "5678",
              cardHolder: "John Doe",
              expiryMonth: "12",
              expiryYear: "2026",
              cvv: "456",
              isDefault: false,
              type: "mastercard",
            },
          ])
        }
        if (loading) {
          setLoading(false)
        }
        return
      }

      try {
        // CRITICAL: Never set loading to true on auth pages or if we have local data
        // This prevents blink in Flutter WebView
        if (!hasLocalDataValue && isMounted && !loading && !isAuthPage()) {
          setLoading(true)
        }

        // Fetch user profile
        try {
          const response = await authAPI.getCurrentUser()
          const userData = response?.data?.data?.user || response?.data?.user || response?.data

          if (userData) {
            setUserProfile(userData)
            // Update localStorage
            localStorage.setItem("user_user", JSON.stringify(userData))
            localStorage.setItem("userProfile", JSON.stringify(userData))
          }
        } catch (profileError) {
          // Handle 503 (maintenance mode) gracefully
          if (profileError?.response?.status === 503) {
            console.log("Maintenance mode active - skipping profile fetch")
            // Don't throw - just skip profile fetch and continue to addresses
            // The maintenance screen will be shown by UserLayout
          } else {
            // Re-throw other errors to be caught by outer catch
            throw profileError
          }
        }

        // Fetch addresses
        try {
          const addressesResponse = await userAPI.getAddresses()
          const addressesData = addressesResponse?.data?.data?.addresses || addressesResponse?.data?.addresses || []
          // Deduplicate addresses before setting
          const deduplicated = deduplicateAddresses(addressesData)
          setAddresses(deduplicated)
          localStorage.setItem("userAddresses", JSON.stringify(deduplicated))
        } catch (addressError) {
          // Handle 503 (maintenance mode) gracefully - don't log as error
          if (addressError?.response?.status === 503) {
            // Maintenance mode is active - silently skip fetching addresses
            // The maintenance screen will be shown by UserLayout
            console.log("Maintenance mode active - skipping address fetch")
          } else {
            console.error("Error fetching addresses:", addressError)
          }
          // Try to load from localStorage as fallback
          const saved = localStorage.getItem("userAddresses")
          if (saved) {
            try {
              const parsed = JSON.parse(saved)
              // Deduplicate addresses from localStorage
              const deduplicated = deduplicateAddresses(parsed)
              setAddresses(deduplicated)
            } catch (e) {
              console.error("Error parsing saved addresses:", e)
            }
          }
        }
      } catch (error) {
        // Handle 503 (maintenance mode) gracefully - don't log as error
        if (error?.response?.status === 503) {
          // Maintenance mode is active - silently skip fetching profile
          // The maintenance screen will be shown by UserLayout
          console.log("Maintenance mode active - skipping profile fetch")
        } else {
          // Silently handle other errors - use existing profile from localStorage
          console.error("Error fetching user profile:", error)
        }
        // Try to load from localStorage as fallback
        const saved = localStorage.getItem("userAddresses")
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            // Deduplicate addresses from localStorage
            const deduplicated = deduplicateAddresses(parsed)
            setAddresses(deduplicated)
          } catch (e) {
            console.error("Error parsing saved addresses:", e)
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    // CRITICAL: Only fetch if we don't have local data, or defer if we do
    // This prevents unnecessary loading states and blinks
    // CRITICAL: For Flutter WebView - never show loading on initial mount
    if (hasLocalDataValue || isAuthPage()) {
      // We have local data or are on auth page, ensure loading is false immediately
      // Don't set loading to true at all - prevent any blink
      if (isMounted && loading) {
        setLoading(false)
      }
      // Still fetch in background to update, but don't show loading
      // Use longer delay for Flutter WebView to ensure smooth rendering
      initTimeout = setTimeout(() => {
        if (isMounted && !isAuthPage()) {
          fetchUserProfile()
        }
      }, 1500) // Longer delay for Flutter WebView - no rush since we have data
    } else {
      // No local data, fetch immediately but still defer to prevent blink
      // CRITICAL: Don't set loading to true immediately - defer it
      initTimeout = setTimeout(() => {
        if (isMounted && !isAuthPage()) {
          // Only set loading if we still don't have data after delay
          const stillNoData = !localStorage.getItem("user_user") && !localStorage.getItem("userProfile")
          if (stillNoData && isMounted) {
            setLoading(true)
          }
          fetchUserProfile()
        }
      }, 500) // Delay to allow Flutter WebView to render first
    }

    // Listen for auth changes with debouncing to prevent multiple rapid calls
    let authChangeTimeout = null
    const handleAuthChange = () => {
      // Clear any pending calls
      if (authChangeTimeout) {
        clearTimeout(authChangeTimeout)
      }
      // Debounce by 300ms to prevent multiple rapid calls
      authChangeTimeout = setTimeout(() => {
        if (isMounted && !isAuthPage()) {
          fetchUserProfile()
        }
      }, 300)
    }

    window.addEventListener("userAuthChanged", handleAuthChange)

    return () => {
      isMounted = false
      if (initTimeout) {
        clearTimeout(initTimeout)
      }
      if (authChangeTimeout) {
        clearTimeout(authChangeTimeout)
      }
      window.removeEventListener("userAuthChanged", handleAuthChange)
    }
  }, [])

  // Address functions - memoized with useCallback
  const addAddress = useCallback(async (address) => {
    // Check if user is authenticated
    const isAuthenticated = localStorage.getItem("user_authenticated") === "true" ||
      localStorage.getItem("user_accessToken")

    if (!isAuthenticated) {
      // For guests, just add to local state with a temporary ID
      const newAddress = {
        ...address,
        id: `guest_${Date.now()}`,
        _id: `guest_${Date.now()}`,
        isDefault: addresses.length === 0
      }

      setAddresses((prev) => {
        const updated = [...prev, newAddress]
        const deduplicated = deduplicateAddresses(updated)
        localStorage.setItem("userAddresses", JSON.stringify(deduplicated))
        return deduplicated
      })
      return newAddress
    }

    try {
      const response = await userAPI.addAddress(address)
      const newAddress = response?.data?.data?.address || response?.data?.address

      if (newAddress) {
        setAddresses((prev) => {
          const updated = [...prev, newAddress]
          // Deduplicate before saving
          const deduplicated = deduplicateAddresses(updated)
          localStorage.setItem("userAddresses", JSON.stringify(deduplicated))
          return deduplicated
        })
        return newAddress
      }
    } catch (error) {
      console.error("Error adding address:", error)
      throw error
    }
  }, [addresses.length, deduplicateAddresses])

  const updateAddress = useCallback(async (id, updatedAddress) => {
    // Check if user is authenticated
    const isAuthenticated = localStorage.getItem("user_authenticated") === "true" ||
      localStorage.getItem("user_accessToken")

    if (!isAuthenticated || String(id).startsWith('guest_')) {
      // For guests or guest addresses, update local state only
      setAddresses((prev) => {
        const updated = prev.map((addr) => (
          (addr.id === id || addr._id === id) ? { ...addr, ...updatedAddress, id } : addr
        ))
        const deduplicated = deduplicateAddresses(updated)
        localStorage.setItem("userAddresses", JSON.stringify(deduplicated))
        return deduplicated
      })
      return { ...updatedAddress, id }
    }

    try {
      const response = await userAPI.updateAddress(id, updatedAddress)
      const updatedAddr = response?.data?.data?.address || response?.data?.address

      if (updatedAddr) {
        setAddresses((prev) => {
          const updated = prev.map((addr) => (addr.id === id ? { ...updatedAddr, id } : addr))
          // Deduplicate before saving
          const deduplicated = deduplicateAddresses(updated)
          localStorage.setItem("userAddresses", JSON.stringify(deduplicated))
          return deduplicated
        })
        return updatedAddr
      }
    } catch (error) {
      console.error("Error updating address:", error)
      throw error
    }
  }, [deduplicateAddresses])

  const deleteAddress = useCallback(async (id) => {
    // Check if user is authenticated
    const isAuthenticated = localStorage.getItem("user_authenticated") === "true" ||
      localStorage.getItem("user_accessToken")

    if (!isAuthenticated || String(id).startsWith('guest_')) {
      // For guests or guest addresses, delete from local state only
      setAddresses((prev) => {
        const newAddresses = prev.filter((addr) => addr.id !== id && addr._id !== id)
        const deduplicated = deduplicateAddresses(newAddresses)
        localStorage.setItem("userAddresses", JSON.stringify(deduplicated))
        return deduplicated
      })
      return
    }

    try {
      await userAPI.deleteAddress(id)
      setAddresses((prev) => {
        const newAddresses = prev.filter((addr) => addr.id !== id)
        // Deduplicate before saving (in case there are other duplicates)
        const deduplicated = deduplicateAddresses(newAddresses)
        localStorage.setItem("userAddresses", JSON.stringify(deduplicated))
        return deduplicated
      })
    } catch (error) {
      console.error("Error deleting address:", error)
      throw error
    }
  }, [deduplicateAddresses])

  const setDefaultAddress = useCallback((id) => {
    setAddresses((prev) => {
      const updated = prev.map((addr) => ({
        ...addr,
        isDefault: addr.id === id,
      }))
      // Deduplicate before saving
      return deduplicateAddresses(updated)
    })
  }, [deduplicateAddresses])

  const getDefaultAddress = useCallback(() => {
    return deduplicatedAddresses.find((addr) => addr.isDefault) || deduplicatedAddresses[0] || null
  }, [deduplicatedAddresses])

  // Payment method functions - memoized with useCallback
  const addPaymentMethod = useCallback((payment) => {
    setPaymentMethods((prev) => {
      const newPayment = {
        ...payment,
        id: Date.now().toString(),
        isDefault: prev.length === 0 ? true : false,
      }
      return [...prev, newPayment]
    })
  }, [])

  const updatePaymentMethod = useCallback((id, updatedPayment) => {
    setPaymentMethods((prev) =>
      prev.map((pm) => (pm.id === id ? { ...pm, ...updatedPayment } : pm))
    )
  }, [])

  const deletePaymentMethod = useCallback((id) => {
    setPaymentMethods((prev) => {
      const paymentToDelete = prev.find((pm) => pm.id === id)
      const newPayments = prev.filter((pm) => pm.id !== id)

      // If deleting default, set first remaining as default
      if (paymentToDelete?.isDefault && newPayments.length > 0) {
        newPayments[0].isDefault = true
      }

      return newPayments
    })
  }, [])

  const setDefaultPaymentMethod = useCallback((id) => {
    setPaymentMethods((prev) =>
      prev.map((pm) => ({
        ...pm,
        isDefault: pm.id === id,
      }))
    )
  }, [])

  const getDefaultPaymentMethod = useCallback(() => {
    return paymentMethods.find((pm) => pm.isDefault) || paymentMethods[0] || null
  }, [paymentMethods])

  const getAddressById = useCallback((id) => {
    return deduplicatedAddresses.find((addr) => addr.id === id)
  }, [deduplicatedAddresses])

  const getPaymentMethodById = useCallback((id) => {
    return paymentMethods.find((pm) => pm.id === id)
  }, [paymentMethods])

  // Favorites functions - memoized with useCallback
  const addFavorite = useCallback((restaurant) => {
    setFavorites((prev) => {
      if (!prev.find(fav => fav.slug === restaurant.slug)) {
        return [...prev, restaurant]
      }
      return prev
    })
  }, [])

  const removeFavorite = useCallback((slug) => {
    setFavorites((prev) => prev.filter(fav => fav.slug !== slug))
  }, [])

  const isFavorite = useCallback((slug) => {
    return favorites.some(fav => fav.slug === slug)
  }, [favorites])

  const getFavorites = useCallback(() => {
    return favorites
  }, [favorites])

  // Dish favorites functions - memoized with useCallback
  const addDishFavorite = useCallback((dish) => {
    setDishFavorites((prev) => {
      if (!prev.find(fav => fav.id === dish.id && fav.restaurantId === dish.restaurantId)) {
        return [...prev, dish]
      }
      return prev
    })
  }, [])

  const removeDishFavorite = useCallback((dishId, restaurantId) => {
    setDishFavorites((prev) =>
      prev.filter(fav => !(fav.id === dishId && fav.restaurantId === restaurantId))
    )
  }, [])

  const isDishFavorite = useCallback((dishId, restaurantId) => {
    return dishFavorites.some(fav => fav.id === dishId && fav.restaurantId === restaurantId)
  }, [dishFavorites])

  const getDishFavorites = useCallback(() => {
    return dishFavorites
  }, [dishFavorites])

  // User profile functions - memoized with useCallback
  const updateUserProfile = useCallback((updatedProfile) => {
    setUserProfile((prev) => ({ ...prev, ...updatedProfile }))
  }, [])

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      userProfile,
      loading,
      updateUserProfile,
      addresses: deduplicatedAddresses, // Always use deduplicated addresses
      paymentMethods,
      favorites,
      vegMode,
      setVegMode,
      addAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
      getDefaultAddress,
      getAddressById,
      addPaymentMethod,
      updatePaymentMethod,
      deletePaymentMethod,
      setDefaultPaymentMethod,
      getDefaultPaymentMethod,
      getPaymentMethodById,
      addFavorite,
      removeFavorite,
      isFavorite,
      getFavorites,
      dishFavorites,
      addDishFavorite,
      removeDishFavorite,
      isDishFavorite,
      getDishFavorites,
    }),
    [
      userProfile,
      loading,
      updateUserProfile,
      deduplicatedAddresses,
      paymentMethods,
      favorites,
      dishFavorites,
      vegMode,
      setVegMode,
      addAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
      getDefaultAddress,
      getAddressById,
      addPaymentMethod,
      updatePaymentMethod,
      deletePaymentMethod,
      setDefaultPaymentMethod,
      getDefaultPaymentMethod,
      getPaymentMethodById,
      addFavorite,
      removeFavorite,
      isFavorite,
      getFavorites,
      addDishFavorite,
      removeDishFavorite,
      isDishFavorite,
      getDishFavorites,
    ]
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (!context) {
    // Return fallback values instead of throwing error
    // This prevents crashes when ProfileProvider is not available
    console.warn("useProfile called outside ProfileProvider - using fallback values")
    return {
      userProfile: null,
      loading: false,
      updateUserProfile: () => console.warn("ProfileProvider not available"),
      addresses: [],
      paymentMethods: [],
      favorites: [],
      addAddress: () => console.warn("ProfileProvider not available"),
      updateAddress: () => console.warn("ProfileProvider not available"),
      deleteAddress: () => console.warn("ProfileProvider not available"),
      setDefaultAddress: () => console.warn("ProfileProvider not available"),
      getDefaultAddress: () => null,
      getAddressById: () => null,
      addPaymentMethod: () => console.warn("ProfileProvider not available"),
      updatePaymentMethod: () => console.warn("ProfileProvider not available"),
      deletePaymentMethod: () => console.warn("ProfileProvider not available"),
      setDefaultPaymentMethod: () => console.warn("ProfileProvider not available"),
      getDefaultPaymentMethod: () => null,
      getPaymentMethodById: () => null,
      addFavorite: () => console.warn("ProfileProvider not available"),
      removeFavorite: () => console.warn("ProfileProvider not available"),
      isFavorite: () => false,
      getFavorites: () => [],
      dishFavorites: [],
      addDishFavorite: () => console.warn("ProfileProvider not available"),
      removeDishFavorite: () => console.warn("ProfileProvider not available"),
      isDishFavorite: () => false,
      getDishFavorites: () => [],
      vegMode: true,
      setVegMode: () => console.warn("ProfileProvider not available")
    }
  }
  return context
}


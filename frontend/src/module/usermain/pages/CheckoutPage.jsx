import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useLocation } from "@/module/user/hooks/useLocation"
import {
  ArrowLeft,
  MapPin,
  CreditCard,
  Clock,
  ShoppingBag,
  Home,
  Heart,
  Menu,
  ChefHat,
  Phone,
  User,
  Building2,
  Check,
  Plus
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { userAPI } from "@/lib/api"

// Get icon based on address type/label
const getAddressIcon = (address) => {
  const label = (address.label || address.additionalDetails || "").toLowerCase()
  if (label.includes("home")) return Home
  if (label.includes("work") || label.includes("office")) return Building2
  if (label.includes("building") || label.includes("apt")) return Building2
  return Home
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { location: globalLocation } = useLocation()
  const [paymentMethod, setPaymentMethod] = useState("card")
  const [userData, setUserData] = useState(null)
  const [addressLabel, setAddressLabel] = useState("Other")

  const [addresses, setAddresses] = useState([])
  const [addressesLoading, setAddressesLoading] = useState(true)
  const [selectedAddressId, setSelectedAddressId] = useState(null)
  const [isAddressSelectorOpen, setIsAddressSelectorOpen] = useState(false)
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false)
  const [savingAddress, setSavingAddress] = useState(false)
  const [defaultCityState, setDefaultCityState] = useState({
    city: "",
    state: ""
  })
  const [addressFormData, setAddressFormData] = useState({
    flatRoom: "",
    floor: "",
    building: "",
    landmark: "",
    name: "",
    phone: "",
    pinCode: "",
    addLocation: ""
  })

  // Get order data from localStorage (set by CartPage) or use default
  const getOrderData = () => {
    const cartData = localStorage.getItem('usermain_cart')
    if (cartData) {
      try {
        const cartItems = JSON.parse(cartData)
        const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        const deliveryFee = 5.00
        const discount = 0
        const total = subtotal + deliveryFee - discount

        return {
          items: cartItems,
          subtotal: subtotal,
          deliveryFee: deliveryFee,
          discount: discount,
          total: total,
          deliveryAddress: "202, Princess Centre, 2nd Floor, 6/3, 452001, New Delhi",
          estimatedTime: "30-40 min"
        }
      } catch (error) {
        console.error('Error parsing cart data:', error)
      }
    }

    // Default fallback data
    return {
      items: [
        { id: 1, name: "Fried Spicy Chicken Wings", quantity: 1, price: 37.99 },
        { id: 2, name: "Seafood Pizza", quantity: 1, price: 29.99 },
        { id: 3, name: "Tuna Salad", quantity: 2, price: 9.99 },
        { id: 4, name: "Hamburger", quantity: 2, price: 9.99 },
      ],
      subtotal: 88.98,
      deliveryFee: 5.00,
      discount: 0,
      total: 93.98,
      deliveryAddress: "202, Princess Centre, 2nd Floor, 6/3, 452001, New Delhi",
      estimatedTime: "30-40 min"
    }
  }

  const orderSummary = getOrderData()

  const formatAddress = (address) => {
    if (!address) return ""

    // If it's a saved address object from DB
    if (address.street || address.additionalDetails || address.city) {
      const parts = [
        address.street,
        address.additionalDetails,
        address.city,
        address.state,
        address.zipCode
      ].filter(part => part && String(part).trim() !== "")

      return parts.join(", ")
    }

    // If it's a location object from context
    return address.formattedAddress || address.address || ""
  }

  const selectedAddress = addresses.find(addr => (addr.id || addr._id) === selectedAddressId) || null

  // Get user data from localStorage
  useEffect(() => {
    const userStr = localStorage.getItem('user_user') || localStorage.getItem('userProfile')
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        setUserData(user)
        setAddressFormData(prev => ({
          ...prev,
          name: user?.name || prev.name,
          phone: user?.phone || prev.phone
        }))
      } catch (error) {
        console.error('Error parsing user data:', error)
      }
    }
  }, [])

  // Load default city/state and pincode from saved user location if available
  useEffect(() => {
    try {
      const locationStr = localStorage.getItem("userLocation")
      if (locationStr) {
        const location = JSON.parse(locationStr)
        setDefaultCityState(prev => ({
          city: location.city || prev.city,
          state: location.state || prev.state
        }))
        setAddressFormData(prev => ({
          ...prev,
          pinCode: location.zipCode || prev.pinCode,
          addLocation: prev.addLocation || location.area || ""
        }))
      }
    } catch (error) {
      console.error("Error parsing userLocation:", error)
    }
  }, [])

  // Fetch saved addresses from backend
  useEffect(() => {
    const fetchAddresses = async () => {
      try {
        setAddressesLoading(true)
        const response = await userAPI.getAddresses()
        const addressesData = response?.data?.data?.addresses || response?.data?.addresses || []
        setAddresses(addressesData)

        // Prioritize selection:
        // 1. Current address from global location context (marked as manual selection)
        // 2. Default address from DB
        // 3. First address in list

        const globalAddressId = globalLocation?.id || globalLocation?._id || globalLocation?.addressId;

        let initialAddress = null;
        if (globalAddressId) {
          initialAddress = addressesData.find(addr => (addr.id || addr._id) === globalAddressId);
        }

        if (!initialAddress) {
          initialAddress = addressesData.find(addr => addr.isDefault) || addressesData[0];
        }

        if (initialAddress) {
          const id = initialAddress.id || initialAddress._id
          setSelectedAddressId(id)
          setAddressLabel(initialAddress.label || "Other")
        } else if (globalLocation?.formattedAddress) {
          // If no saved address matches but we have a custom location, keep track of that
          // Note: In this case selectedAddressId remains null, handled in fallback UI
        }
      } catch (error) {
        console.error("Error fetching user addresses:", error)
        setAddresses([])
      } finally {
        setAddressesLoading(false)
      }
    }

    fetchAddresses()
  }, [globalLocation?.id, globalLocation?._id, globalLocation?.addressId])

  const [validationError, setValidationError] = useState(false)

  // Save order data to localStorage before navigating to payment
  const handleProceedToPayment = () => {
    // Validation: Check if a delivery address is available
    const finalAddress = selectedAddress || globalLocation;
    const finalAddressText = formatAddress(finalAddress);

    if (!finalAddressText || finalAddressText === "Select location") {
      setValidationError(true)
      alert("Please select or add a delivery address to proceed.")
      return
    }

    setValidationError(false)

    const orderDataWithDetails = {
      ...orderSummary,
      deliveryAddress: finalAddressText,
      additionalAddressDetails: selectedAddress?.additionalDetails || globalLocation?.area || "",
      addressLabel: selectedAddress?.label || addressLabel || globalLocation?.area || "Current Location",
      customerName: userData?.name || "Guest",
      customerPhone: userData?.phone || "",
      latitude: selectedAddress?.latitude || globalLocation?.latitude,
      longitude: selectedAddress?.longitude || globalLocation?.longitude
    }

    localStorage.setItem('usermain_current_order', JSON.stringify(orderDataWithDetails))
    const targetMethod = paymentMethod === "cash" ? "cash" : "card";
    navigate(`/usermain/payment?method=${targetMethod}`)
  }

  const handleAddressFieldChange = (field, value) => {
    setAddressFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSaveAddress = async (e) => {
    e.preventDefault()

    const streetParts = [
      addressFormData.flatRoom,
      addressFormData.floor,
      addressFormData.building
    ].map(v => v && v.trim()).filter(Boolean)

    if (streetParts.length === 0) {
      alert("Please fill flat/room, floor or building name for the address")
      return
    }

    const additionalParts = [
      addressFormData.landmark,
      addressFormData.addLocation
    ].map(v => v && v.trim()).filter(Boolean)

    setSavingAddress(true)
    try {
      // Try to get city/state from default city state, then globalLocation, then localStorage
      let city = defaultCityState.city
      let state = defaultCityState.state

      if (!city || !state) {
        // Try globalLocation
        city = city || globalLocation?.city || ""
        state = state || globalLocation?.state || ""
      }

      if (!city || !state) {
        // Try localStorage userLocation
        try {
          const locationStr = localStorage.getItem("userLocation")
          if (locationStr) {
            const loc = JSON.parse(locationStr)
            city = city || loc.city || ""
            state = state || loc.state || ""
          }
        } catch (e) { /* ignore */ }
      }

      if (!city || !state) {
        alert("City/State not detected. Please update your location from the home screen before saving an address.")
        setSavingAddress(false)
        return
      }

      const payload = {
        label: addressLabel || "Other",
        street: streetParts.join(", "),
        additionalDetails: additionalParts.join(", "),
        city,
        state,
        zipCode: (addressFormData.pinCode || "").trim(),
        latitude: globalLocation?.latitude || 0,
        longitude: globalLocation?.longitude || 0,
        receiverName: addressFormData.name || userData?.name || "",
        phone: addressFormData.phone || userData?.phone || ""
      }

      const response = await userAPI.addAddress(payload)
      const newAddress = response?.data?.data?.address || response?.data?.address

      if (newAddress) {
        const updated = [...addresses, newAddress]
        setAddresses(updated)
        const id = newAddress.id || newAddress._id
        setSelectedAddressId(id)
        setAddressLabel(newAddress.label || "Other")
        setIsAddressFormOpen(false)
        setIsAddressSelectorOpen(false)
      }
    } catch (error) {
      console.error("Error saving address:", error)
      const message = error?.response?.data?.message || "Failed to save address"
      alert(message)
    } finally {
      setSavingAddress(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6e9dc] pb-24">
      {/* Header */}
      <div className="bg-white sticky top-0 z-50 rounded-b-3xl">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-800" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Checkout</h1>
        </div>
      </div>

      {/* Delivery Address - Clearer Selection */}
      <div className="px-4 py-4">
        <div className={`bg-white rounded-2xl p-4 shadow-sm transition-all ${validationError ? "ring-2 ring-red-500" : ""}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#ff8100]" />
                Delivery Address
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Confirm which address you want your order delivered to
              </p>
            </div>
            <button
              onClick={() => setIsAddressSelectorOpen(true)}
              className="text-xs font-bold text-[#ff8100] px-3 py-1.5 bg-[#fff7ed] rounded-lg border border-[#ff8100]/20"
            >
              + Add New
            </button>
          </div>

          {addressesLoading ? (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl animate-pulse">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                <div className="h-2 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ) : addresses.length === 0 ? (
            <button
              onClick={() => setIsAddressSelectorOpen(true)}
              className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors gap-2"
            >
              <Plus className="w-6 h-6 text-gray-400" />
              <p className="text-sm font-medium text-gray-600">Add a delivery address</p>
            </button>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1">
              {addresses.map((addr) => {
                const id = addr.id || addr._id;
                const isSelected = id === selectedAddressId;
                const Icon = getAddressIcon(addr);

                return (
                  <button
                    key={id}
                    onClick={() => {
                      setSelectedAddressId(id);
                      setAddressLabel(addr.label || "Other");
                      setValidationError(false);
                    }}
                    className={`flex-shrink-0 w-[180px] p-3 rounded-xl border-2 transition-all relative ${isSelected
                      ? "border-[#ff8100] bg-[#fff7ed]/50 shadow-md shadow-[#ff8100]/5"
                      : "border-gray-100 bg-white hover:border-gray-200"
                      }`}
                  >
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 bg-[#ff8100] text-white p-1 rounded-full shadow-lg">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg ${isSelected ? "bg-[#ff8100] text-white" : "bg-gray-100 text-gray-500"}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${isSelected ? "text-[#ff8100]" : "text-gray-500"}`}>
                        {addr.label || "Home"}
                      </span>
                    </div>
                    <p className={`text-[11px] leading-relaxed line-clamp-2 text-left ${isSelected ? "text-gray-900 font-medium" : "text-gray-600"}`}>
                      {formatAddress(addr)}
                    </p>
                    {addr.phone && (
                      <p className="text-[10px] text-gray-400 mt-1.5 text-left truncate">
                        {addr.phone}
                      </p>
                    )}
                  </button>
                );
              })}

              <button
                onClick={() => {
                  setIsAddressFormOpen(true);
                  setIsAddressSelectorOpen(true);
                }}
                className="flex-shrink-0 w-[100px] flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors gap-1.5 group"
              >
                <div className="p-2 bg-white rounded-full shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                  <Plus className="w-4 h-4 text-gray-400" />
                </div>
                <span className="text-[10px] font-bold text-gray-500">Add New</span>
              </button>
            </div>
          )}

          {selectedAddress && (
            <div className="mt-2 pt-3 border-t border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                <p className="text-[10px] font-medium text-gray-500">
                  Delivering to <span className="text-gray-900">{selectedAddress.label || "Home"}</span>
                </p>
              </div>
              <button
                onClick={() => setIsAddressSelectorOpen(true)}
                className="text-[10px] font-bold text-[#ff8100] hover:underline"
              >
                Change
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Customer Contact */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {userData?.name || "Guest"}
                </p>
                {userData?.phone && (
                  <p className="text-xs text-gray-600">{userData.phone}</p>
                )}
              </div>
            </div>
            <button className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </button>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Order Items</h3>
          <div className="space-y-3">
            {orderSummary.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">Quantity: {item.quantity}</p>
                </div>
                <p className="text-sm font-bold text-gray-900">
                  ${(item.price * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Order Summary */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Order Summary</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="text-gray-900 font-medium">${orderSummary.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Delivery Fee</span>
              <span className="text-gray-900 font-medium">${orderSummary.deliveryFee.toFixed(2)}</span>
            </div>
            {orderSummary.discount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Discount</span>
                <span className="text-[#ff8100] font-medium">-${orderSummary.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-gray-900">Total</span>
                <span className="text-xl font-bold text-[#ff8100]">${orderSummary.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Estimated Delivery Time */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-[#ff8100] rounded-lg p-2">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Estimated Delivery Time</p>
              <p className="text-sm font-bold text-gray-900">{orderSummary.estimatedTime}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Final Delivery Confirmation - Before Payment */}
      {(selectedAddress || globalLocation) && (
        <div className="px-4 mb-4">
          <div className="bg-[#fff7ed] border border-[#ff8100]/30 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-[#ff8100] uppercase tracking-wider">Confirm Your Address</span>
              <button
                onClick={() => {
                  setIsAddressSelectorOpen(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="text-xs font-bold text-[#ff8100] bg-white px-3 py-1 rounded-full border border-[#ff8100]/20 shadow-sm"
              >
                Change
              </button>
            </div>
            <div className="flex items-start gap-4">
              <div className="bg-[#ff8100] text-white p-2.5 rounded-xl shadow-lg shadow-orange-200">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 mb-0.5">
                  {selectedAddress?.label || (globalLocation?.isManual ? "Selected Location" : "Current Location")}
                </p>
                <p className="text-xs text-gray-600 leading-relaxed font-medium">
                  {formatAddress(selectedAddress || globalLocation)}
                </p>
              </div>
            </div>
            {paymentMethod === "cash" && (
              <div className="mt-4 p-3 bg-amber-100/50 border border-amber-200 rounded-xl flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                <p className="text-[10px] text-amber-900 font-bold leading-tight">
                  Verify above address carefully! Your order will be delivered here for Cash on Delivery.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Method */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Payment Method</h3>
          <div className="space-y-2">
            <button
              onClick={() => setPaymentMethod("card")}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${paymentMethod === "card"
                ? "border-[#ff8100] bg-[#ff8100]/10"
                : "border-gray-200 bg-white"
                }`}
            >
              <CreditCard className={`w-5 h-5 ${paymentMethod === "card" ? "text-[#ff8100]" : "text-gray-400"}`} />
              <span className={`text-sm font-medium ${paymentMethod === "card" ? "text-[#ff8100]" : "text-gray-700"}`}>
                Credit/Debit Card
              </span>
            </button>
            <button
              onClick={() => setPaymentMethod("cash")}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${paymentMethod === "cash"
                ? "border-[#ff8100] bg-[#ff8100]/10"
                : "border-gray-200 bg-white"
                }`}
            >
              <ShoppingBag className={`w-5 h-5 ${paymentMethod === "cash" ? "text-[#ff8100]" : "text-gray-400"}`} />
              <span className={`text-sm font-medium ${paymentMethod === "cash" ? "text-[#ff8100]" : "text-gray-700"}`}>
                Cash on Delivery
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Proceed to Payment Button */}
      <div className="px-4 pb-20">
        <Button
          className="w-full bg-[#ff8100] hover:bg-[#e67300] text-white font-bold py-4 rounded-xl text-base"
          onClick={handleProceedToPayment}
        >
          {paymentMethod === "cash" ? "Place Order" : "Proceed to Payment"}
        </Button>
      </div>

      {/* Delivery Address Selector & Add New Address */}
      {isAddressSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-md bg-white rounded-t-3xl p-4 pb-6">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => {
                  if (isAddressFormOpen) {
                    setIsAddressFormOpen(false)
                  } else {
                    setIsAddressSelectorOpen(false)
                  }
                }}
                className="p-2 -ml-2 rounded-full hover:bg-gray-100"
              >
                <ArrowLeft className="w-4 h-4 text-gray-800" />
              </button>
              <h2 className="flex-1 text-center text-sm font-semibold text-gray-900 -ml-2">
                Delivery Address
              </h2>
              <div className="w-8" />
            </div>

            {!isAddressFormOpen ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsAddressFormOpen(true)}
                  className="w-full flex items-center justify-between bg-[#e9f9ee] border border-[#44c776] rounded-xl px-4 py-3 mb-4"
                >
                  <span className="text-sm font-semibold text-[#15803d]">+ Add New Address</span>
                  <ArrowLeft className="w-4 h-4 rotate-180 text-[#15803d]" />
                </button>

                <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wide">
                  Saved Addresses
                </p>

                {addressesLoading ? (
                  <p className="text-xs text-gray-500">Loading addresses...</p>
                ) : addresses.length === 0 ? (
                  <p className="text-xs text-gray-500">No saved addresses found.</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {addresses.map(address => {
                      const id = address.id || address._id
                      const isSelected = id === selectedAddressId
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setSelectedAddressId(id)
                            setAddressLabel(address.label || "Other")
                            setIsAddressSelectorOpen(false)
                          }}
                          className={`w-full flex items-center justify-between rounded-xl border px-3 py-3 text-left ${isSelected ? "border-[#ff8100] bg-[#fff3e6]" : "border-gray-200"
                            }`}
                        >
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 mt-0.5 text-[#ff8100]" />
                            <div>
                              <p className="text-xs font-semibold text-gray-900">
                                {formatAddress(address)}
                              </p>
                              {address.label && (
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                  {address.label}
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className={`w-4 h-4 rounded-full border ${isSelected
                              ? "border-[#ff8100] bg-[#ff8100]"
                              : "border-gray-300"
                              }`}
                          />
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <form
                onSubmit={handleSaveAddress}
                className="space-y-4 max-h-[70vh] overflow-y-auto pb-60 px-1"
              >
                <div className="space-y-2">
                  <Input
                    placeholder="Flat/Room No"
                    value={addressFormData.flatRoom}
                    onChange={(e) => handleAddressFieldChange("flatRoom", e.target.value)}
                    onFocus={(e) => {
                      setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
                    }}
                    className="h-11 bg-gray-50 border-gray-200 text-sm"
                  />
                  <Input
                    placeholder="Floor"
                    value={addressFormData.floor}
                    onChange={(e) => handleAddressFieldChange("floor", e.target.value)}
                    onFocus={(e) => {
                      setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
                    }}
                    className="h-11 bg-gray-50 border-gray-200 text-sm"
                  />
                  <Input
                    placeholder="Building/Chawl Name"
                    value={addressFormData.building}
                    onChange={(e) => handleAddressFieldChange("building", e.target.value)}
                    onFocus={(e) => {
                      setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
                    }}
                    className="h-11 bg-gray-50 border-gray-200 text-sm"
                  />
                  <Input
                    placeholder="Landmark"
                    value={addressFormData.landmark}
                    onChange={(e) => handleAddressFieldChange("landmark", e.target.value)}
                    onFocus={(e) => {
                      setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
                    }}
                    className="h-11 bg-gray-50 border-gray-200 text-sm"
                  />
                  <Input
                    placeholder="Your Name"
                    value={addressFormData.name}
                    onChange={(e) => handleAddressFieldChange("name", e.target.value)}
                    onFocus={(e) => {
                      setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
                    }}
                    className="h-11 bg-gray-50 border-gray-200 text-sm"
                  />
                  <Input
                    placeholder="Phone Number"
                    value={addressFormData.phone}
                    onChange={(e) => handleAddressFieldChange("phone", e.target.value)}
                    onFocus={(e) => {
                      setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
                    }}
                    className="h-11 bg-gray-50 border-gray-200 text-sm"
                  />
                  <Input
                    placeholder="Pin code"
                    value={addressFormData.pinCode}
                    onChange={(e) => handleAddressFieldChange("pinCode", e.target.value)}
                    onFocus={(e) => {
                      setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
                    }}
                    className="h-11 bg-gray-50 border-gray-200 text-sm"
                  />
                  <Input
                    placeholder="Add Location"
                    value={addressFormData.addLocation}
                    onChange={(e) => handleAddressFieldChange("addLocation", e.target.value)}
                    onFocus={(e) => {
                      setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
                    }}
                    className="h-11 bg-gray-50 border-gray-200 text-sm"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={savingAddress}
                  className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white font-semibold h-11 rounded-xl"
                >
                  {savingAddress ? "Saving..." : "Save Address"}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar - Mobile Only */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="flex items-center justify-around py-2 px-4">
          <button
            onClick={() => navigate('/usermain')}
            className="flex flex-col items-center gap-1 p-2 text-gray-600 hover:text-[#ff8100] transition-colors"
          >
            <Home className="w-6 h-6" />
            <span className="text-xs text-gray-600 font-medium">Home</span>
          </button>
          <button
            onClick={() => navigate('/usermain/wishlist')}
            className="flex flex-col items-center gap-1 p-2 text-gray-600 hover:text-[#ff8100] transition-colors"
          >
            <Heart className="w-6 h-6" />
            <span className="text-xs text-gray-600 font-medium">Wishlist</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-2 -mt-8">
            <div className="bg-white rounded-full p-3 shadow-lg border-2 border-gray-200">
              <ChefHat className="w-6 h-6 text-gray-600" />
            </div>
          </button>
          <button className="flex flex-col items-center gap-1 p-2 text-gray-600">
            <ShoppingBag className="w-6 h-6" />
            <span className="text-xs text-gray-600 font-medium">Orders</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-2 text-gray-600">
            <Menu className="w-6 h-6" />
            <span className="text-xs text-gray-600 font-medium">Menu</span>
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
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
  User
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { userAPI } from "@/lib/api"

export default function CheckoutPage() {
  const navigate = useNavigate()
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
    city: "Indore",
    state: "Madhya Pradesh"
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
    if (!address) return orderSummary.deliveryAddress
    const parts = [
      address.street,
      address.additionalDetails,
      address.city,
      address.state,
      address.zipCode
    ].filter(Boolean)
    return parts.join(", ")
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

        const defaultAddress = addressesData.find(addr => addr.isDefault) || addressesData[0]
        if (defaultAddress) {
          const id = defaultAddress.id || defaultAddress._id
          setSelectedAddressId(id)
          setAddressLabel(defaultAddress.label || "Other")
        }
      } catch (error) {
        console.error("Error fetching user addresses:", error)
        setAddresses([])
      } finally {
        setAddressesLoading(false)
      }
    }

    fetchAddresses()
  }, [])

  // Save order data to localStorage before navigating to payment
  const handleProceedToPayment = () => {
    if (!selectedAddress) {
      alert("Please choose a delivery address")
      return
    }

    const deliveryAddressText = formatAddress(selectedAddress)

    const orderDataWithDetails = {
      ...orderSummary,
      deliveryAddress: deliveryAddressText,
      additionalAddressDetails: selectedAddress.additionalDetails || "",
      addressLabel: selectedAddress.label || addressLabel,
      customerName: userData?.name || "Guest",
      customerPhone: userData?.phone || ""
    }
    
    localStorage.setItem('usermain_current_order', JSON.stringify(orderDataWithDetails))
    if (paymentMethod === "cash") {
      navigate(`/usermain/payment?method=cash`)
    } else {
      navigate(`/usermain/payment?method=card`)
    }
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
      const payload = {
        label: addressLabel || "Other",
        street: streetParts.join(", "),
        additionalDetails: additionalParts.join(", "),
        city: defaultCityState.city,
        state: defaultCityState.state,
        zipCode: (addressFormData.pinCode || "").trim()
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

      {/* Delivery Address - tap to choose */}
      <div className="px-4 py-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Delivery Address</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Tap to choose where your order will be delivered
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAddressSelectorOpen(true)}
            className="w-full flex items-start gap-2 rounded-xl border border-dashed border-gray-300 px-3 py-3 hover:border-[#ff8100] hover:bg-[#fff7ed] transition-colors"
          >
            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-left">
              {selectedAddress ? (
                <>
                  <p className="text-xs text-gray-900">
                    {formatAddress(selectedAddress)}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {selectedAddress.label || addressLabel}
                  </p>
                </>
              ) : addressesLoading ? (
                <p className="text-xs text-gray-500">Loading addresses...</p>
              ) : (
                <p className="text-xs text-gray-500">
                  No saved address found. Tap to add a new address.
                </p>
              )}
            </div>
            <ArrowLeft className="w-4 h-4 rotate-180 text-gray-400 flex-shrink-0" />
          </button>
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

      {/* Payment Method */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Payment Method</h3>
          <div className="space-y-2">
            <button
              onClick={() => setPaymentMethod("card")}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                paymentMethod === "card"
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
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                paymentMethod === "cash"
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
                          className={`w-full flex items-center justify-between rounded-xl border px-3 py-3 text-left ${
                            isSelected ? "border-[#ff8100] bg-[#fff3e6]" : "border-gray-200"
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
                            className={`w-4 h-4 rounded-full border ${
                              isSelected
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
                className="space-y-3 max-h-[80vh] overflow-y-auto"
              >
                <div className="space-y-2">
                  <Input
                    placeholder="Flat/Room No"
                    value={addressFormData.flatRoom}
                    onChange={(e) => handleAddressFieldChange("flatRoom", e.target.value)}
                    className="h-11 bg-gray-50 border-gray-200 text-sm"
                  />
                  <Input
                    placeholder="Floor"
                    value={addressFormData.floor}
                    onChange={(e) => handleAddressFieldChange("floor", e.target.value)}
                    className="h-11 bg-gray-50 border-gray-200 text-sm"
                  />
                  <Input
                    placeholder="Building/Chawl Name"
                    value={addressFormData.building}
                    onChange={(e) => handleAddressFieldChange("building", e.target.value)}
                    className="h-11 bg-gray-50 border-gray-200 text-sm"
                  />
                  <Input
                    placeholder="Landmark"
                    value={addressFormData.landmark}
                    onChange={(e) => handleAddressFieldChange("landmark", e.target.value)}
                    className="h-11 bg-gray-50 border-gray-200 text-sm"
                  />
                  <Input
                    placeholder="Your Name"
                    value={addressFormData.name}
                    onChange={(e) => handleAddressFieldChange("name", e.target.value)}
                    className="h-11 bg-gray-50 border-gray-200 text-sm"
                  />
                  <Input
                    placeholder="Phone Number"
                    value={addressFormData.phone}
                    onChange={(e) => handleAddressFieldChange("phone", e.target.value)}
                    className="h-11 bg-gray-50 border-gray-200 text-sm"
                  />
                  <Input
                    placeholder="Pin code"
                    value={addressFormData.pinCode}
                    onChange={(e) => handleAddressFieldChange("pinCode", e.target.value)}
                    className="h-11 bg-gray-50 border-gray-200 text-sm"
                  />
                  <Input
                    placeholder="Add Location"
                    value={addressFormData.addLocation}
                    onChange={(e) => handleAddressFieldChange("addLocation", e.target.value)}
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

import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"

import { CheckCircle, MapPin, CreditCard, ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"
import AnimatedPage from "../../components/AnimatedPage"
import ScrollReveal from "../../components/ScrollReveal"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useCart } from "../../context/CartContext"
import { useProfile } from "../../context/ProfileContext"
import { useOrders } from "../../context/OrdersContext"
import { ChevronRight, Plus } from "lucide-react"
import AddressFormModal from "../../components/AddressFormModal"
import DeliveryAddressSelectionModal from "../../components/DeliveryAddressSelectionModal"
import { useLocation } from "../../hooks/useLocation"
import { useEffect } from "react"
import { toast } from "sonner"

export default function Checkout() {
  const navigate = useNavigate()
  const { cart, clearCart } = useCart()
  const { getDefaultAddress, getDefaultPaymentMethod, addresses, paymentMethods } = useProfile()
  const { location } = useLocation()
  const { createOrder } = useOrders()
  const [selectedAddress, setSelectedAddress] = useState(getDefaultAddress()?.id || "")
  const [selectedPayment, setSelectedPayment] = useState(getDefaultPaymentMethod()?.id || "")
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [showAddressSelection, setShowAddressSelection] = useState(false)
  const [showAddressForm, setShowAddressForm] = useState(false)

  // Synchronize selection with global location context
  useEffect(() => {
    if (location?.addressId && location.addressId !== selectedAddress) {
      console.log("🔄 Syncing checkout address with global location:", location.addressId)
      setSelectedAddress(location.addressId)
    }
  }, [location?.addressId, selectedAddress])

  // If selectedAddress is still empty but addresses are available, set default
  useEffect(() => {
    if (!selectedAddress && addresses.length > 0) {
      const defaultAddr = getDefaultAddress()
      if (defaultAddr) setSelectedAddress(defaultAddr.id)
    }
  }, [addresses, getDefaultAddress, selectedAddress])

  const defaultAddress = addresses.find(addr => addr.id === selectedAddress) || getDefaultAddress()
  const defaultPayment = paymentMethods.find(pm => pm.id === selectedPayment) || getDefaultPaymentMethod()

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity * 83, 0)
  const deliveryFee = 2.99 * 83
  const tax = subtotal * 0.08
  const total = subtotal + deliveryFee + tax

  // Memoize filtered addresses with unique keys to prevent duplicate key errors
  const filteredAddressesWithKeys = useMemo(() => {
    if (!addresses || addresses.length === 0) return []

    // First remove duplicates by ID (keep first occurrence)
    const uniqueById = addresses.filter((address, index, self) => {
      if (!address.id) return true // Keep addresses without ID
      const firstIndex = self.findIndex(addr => addr.id === address.id)
      return index === firstIndex
    })

    // Then remove duplicates by label (keep first occurrence)
    const filteredAddresses = uniqueById.filter((address, index, self) => {
      const firstIndex = self.findIndex(addr => addr.label === address.label)
      return index === firstIndex
    })

    // Create unique keys for each address
    return filteredAddresses.map((address, index) => {
      const addressContent = JSON.stringify({
        id: address.id || '',
        label: address.label || '',
        street: address.street || '',
        city: address.city || '',
        state: address.state || ''
      })
      // Create a stable hash from address content
      let hash = 0
      for (let i = 0; i < addressContent.length; i++) {
        const char = addressContent.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
      }
      const uniqueKey = `checkout-addr-${index}-${Math.abs(hash)}-${address.id || index}-${address.label || 'label'}`

      return {
        address,
        uniqueKey
      }
    })
  }, [addresses])

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      toast.error("Please add or select a delivery address")
      setShowAddressSelection(true) // Open selection if missing
      return
    }

    const isComplete = defaultAddress && defaultAddress.street && defaultAddress.city && defaultAddress.zipCode;

    if (!isComplete) {
      toast.error("Your selected address is incomplete. Please edit it to include Building, City, and Pin Code.")
      setShowAddressSelection(true)
      return
    }

    if (!selectedPayment) {
      toast.error("Please select a payment method")
      return
    }

    if (cart.length === 0) {
      toast.error("Your cart is empty")
      return
    }

    setIsPlacingOrder(true)

    // Simulate API call
    setTimeout(() => {
      const orderId = createOrder({
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          itemSize: item.itemSize || "",
          itemSizeQuantity: item.itemSizeQuantity || "",
          itemSizeUnit: item.itemSizeUnit || ""
        })),
        address: defaultAddress,
        paymentMethod: defaultPayment,
        subtotal,
        deliveryFee,
        tax,
        total,
        restaurant: cart[0]?.restaurant || cart[0]?.name || "Multiple Restaurants"
      })

      clearCart()
      setIsPlacingOrder(false)
      navigate(`/user/orders/${orderId}?confirmed=true`)
    }, 1500)
  }


  if (cart.length === 0) {
    return (
      <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-orange-50/20 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg md:text-xl">Checkout</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg mb-4">Your cart is empty</p>
                <Link to="/user/cart">
                  <Button>Go to Cart</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-orange-50/20 dark:from-[#0a0a0a] dark:via-[#1a1a1a] dark:to-[#0a0a0a] p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        <ScrollReveal>
          <div className="flex items-center gap-4 mb-6 md:mb-8">
            <Link to="/cart">
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 md:h-10 md:w-10">
                <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" />
              </Button>
            </Link>
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold dark:text-white">Checkout</h1>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Left Column - Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery address details */}
            <ScrollReveal delay={0.1}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Delivery address details</p>
                  <div className={`bg-white dark:bg-[#1a1a1a] border ${!defaultAddress ? 'border-red-300 bg-red-50/30' : 'border-gray-100 dark:border-gray-800'} rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm`}>
                    <p className={`font-medium line-clamp-1 flex-1 pr-4 ${!defaultAddress ? 'text-red-500 italic' : 'text-gray-800 dark:text-white'}`}>
                      {defaultAddress ? (
                        [
                          defaultAddress.street,
                          defaultAddress.additionalDetails,
                          `${defaultAddress.city}, ${defaultAddress.state} ${defaultAddress.zipCode}`
                        ].filter(Boolean).join(", ")
                      ) : (
                        "No delivery address selected (Required)"
                      )}
                    </p>
                    <button
                      onClick={() => setShowAddressSelection(true)}
                      className="text-gray-400 dark:text-gray-500 font-medium flex items-center gap-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {defaultAddress ? 'Change' : 'Select'} <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div
                  onClick={() => setShowAddressForm(true)}
                  className="w-full flex items-center justify-between p-4 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100/50 dark:border-emerald-800/30 rounded-2xl cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-full">
                      <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">Add New Address</span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-emerald-400 dark:text-emerald-600 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </ScrollReveal>

            {/* Payment Method */}
            <ScrollReveal delay={0.2}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-yellow-600" />
                    Payment Method
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {paymentMethods.length > 0 ? (
                    <div className="space-y-3">
                      {paymentMethods.map((payment) => {
                        const isSelected = selectedPayment === payment.id
                        const cardNumber = `**** **** **** ${payment.cardNumber}`

                        return (
                          <div
                            key={payment.id}
                            className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${isSelected
                              ? "border-yellow-500 bg-yellow-50"
                              : "border-gray-200 hover:border-yellow-300"
                              }`}
                            onClick={() => setSelectedPayment(payment.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {payment.isDefault && (
                                    <Badge className="bg-yellow-500 text-white">Default</Badge>
                                  )}
                                  <Badge variant="outline" className="capitalize">
                                    {payment.type}
                                  </Badge>
                                </div>
                                <p className="font-semibold">{cardNumber}</p>
                                <p className="text-sm text-muted-foreground">
                                  {payment.cardHolder} • Expires {payment.expiryMonth}/{payment.expiryYear.slice(-2)}
                                </p>
                              </div>
                              {isSelected && (
                                <CheckCircle className="h-5 w-5 text-yellow-600" />
                              )}
                            </div>
                          </div>
                        )
                      })}
                      <Link to="/user/profile/payments">
                        <Button variant="outline" className="w-full">
                          Manage Payment Methods
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">No payment methods saved</p>
                      <Link to="/user/profile/payments/new">
                        <Button>Add Payment Method</Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <ScrollReveal delay={0.3}>
              <Card className="sticky top-4 md:top-6 dark:bg-[#1a1a1a] dark:border-gray-800">
                <CardHeader>
                  <CardTitle className="text-base md:text-lg lg:text-xl dark:text-white">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 md:space-y-6">
                  <div className="space-y-3 md:space-y-4 max-h-64 md:max-h-80 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 md:gap-4 pb-3 md:pb-4 border-b dark:border-gray-700">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm md:text-base dark:text-gray-200">
                            {item.name} {(() => {
                              const sizeUnit = item.itemSizeUnit || item.unit
                              const isPiece = sizeUnit && sizeUnit.trim().toLowerCase() === 'piece'
                              const displayParts = [item.itemSizeQuantity, !isPiece ? sizeUnit : null].filter(Boolean)
                              return displayParts.length > 0 ? `(${displayParts.join(' ')})` : ''
                            })()}
                          </p>
                          <p className="text-xs md:text-sm text-muted-foreground">
                            ₹{(item.price * 83).toFixed(0)} × {item.quantity}
                          </p>
                        </div>
                        <p className="font-semibold text-sm md:text-base dark:text-gray-200">
                          ₹{(item.price * 83 * item.quantity).toFixed(0)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 md:space-y-3 pt-4 md:pt-6 border-t dark:border-gray-700">
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="dark:text-gray-200">₹{subtotal.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      <span className="dark:text-gray-200">₹{deliveryFee.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="dark:text-gray-200">₹{tax.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg md:text-xl lg:text-2xl pt-2 md:pt-3 border-t dark:border-gray-700">
                      <span className="dark:text-white">Total</span>
                      <span className="text-yellow-600 dark:text-yellow-400">₹{total.toFixed(0)}</span>
                    </div>
                  </div>

                  {(() => {
                    const isAddressSelected = !!selectedAddress && !!defaultAddress?.id;
                    const isAddressComplete = !!(
                      defaultAddress?.id &&
                      defaultAddress?.street &&
                      defaultAddress?.city &&
                      defaultAddress?.zipCode
                    );
                    const canPlaceOrder = isAddressSelected && isAddressComplete && !!selectedPayment;

                    return (
                      <Button
                        className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white mt-4 md:mt-6 h-11 md:h-12 text-sm md:text-base border-none shadow-md"
                        onClick={handlePlaceOrder}
                        disabled={isPlacingOrder || !canPlaceOrder}
                      >
                        {isPlacingOrder
                          ? "Placing Order..."
                          : !isAddressSelected
                            ? "Select Address"
                            : !isAddressComplete
                              ? "Complete Address"
                              : !selectedPayment
                                ? "Select Payment"
                                : "Place Order"}
                      </Button>
                    );
                  })()}
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>
        </div>
      </div>
      {/* Modals */}
      <DeliveryAddressSelectionModal
        isOpen={showAddressSelection}
        onClose={() => setShowAddressSelection(false)}
        addresses={addresses}
        selectedAddressId={selectedAddress}
        onSelect={(id) => {
          setSelectedAddress(id)
          setShowAddressSelection(false)
        }}
        onAddNew={() => {
          setShowAddressSelection(false)
          setShowAddressForm(true)
        }}
      />

      <AddressFormModal
        isOpen={showAddressForm}
        onClose={() => setShowAddressForm(false)}
        onSaveSuccess={(newAddress) => {
          setSelectedAddress(newAddress.id)
          setShowAddressForm(false)
        }}
      />
    </AnimatedPage>
  )
}

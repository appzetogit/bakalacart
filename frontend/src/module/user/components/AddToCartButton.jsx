import { useState } from "react"
import { Plus, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "../context/CartContext"
import FoodCustomizationModal from "./FoodCustomizationModal"

export default function AddToCartButton({ item, restaurant, className = "" }) {
  const { addToCart, isInCart, getCartItem, updateQuantity } = useCart()
  const inCart = isInCart(item.id)
  const cartItem = getCartItem(item.id)
  const [showCustomizationModal, setShowCustomizationModal] = useState(false)

  // Check if item has variants
  const hasVariants = Array.isArray(item?.variations) && item.variations.length > 0

  const handleAddToCart = (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    // If item has variants, show customization modal
    if (hasVariants) {
      setShowCustomizationModal(true)
    } else {
      // Directly add to cart if no variants
      addToCart(item)
    }
  }

  const handleCustomizationAdd = (cartItem, quantity) => {
    // Add item with selected variant to cart
    for (let i = 0; i < quantity; i++) {
      addToCart(cartItem)
    }
  }

  const handleIncrease = (e) => {
    e.preventDefault()
    e.stopPropagation()
    updateQuantity(item.id, (cartItem?.quantity || 0) + 1)
  }

  const handleDecrease = (e) => {
    e.preventDefault()
    e.stopPropagation()
    updateQuantity(item.id, (cartItem?.quantity || 0) - 1)
  }

  if (inCart) {
    return (
      <div className={`flex items-center gap-2 ${className}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <div className="flex items-center gap-1 border border-primary-orange rounded-md">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-6 hover:bg-gray-100"
            onClick={handleDecrease}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="px-1 text-sm font-semibold min-w-[1rem] text-center">
            {cartItem?.quantity || 0}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-6 hover:bg-gray-100"
            onClick={handleIncrease}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Button
        size="sm"
        onClick={handleAddToCart}
        className="bg-primary-orange hover:opacity-90 text-white"
      >
        Add to Cart
      </Button>
      
      {/* Customization Modal for items with variants */}
      {hasVariants && (
        <FoodCustomizationModal
          item={item}
          restaurant={restaurant}
          isOpen={showCustomizationModal}
          onClose={() => setShowCustomizationModal(false)}
          onAddToCart={handleCustomizationAdd}
        />
      )}
    </>
  )
}

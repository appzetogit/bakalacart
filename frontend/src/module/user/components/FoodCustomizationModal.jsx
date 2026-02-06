import React, { useState, useEffect } from 'react';
import { X, Minus, Plus } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { toast } from 'sonner';

const FoodCustomizationModal = ({ item, restaurant, isOpen, onClose, onAddToCart }) => {
  const { addToCart } = useCart();
  
  // --- STATE MANAGEMENT ---
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  
  // Get variants from item
  const variants = Array.isArray(item?.variations) && item.variations.length > 0 
    ? item.variations 
    : [];

  // Initialize selected variant when modal opens
  useEffect(() => {
    if (isOpen && variants.length > 0) {
      // Select first variant by default
      setSelectedVariant(variants[0]?.id || null);
    }
  }, [isOpen, variants]);

  // Prevent body scroll when modal is open and ensure consistent positioning
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      // Disable body scroll
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.body.style.left = '0';
      document.body.style.right = '0';
      
      // Reset modal content scroll to top when opening
      const modalContent = document.querySelector('[data-modal-content]');
      if (modalContent) {
        modalContent.scrollTop = 0;
      }
      
      return () => {
        // Re-enable body scroll when modal closes
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        document.body.style.left = '';
        document.body.style.right = '';
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // --- PRICE CALCULATION ---
  const selectedVariantData = variants.find(v => v.id === selectedVariant);
  const variantPrice = selectedVariantData?.price || item?.price || 0;
  const totalItemPrice = variantPrice * quantity;

  // --- HELPER COMPONENT: VEG ICON ---
  const VegIcon = () => (
    <div className="w-5 h-5 border-2 border-green-600 flex items-center justify-center p-[2px] rounded-sm">
      <div className="w-full h-full bg-green-600 rounded-full"></div>
    </div>
  );

  const NonVegIcon = () => (
    <div className="w-5 h-5 border-2 border-red-600 flex items-center justify-center p-[2px] rounded-sm">
      <div className="w-full h-full bg-red-600 rounded-full"></div>
    </div>
  );

  const handleAddToCart = () => {
    if (!selectedVariant && variants.length > 0) {
      toast.error('Please select a variant');
      return;
    }

    // Prepare cart item with variant information
    const cartItem = {
      ...item,
      price: variantPrice,
      selectedVariant: selectedVariantData ? {
        id: selectedVariantData.id,
        name: selectedVariantData.name,
        price: selectedVariantData.price,
      } : null,
      quantity: quantity,
      restaurant: restaurant?.name || item.restaurant,
      restaurantId: restaurant?.restaurantId || restaurant?._id || restaurant?.id || item.restaurantId,
    };

    // Add to cart via callback or direct context
    if (onAddToCart) {
      onAddToCart(cartItem, quantity);
    } else {
      // Add multiple times if quantity > 1
      for (let i = 0; i < quantity; i++) {
        addToCart(cartItem);
      }
      toast.success(`${quantity} ${item.name} added to cart`);
    }

    onClose();
  };

  if (!isOpen || !item) return null;

  // Don't show modal if item has no variants
  if (variants.length === 0) {
    return null;
  }

  const isVeg = item.foodType === 'Veg' || item.isVeg === true;

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
      onClick={(e) => {
        // Close modal when clicking on backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Mobile Container */}
      <div 
        className="w-full max-w-[400px] max-h-[90vh] bg-white shadow-xl overflow-hidden flex flex-col relative rounded-xl"
        style={{
          margin: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* --- HEADER --- */}
        <div className="p-4 border-b pb-4 bg-white z-10 sticky top-0">
          <div className="flex justify-between items-start">
            <div className="flex gap-3 flex-1 min-w-0">
              {isVeg ? <VegIcon /> : <NonVegIcon />}
              <h2 className="text-lg font-bold text-gray-800 leading-tight flex-1">
                {item.name}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0 ml-2"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        {/* --- SCROLLABLE CONTENT --- */}
        <div className="flex-1 overflow-y-auto pb-24" data-modal-content>
          
          {/* Section 1: Quantity / Variants */}
          {variants.length > 0 && (
            <>
              <div className="p-5">
                <h3 className="font-bold text-lg text-gray-800">Quantity</h3>
                <p className="text-sm text-gray-500 mb-4">Required • Select any 1 option</p>
                
                <div className="flex flex-col gap-4">
                  {variants.map((variant) => (
                    <div 
                      key={variant.id} 
                      className="flex justify-between items-center cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors"
                      onClick={() => setSelectedVariant(variant.id)}
                    >
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-gray-800 font-medium">{variant.name}</span>
                        {variant.stock && variant.stock !== 'Unlimited' && (
                          <span className="text-xs text-gray-500 mt-1">
                            Stock: {variant.stock}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <span className="text-gray-700 text-sm font-semibold">₹{variant.price}</span>
                        {/* Custom Radio Button */}
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                          ${selectedVariant === variant.id ? 'border-[#ff3f6c]' : 'border-gray-300'}`}>
                          {selectedVariant === variant.id && (
                            <div className="w-2.5 h-2.5 bg-[#ff3f6c] rounded-full" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="border-gray-100 border-2" />
            </>
          )}

          {/* Item Description */}
          {item.description && (
            <div className="p-5">
              <h3 className="font-bold text-lg text-gray-800 mb-2">Description</h3>
              <p className="text-sm text-gray-600">{item.description}</p>
            </div>
          )}

          {/* Preparation Time */}
          {item.preparationTime && (
            <div className="px-5 pb-5">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="font-medium">Preparation Time:</span>
                <span>{item.preparationTime}</span>
              </div>
            </div>
          )}
        </div>

        {/* --- STICKY FOOTER --- */}
        <div className="absolute bottom-0 w-full bg-white border-t p-4 shadow-[0_-5px_10px_rgba(0,0,0,0.05)] flex items-center justify-between gap-4">
          
          {/* Stepper (Minus - Plus) */}
          <div className="flex items-center border border-rose-100 bg-rose-50 rounded-lg px-2 py-1.5 gap-3">
            <button 
              onClick={() => quantity > 1 && setQuantity(q => q - 1)}
              className="text-[#ff3f6c] font-bold text-xl px-2 hover:bg-rose-100 rounded transition-colors"
              disabled={quantity <= 1}
            >
              <Minus size={18} />
            </button>
            <span className="font-bold text-gray-800 min-w-[1.5rem] text-center">{quantity}</span>
            <button 
              onClick={() => setQuantity(q => q + 1)}
              className="text-[#ff3f6c] font-bold text-xl px-2 hover:bg-rose-100 rounded transition-colors"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Add Item Button */}
          <button 
            onClick={handleAddToCart}
            className="flex-1 bg-[#ff3f6c] hover:bg-[#e6365f] text-white font-bold py-3 rounded-lg shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={variants.length > 0 && !selectedVariant}
          >
            Add item ₹{totalItemPrice}
          </button>
        </div>

      </div>
    </div>
  );
};

export default FoodCustomizationModal;

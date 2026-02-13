import React, { useState, useEffect } from 'react';
import { X, Minus, Plus } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { toast } from 'sonner';

const FoodCustomizationModal = ({ item, restaurant, isOpen, onClose, onAddToCart }) => {
  const { addToCart } = useCart();

  // --- STATE MANAGEMENT ---
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);

  // Get variants from item and filter out rejected/invalid ones (where price is null)
  const variants = Array.isArray(item?.variations) && item.variations.length > 0
    ? item.variations.filter(v => v && v.price !== null && v.price !== undefined)
    : [];

  // Initialize selected variant when modal opens
  useEffect(() => {
    if (isOpen && variants.length > 0) {
      // Select first variant by default only if no variant is selected
      if (!selectedVariant) {
        const firstVariant = variants[0]
        const firstVariantId = String(firstVariant?.id || firstVariant?._id || `variant-0`)
        console.log('Initializing selected variant:', firstVariantId, 'from variant:', firstVariant)
        setSelectedVariant(firstVariantId);
      }
    } else if (!isOpen) {
      // Reset selection when modal closes
      setSelectedVariant(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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
  const selectedVariantData = variants.find(v => {
    const vId = String(v.id || v._id || '')
    const selectedId = String(selectedVariant || '')
    return vId === selectedId
  });
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

    // Create unique ID for cart item that includes variant
    // This ensures different variants are treated as separate items in cart
    const variantId = selectedVariantData ? String(selectedVariantData.id || selectedVariantData._id || '') : ''
    const uniqueCartItemId = variantId ? `${item.id}-variant-${variantId}` : item.id

    // Prepare cart item with variant information
    const cartItem = {
      ...item,
      id: uniqueCartItemId, // Use unique ID that includes variant
      originalItemId: item.id, // Keep original item ID for reference
      price: variantPrice,
      selectedVariant: selectedVariantData ? {
        id: selectedVariantData.id,
        name: selectedVariantData.name,
        price: selectedVariantData.price,
      } : null,
      // Update item name to include variant name for clarity in cart
      name: selectedVariantData 
        ? `${item.name} (${selectedVariantData.name})` 
        : item.name,
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
      const displayName = selectedVariantData 
        ? `${item.name} (${selectedVariantData.name})` 
        : item.name
      toast.success(`${quantity} ${displayName} added to cart`);
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
      className="fixed inset-0 bg-black/50 z-50"
      data-modal-backdrop
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={(e) => {
        // Close modal when clicking on backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Mobile Container - Perfectly Centered */}
      <div
        className="bg-white shadow-xl overflow-hidden flex flex-col rounded-xl"
        data-modal-container
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '400px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10000,
          margin: '0 auto',
          alignSelf: 'center',
          flexShrink: 0
        }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* --- HEADER --- */}
        <div className="p-4 border-b pb-4 bg-white z-10 sticky top-0">
          <div className="flex justify-between items-start mb-3">
            <div className="flex gap-3 flex-1 min-w-0">
              {/* Item Image */}
              {item.image && (
                <img 
                  src={item.image} 
                  alt={item.name}
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {isVeg ? <VegIcon /> : <NonVegIcon />}
                  <h2 className="text-lg font-bold text-gray-800 leading-tight flex-1">
                    {item.name}
                  </h2>
                </div>
              </div>
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
                 <h3 className="font-bold text-lg text-gray-800 mb-1">Quantity</h3>
                 <p className="text-sm text-gray-500 mb-4">Required • Select any 1 option</p>
                 
                 <div className="flex flex-col gap-3">
                   {variants.map((variant, index) => {
                     // Use string comparison to handle both string and number IDs
                     const variantId = String(variant.id || variant._id || `variant-${index}`)
                     const currentSelected = String(selectedVariant || '')
                     const isSelected = currentSelected === variantId
                     
                     return (
                       <button
                         key={variantId}
                         type="button"
                         className={`w-full flex justify-between items-center cursor-pointer p-4 rounded-lg border-2 transition-all select-none text-left relative z-10
                           ${isSelected
                             ? 'border-[#ff3f6c] bg-rose-50 active:bg-rose-100' 
                             : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100'
                           }`}
                         onClick={(e) => {
                           e.preventDefault()
                           e.stopPropagation()
                           console.log('Variant clicked:', { 
                             variantId, 
                             variantName: variant.name, 
                             currentSelected,
                             variant: variant,
                             allVariants: variants.map(v => ({ id: v.id, _id: v._id, name: v.name }))
                           })
                           // Force state update with the exact variant ID
                           const idToSet = String(variant.id || variant._id || `variant-${index}`)
                           setSelectedVariant(idToSet)
                           console.log('Setting selected variant to:', idToSet)
                         }}
                         onMouseDown={(e) => {
                           // Ensure click works on mobile
                           e.stopPropagation()
                         }}
                         onTouchEnd={(e) => {
                           // Handle touch end for mobile
                           e.preventDefault()
                           e.stopPropagation()
                           const idToSet = String(variant.id || variant._id || `variant-${index}`)
                           setSelectedVariant(idToSet)
                         }}
                       >
                         <div className="flex items-center gap-3 flex-1 min-w-0">
                           {/* Radio Button */}
                           <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                             ${isSelected ? 'border-[#ff3f6c]' : 'border-gray-400'}`}>
                             {isSelected && (
                               <div className="w-2.5 h-2.5 bg-[#ff3f6c] rounded-full" />
                             )}
                           </div>
                           <div className="flex flex-col flex-1 min-w-0">
                             <span className="text-gray-800 font-semibold text-base">{variant.name}</span>
                             {variant.stock && variant.stock !== 'Unlimited' && (
                               <span className="text-xs text-gray-500 mt-0.5">
                                 Stock: {variant.stock}
                               </span>
                             )}
                           </div>
                         </div>
                         <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                           <span className="text-gray-800 text-base font-bold">₹{variant.price}</span>
                         </div>
                       </button>
                     )
                   })}
                 </div>
              </div>

              <hr className="border-gray-200" />
            </>
          )}

          {/* Item Description */}
          {item.description && (
            <div className="p-5">
              <h3 className="font-bold text-lg text-gray-800 mb-2">Description</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
              {/* Preparation Time */}
              {item.preparationTime && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium">Preparation Time:</span>
                    <span>{item.preparationTime}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preparation Time (if no description) */}
          {!item.description && item.preparationTime && (
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

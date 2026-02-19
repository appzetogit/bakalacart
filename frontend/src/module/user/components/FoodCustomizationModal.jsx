import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Minus, Plus } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { toast } from 'sonner';

const FoodCustomizationModal = ({ item, restaurant, isOpen, onClose, onAddToCart }) => {
  const { addToCart } = useCart();
  const modalContainerRef = useRef(null);

  // --- STATE MANAGEMENT ---
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);

  // Get variants from item and filter out rejected/invalid ones (where price is null)
  const variants = useMemo(() => {
    return Array.isArray(item?.variations) && item.variations.length > 0
      ? item.variations.filter(v => v && v.price !== null && v.price !== undefined)
      : [];
  }, [item?.variations]);

  // Initialize selected variant when modal opens
  useEffect(() => {
    if (isOpen && variants.length > 0) {
      // Select first variant by default only if no variant is selected
      if (!selectedVariant) {
        const firstVariant = variants[0]
        const firstVariantId = String(firstVariant?.id || firstVariant?._id || `variant-0`)
        setSelectedVariant(firstVariantId);
      }
    } else if (!isOpen) {
      // Reset selection when modal closes
      setSelectedVariant(null);
    }
  }, [isOpen, variants, selectedVariant]);

  // Prevent body scroll when modal is open and ensure consistent positioning
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      // Disable body scroll and prevent any movement
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.height = '100vh';
      // Prevent any touch scrolling
      document.body.style.touchAction = 'none';

      // Reset modal content scroll to top when opening
      const modalContent = document.querySelector('[data-modal-content]');
      if (modalContent) {
        modalContent.scrollTop = 0;
      }

      // Ensure modal container stays perfectly centered using viewport units
      // Since modal is now in a portal, we can use viewport-based positioning
      const maintainPosition = () => {
        if (modalContainerRef.current) {
          // Use viewport units for absolute centering
          const viewportHeight = window.innerHeight;
          const viewportWidth = window.innerWidth;

          modalContainerRef.current.style.position = 'fixed';
          modalContainerRef.current.style.top = '50vh'; // Use viewport height units
          modalContainerRef.current.style.left = '50vw'; // Use viewport width units
          modalContainerRef.current.style.transform = 'translate(-50%, -50%) translateZ(0)';
          modalContainerRef.current.style.margin = '0';
          modalContainerRef.current.style.willChange = 'transform';
          // Ensure it's not affected by any parent transforms
          modalContainerRef.current.style.isolation = 'isolate';
        }
      };

      // Set position immediately and after a small delay to ensure DOM is ready
      maintainPosition();
      setTimeout(maintainPosition, 0);
      requestAnimationFrame(maintainPosition);

      // Maintain position on window resize
      const handleResize = () => {
        maintainPosition();
      };
      window.addEventListener('resize', handleResize);

      // Also maintain position on scroll (in case body scroll is somehow enabled)
      const handleScroll = () => {
        maintainPosition();
      };
      window.addEventListener('scroll', handleScroll, true);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
        // Re-enable body scroll when modal closes
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.height = '';
        document.body.style.touchAction = '';
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // --- PRICE CALCULATION ---
  const selectedVariantData = useMemo(() => {
    return variants.find((v, index) => {
      const vId = String(v.id || v._id || `variant-${index}`)
      const selectedId = String(selectedVariant || '')
      return vId === selectedId
    });
  }, [variants, selectedVariant]);
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

    // Lock modal position to center before and during add to cart
    const lockPosition = () => {
      if (modalContainerRef.current) {
        modalContainerRef.current.style.position = 'fixed';
        modalContainerRef.current.style.top = '50vh'; // Use viewport height
        modalContainerRef.current.style.left = '50vw'; // Use viewport width
        modalContainerRef.current.style.transform = 'translate(-50%, -50%) translateZ(0)';
        modalContainerRef.current.style.margin = '0';
        modalContainerRef.current.style.willChange = 'transform';
        modalContainerRef.current.style.isolation = 'isolate';
      }
    };

    // Lock position immediately
    lockPosition();

    // Use requestAnimationFrame to ensure position is locked before any re-renders
    requestAnimationFrame(() => {
      lockPosition();

      // Lock again after a microtask to catch any async updates
      setTimeout(() => {
        lockPosition();
      }, 0);
    });

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

    // Lock position before adding to cart
    lockPosition();

    // Add to cart via callback or direct context
    if (onAddToCart) {
      onAddToCart(cartItem, quantity);
    } else {
      // Add multiple times if quantity > 1
      for (let i = 0; i < quantity; i++) {
        addToCart(cartItem);
        // Lock position after each add to prevent any shifts
        lockPosition();
      }
      const displayName = selectedVariantData
        ? `${item.name} (${selectedVariantData.name})`
        : item.name
      toast.success(`${quantity} ${displayName} added to cart`);
    }

    // Lock position after cart operations
    requestAnimationFrame(() => {
      lockPosition();

      // Final lock before closing
      setTimeout(() => {
        lockPosition();
        onClose();
      }, 50); // Small delay to ensure position is stable
    });
  };

  if (!isOpen || !item) return null;

  // Don't show modal if item has no variants
  if (variants.length === 0) {
    return null;
  }

  const isVeg = item.foodType === 'Veg' || item.isVeg === true;

  // Render modal using React Portal to ensure it's always at document.body level
  // This prevents parent element positioning from affecting the modal
  const modalContent = (
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
        padding: '1rem',
        // Ensure backdrop stays in place - use viewport units for absolute positioning
        margin: 0,
        // Force new stacking context
        isolation: 'isolate',
        // Hardware acceleration
        transform: 'translateZ(0)',
        willChange: 'auto'
      }}
      onClick={(e) => {
        // Close modal when clicking on backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Mobile Container - Perfectly Centered and Sticky */}
      <div
        ref={modalContainerRef}
        className="bg-white shadow-xl overflow-hidden flex flex-col rounded-xl"
        data-modal-container
        style={{
          position: 'fixed',
          top: '50vh', // Use viewport height for true centering
          left: '50vw', // Use viewport width for true centering
          transform: 'translate(-50%, -50%) translateZ(0)',
          width: 'calc(100% - 2rem)',
          maxWidth: '400px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10000,
          margin: 0,
          flexShrink: 0,
          // Ensure modal stays centered and doesn't move
          willChange: 'transform',
          // Prevent any position changes
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          // Lock position - create new stacking context
          isolation: 'isolate',
          // Hardware acceleration for smooth positioning
          transformOrigin: 'center center',
          // Ensure it's not affected by parent positioning context
          contain: 'layout style paint'
        }}
        onClick={(e) => {
          e.stopPropagation();
          // Ensure position is maintained on any click
          if (modalContainerRef.current) {
            modalContainerRef.current.style.position = 'fixed';
            modalContainerRef.current.style.top = '50vh';
            modalContainerRef.current.style.left = '50vw';
            modalContainerRef.current.style.transform = 'translate(-50%, -50%) translateZ(0)';
            modalContainerRef.current.style.margin = '0';
            modalContainerRef.current.style.willChange = 'transform';
            modalContainerRef.current.style.isolation = 'isolate';
          }
        }}
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
        <div
          className="flex-1 overflow-y-auto pb-24"
          data-modal-content
          style={{
            // Prevent scroll from affecting modal position
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch'
          }}
          onScroll={(e) => {
            // Ensure modal container stays centered even during scroll
            const modalContainer = document.querySelector('[data-modal-container]');
            if (modalContainer) {
              modalContainer.style.top = '50vh';
              modalContainer.style.left = '50vw';
              modalContainer.style.transform = 'translate(-50%, -50%) translateZ(0)';
              modalContainer.style.margin = '0';
              modalContainer.style.willChange = 'transform';
              modalContainer.style.isolation = 'isolate';
            }
          }}
        >

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
                            ? 'border-[#ff3f6c] bg-rose-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          // Force state update with the exact variant ID
                          setSelectedVariant(variantId)
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
              onClick={() => {
                if (quantity > 1) {
                  setQuantity(q => q - 1)
                } else {
                  onClose()
                }
              }}
              className="text-[#ff3f6c] font-bold text-xl px-2 hover:bg-rose-100 rounded transition-colors"
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

  // Use React Portal to render modal at document.body level
  // This ensures modal is always centered regardless of parent element position
  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
};

export default FoodCustomizationModal;

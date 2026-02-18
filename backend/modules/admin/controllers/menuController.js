import Menu from '../../restaurant/models/Menu.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import mongoose from 'mongoose';

// Get menu for a restaurant (admin)
export const getRestaurantMenu = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;

  if (!restaurantId) {
    return errorResponse(res, 400, 'Restaurant ID is required');
  }

  // Find restaurant
  const restaurant = await Restaurant.findOne({
    $or: [
      { _id: restaurantId },
      { restaurantId: restaurantId },
    ],
  });

  if (!restaurant) {
    return errorResponse(res, 404, 'Restaurant not found');
  }

  // Find or create menu
  let menu = await Menu.findOne({ restaurant: restaurant._id });

  if (!menu) {
    // Create empty menu
    menu = new Menu({
      restaurant: restaurant._id,
      sections: [],
      isActive: true,
    });
    await menu.save();
  }

  return successResponse(res, 200, 'Menu retrieved successfully', {
    menu: {
      sections: menu.sections || [],
      isActive: menu.isActive,
    },
  });
});

// Update menu for a restaurant (admin)
export const updateRestaurantMenu = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const { sections } = req.body;

  if (!restaurantId) {
    return errorResponse(res, 400, 'Restaurant ID is required');
  }

  // Find restaurant
  const restaurant = await Restaurant.findOne({
    $or: [
      { _id: restaurantId },
      { restaurantId: restaurantId },
    ],
  });

  if (!restaurant) {
    return errorResponse(res, 404, 'Restaurant not found');
  }

  // Get existing menu to preserve data
  const existingMenu = await Menu.findOne({ restaurant: restaurant._id });

  // Normalize and validate sections
  const normalizedSections = Array.isArray(sections) ? sections.map((section, index) => {
    // Find existing section to preserve data
    const existingSection = existingMenu?.sections?.find(s => s.id === section.id || s.name === section.name);

    return {
      id: section.id || existingSection?.id || `section-${index}`,
      name: section.name || "Unnamed Section",
      items: Array.isArray(section.items) ? section.items.map(item => {
        // Find existing item to preserve approval status and other fields
        const existingItem = existingSection?.items?.find(i => String(i.id) === String(item.id));

        // Check if variations is explicitly provided (even if empty array)
        // If item.variations is explicitly provided (not undefined), use it (even if empty)
        // Otherwise, preserve existing variations
        let variations = [];
        if (item.variations !== undefined) {
          // Variations field is explicitly provided - use it (even if empty array)
          if (Array.isArray(item.variations) && item.variations.length > 0) {
            variations = item.variations.map(v => ({
              id: String(v.id || Date.now() + Math.random()),
              name: v.name || "",
              price: v.price || 0,
              stock: v.stock || "Unlimited",
            }));
          } else {
            // Explicitly empty array - clear variations
            variations = [];
          }
        } else {
          // Variations not provided - preserve existing
          variations = existingItem?.variations || [];
        }

        return {
          id: String(item.id || Date.now() + Math.random()),
          name: item.name || "Unnamed Item",
          nameArabic: item.nameArabic || existingItem?.nameArabic || "",
          image: item.image || existingItem?.image || "",
          category: item.category || section.name,
          rating: item.rating ?? existingItem?.rating ?? 0.0,
          reviews: item.reviews ?? existingItem?.reviews ?? 0,
          price: item.price || 0,
          stock: item.stock || existingItem?.stock || "Unlimited",
          discount: item.discount !== undefined ? item.discount : (existingItem?.discount || null),
          originalPrice: item.originalPrice !== undefined ? item.originalPrice : (existingItem?.originalPrice || null),
          foodType: item.foodType || existingItem?.foodType || "Non-Veg",
          availabilityTimeStart: item.availabilityTimeStart || existingItem?.availabilityTimeStart || "12:01 AM",
          availabilityTimeEnd: item.availabilityTimeEnd || existingItem?.availabilityTimeEnd || "11:57 PM",
          description: item.description || existingItem?.description || "",
          discountType: item.discountType || existingItem?.discountType || "Percent",
          discountAmount: item.discountAmount ?? existingItem?.discountAmount ?? 0.0,
          isAvailable: item.isAvailable !== undefined ? item.isAvailable : (existingItem?.isAvailable !== undefined ? existingItem.isAvailable : true),
          isRecommended: item.isRecommended !== undefined ? item.isRecommended : (existingItem?.isRecommended || false),
          variations: variations,
          tags: Array.isArray(item.tags) && item.tags.length > 0 ? item.tags : (existingItem?.tags || []),
          nutrition: Array.isArray(item.nutrition) && item.nutrition.length > 0 ? item.nutrition : (existingItem?.nutrition || []),
          allergies: Array.isArray(item.allergies) && item.allergies.length > 0 ? item.allergies : (existingItem?.allergies || []),
          photoCount: item.photoCount ?? existingItem?.photoCount ?? 1,
          subCategory: item.subCategory || existingItem?.subCategory || "",
          servesInfo: item.servesInfo || existingItem?.servesInfo || "",
          itemSize: item.itemSize || existingItem?.itemSize || "",
          itemSizeQuantity: item.itemSizeQuantity || existingItem?.itemSizeQuantity || "",
          itemSizeUnit: item.itemSizeUnit || existingItem?.itemSizeUnit || "piece",
          gst: item.gst ?? existingItem?.gst ?? 0,
          preparationTime: item.preparationTime || existingItem?.preparationTime || "",
          images: (() => {
            if (Array.isArray(item.images) && item.images.length > 0) {
              return item.images.filter(img => img && typeof img === 'string' && img.trim() !== '');
            }
            if (item.image && item.image.trim() !== '') {
              return [item.image];
            }
            if (existingItem?.images && Array.isArray(existingItem.images) && existingItem.images.length > 0) {
              return existingItem.images;
            }
            if (existingItem?.image && existingItem.image.trim() !== '') {
              return [existingItem.image];
            }
            return [];
          })(),
          // Preserve approval status from existing item, or set to approved for new items
          approvalStatus: existingItem?.approvalStatus || item.approvalStatus || 'approved',
          requestedAt: existingItem?.requestedAt || item.requestedAt || new Date(),
          approvedAt: existingItem?.approvedAt || (item.approvedAt || (item.approvalStatus === 'approved' || !existingItem ? new Date() : undefined)),
          approvedBy: existingItem?.approvedBy || req.admin?._id || item.approvedBy,
          rejectedAt: existingItem?.rejectedAt || item.rejectedAt,
          rejectionReason: existingItem?.rejectionReason || item.rejectionReason || "",
        };
      }) : (existingSection?.items || []),
      subsections: Array.isArray(section.subsections) ? section.subsections.map(subsection => {
        // Find existing subsection
        const existingSubsection = existingSection?.subsections?.find(sub => sub.id === subsection.id || sub.name === subsection.name);

        return {
          id: subsection.id || existingSubsection?.id || `subsection-${Date.now()}`,
          name: subsection.name || "Unnamed Subsection",
          items: Array.isArray(subsection.items) ? subsection.items.map(item => {
            // Find existing item
            const existingItem = existingSubsection?.items?.find(i => String(i.id) === String(item.id));

            // Check if variations is explicitly provided (even if empty array)
            // If item.variations is explicitly provided (not undefined), use it (even if empty)
            // Otherwise, preserve existing variations
            let variations = [];
            if (item.variations !== undefined) {
              // Variations field is explicitly provided - use it (even if empty array)
              if (Array.isArray(item.variations) && item.variations.length > 0) {
                variations = item.variations.map(v => ({
                  id: String(v.id || Date.now() + Math.random()),
                  name: v.name || "",
                  price: v.price || 0,
                  stock: v.stock || "Unlimited",
                }));
              } else {
                // Explicitly empty array - clear variations
                variations = [];
              }
            } else {
              // Variations not provided - preserve existing
              variations = existingItem?.variations || [];
            }

            return {
              id: String(item.id || Date.now() + Math.random()),
              name: item.name || "Unnamed Item",
              nameArabic: item.nameArabic || existingItem?.nameArabic || "",
              image: item.image || existingItem?.image || "",
              category: item.category || section.name,
              rating: item.rating ?? existingItem?.rating ?? 0.0,
              reviews: item.reviews ?? existingItem?.reviews ?? 0,
              price: item.price || 0,
              stock: item.stock || existingItem?.stock || "Unlimited",
              discount: item.discount !== undefined ? item.discount : (existingItem?.discount || null),
              originalPrice: item.originalPrice !== undefined ? item.originalPrice : (existingItem?.originalPrice || null),
              foodType: item.foodType || existingItem?.foodType || "Non-Veg",
              availabilityTimeStart: item.availabilityTimeStart || existingItem?.availabilityTimeStart || "12:01 AM",
              availabilityTimeEnd: item.availabilityTimeEnd || existingItem?.availabilityTimeEnd || "11:57 PM",
              description: item.description || existingItem?.description || "",
              discountType: item.discountType || existingItem?.discountType || "Percent",
              discountAmount: item.discountAmount ?? existingItem?.discountAmount ?? 0.0,
              isAvailable: item.isAvailable !== undefined ? item.isAvailable : (existingItem?.isAvailable !== undefined ? existingItem.isAvailable : true),
              isRecommended: item.isRecommended !== undefined ? item.isRecommended : (existingItem?.isRecommended || false),
              variations: variations,
              tags: Array.isArray(item.tags) && item.tags.length > 0 ? item.tags : (existingItem?.tags || []),
              nutrition: Array.isArray(item.nutrition) && item.nutrition.length > 0 ? item.nutrition : (existingItem?.nutrition || []),
              allergies: Array.isArray(item.allergies) && item.allergies.length > 0 ? item.allergies : (existingItem?.allergies || []),
              photoCount: item.photoCount ?? existingItem?.photoCount ?? 1,
              subCategory: item.subCategory || existingItem?.subCategory || "",
              servesInfo: item.servesInfo || existingItem?.servesInfo || "",
              itemSize: item.itemSize || existingItem?.itemSize || "",
              itemSizeQuantity: item.itemSizeQuantity || existingItem?.itemSizeQuantity || "",
              itemSizeUnit: item.itemSizeUnit || existingItem?.itemSizeUnit || "piece",
              gst: item.gst ?? existingItem?.gst ?? 0,
              preparationTime: item.preparationTime || existingItem?.preparationTime || "",
              images: (() => {
                if (Array.isArray(item.images) && item.images.length > 0) {
                  return item.images.filter(img => img && typeof img === 'string' && img.trim() !== '');
                }
                if (item.image && item.image.trim() !== '') {
                  return [item.image];
                }
                if (existingItem?.images && Array.isArray(existingItem.images) && existingItem.images.length > 0) {
                  return existingItem.images;
                }
                if (existingItem?.image && existingItem.image.trim() !== '') {
                  return [existingItem.image];
                }
                return [];
              })(),
              approvalStatus: existingItem?.approvalStatus || item.approvalStatus || 'approved',
              requestedAt: existingItem?.requestedAt || item.requestedAt || new Date(),
              approvedAt: existingItem?.approvedAt || (item.approvedAt || (item.approvalStatus === 'approved' || !existingItem ? new Date() : undefined)),
              approvedBy: existingItem?.approvedBy || req.admin?._id || item.approvedBy,
              rejectedAt: existingItem?.rejectedAt || item.rejectedAt,
              rejectionReason: existingItem?.rejectionReason || item.rejectionReason || "",
            };
          }) : (existingSubsection?.items || []),
        };
      }) : (existingSection?.subsections || []),
      isEnabled: section.isEnabled !== undefined ? section.isEnabled : (existingSection?.isEnabled !== undefined ? existingSection.isEnabled : true),
      order: section.order !== undefined ? section.order : (existingSection?.order !== undefined ? existingSection.order : index),
    };
  }) : (existingMenu?.sections || []);

  // Find or create menu
  let menu = await Menu.findOne({ restaurant: restaurant._id });

  if (!menu) {
    menu = new Menu({
      restaurant: restaurant._id,
      sections: normalizedSections,
      isActive: true,
    });
  } else {
    menu.set('sections', normalizedSections);
    menu.markModified('sections');
    menu.isNew = false;
  }

  await menu.save();

  return successResponse(res, 200, 'Menu updated successfully', {
    menu: {
      sections: menu.sections,
      isActive: menu.isActive,
    },
  });
});

// Toggle menu section (category) status (admin)
export const toggleRestaurantMenuSection = asyncHandler(async (req, res) => {
  const { restaurantId, sectionId } = req.params;

  if (!restaurantId || !sectionId) {
    return errorResponse(res, 400, 'Restaurant ID and Section ID are required');
  }

  // Use a simple retry mechanism for VersionError
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const menu = await Menu.findOne({ restaurant: restaurantId });
      if (!menu) return errorResponse(res, 404, 'Menu not found');

      const section = menu.sections.find(s => String(s.id) === String(sectionId));
      if (!section) return errorResponse(res, 404, 'Section not found');

      section.isEnabled = !section.isEnabled;
      menu.markModified('sections');
      await menu.save();

      return successResponse(res, 200, `Section ${section.isEnabled ? 'enabled' : 'disabled'} successfully`, {
        isEnabled: section.isEnabled,
        sectionId: section.id
      });
    } catch (error) {
      if (error.name === 'VersionError' && attempts < maxAttempts - 1) {
        attempts++;
        continue;
      }
      throw error;
    }
  }
});

// Toggle menu item status (admin)
export const toggleRestaurantMenuItem = asyncHandler(async (req, res) => {
  const { restaurantId, itemId } = req.params;

  if (!restaurantId || !itemId) {
    return errorResponse(res, 400, 'Restaurant ID and Item ID are required');
  }

  // Use a simple retry mechanism for VersionError
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const menu = await Menu.findOne({ restaurant: restaurantId });
      if (!menu) return errorResponse(res, 404, 'Menu not found');

      let itemFound = false;
      let newStatus = false;

      menu.sections.forEach(section => {
        // Check items in section
        const item = section.items?.find(i => String(i.id) === String(itemId));
        if (item) {
          item.isAvailable = !item.isAvailable;
          newStatus = item.isAvailable;
          itemFound = true;
        }

        // Check items in subsections
        if (!itemFound && section.subsections) {
          section.subsections.forEach(subsection => {
            const subItem = subsection.items?.find(i => String(i.id) === String(itemId));
            if (subItem) {
              subItem.isAvailable = !subItem.isAvailable;
              newStatus = subItem.isAvailable;
              itemFound = true;
            }
          });
        }
      });

      if (!itemFound) return errorResponse(res, 404, 'Item not found');

      menu.markModified('sections');
      await menu.save();

      return successResponse(res, 200, `Item ${newStatus ? 'enabled' : 'disabled'} successfully`, {
        isAvailable: newStatus,
        itemId
      });
    } catch (error) {
      if (error.name === 'VersionError' && attempts < maxAttempts - 1) {
        attempts++;
        continue;
      }
      throw error;
    }
  }
});



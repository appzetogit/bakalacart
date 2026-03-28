import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import Menu from '../../restaurant/models/Menu.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Get all pending food approval requests
 * GET /api/admin/food-approvals
 */
export const getPendingFoodApprovals = asyncHandler(async (req, res) => {
  try {
    // Use aggregation to find pending items efficiently across ALL menus (active or not)
    const pipeline = [
      {
        // Project only the fields we need to reduce memory
        $project: {
          restaurant: 1,
          isActive: 1,
          sections: 1,
          addons: 1,
          createdAt: 1
        }
      },
      {
        // Unwind sections first
        $unwind: { path: '$sections', preserveNullAndEmptyArrays: true }
      },
      {
        // Handle subsections by branching (or just unwind)
        $facet: {
          itemsFromSections: [
            { $unwind: '$sections.items' },
            { $match: { 'sections.items.approvalStatus': 'pending' } },
            {
              $project: {
                _id: '$sections.items.id',
                id: '$sections.items.id',
                itemName: '$sections.items.name',
                category: '$sections.items.category',
                sectionName: '$sections.name',
                sectionId: '$sections.id',
                price: '$sections.items.price',
                foodType: '$sections.items.foodType',
                description: '$sections.items.description',
                image: { $ifNull: [ '$sections.items.image', { $arrayElemAt: ['$sections.items.images', 0] } ] },
                requestedAt: { $ifNull: [ '$sections.items.requestedAt', '$createdAt' ] },
                restaurantId: '$restaurant',
                item: '$sections.items'
              }
            }
          ],
          itemsFromSubsections: [
            { $unwind: '$sections.subsections' },
            { $unwind: '$sections.subsections.items' },
            { $match: { 'sections.subsections.items.approvalStatus': 'pending' } },
            {
              $project: {
                _id: '$sections.subsections.items.id',
                id: '$sections.subsections.items.id',
                itemName: '$sections.subsections.items.name',
                category: '$sections.subsections.items.category',
                sectionName: '$sections.name',
                sectionId: '$sections.id',
                subsectionName: '$sections.subsections.name',
                subsectionId: '$sections.subsections.id',
                price: '$sections.subsections.items.price',
                foodType: '$sections.subsections.items.foodType',
                description: '$sections.subsections.items.description',
                image: { $ifNull: [ '$sections.subsections.items.image', { $arrayElemAt: ['$sections.subsections.items.images', 0] } ] },
                requestedAt: { $ifNull: [ '$sections.subsections.items.requestedAt', '$createdAt' ] },
                restaurantId: '$restaurant',
                item: '$sections.subsections.items'
              }
            }
          ],
          addons: [
            { $unwind: '$addons' },
            { $match: { 'addons.approvalStatus': 'pending' } },
            {
              $project: {
                _id: '$addons.id',
                id: '$addons.id',
                itemName: '$addons.name',
                category: { $literal: 'Add-on' },
                type: { $literal: 'addon' },
                price: '$addons.price',
                description: '$addons.description',
                image: { $ifNull: [ '$addons.image', { $arrayElemAt: ['$addons.images', 0] } ] },
                requestedAt: { $ifNull: [ '$addons.requestedAt', '$createdAt' ] },
                restaurantId: '$restaurant',
                item: '$addons'
              }
            }
          ]
        }
      },
      {
        // Combine results
        $project: {
          all: { $concatArrays: ['$itemsFromSections', '$itemsFromSubsections', '$addons'] }
        }
      },
      { $unwind: '$all' },
      { $replaceRoot: { newRoot: '$all' } }
    ];

    const results = await Menu.aggregate(pipeline);

    // Populate restaurant information for each request
    const pendingRequests = await Restaurant.populate(results, {
      path: 'restaurantId',
      select: 'name restaurantId'
    });

    // Map the results back to the expected format (handling populated restaurant)
    const formattedRequests = pendingRequests
      .filter(req => req.restaurantId) // Skip if restaurant not found
      .map(req => ({
        ...req,
        restaurantName: req.restaurantId.name,
        restaurantMongoId: req.restaurantId._id,
        restaurantId: req.restaurantId.restaurantId,
        images: Array.isArray(req.item.images) ? req.item.images.filter(img => img) : []
      }));

    // Sort by requested date (newest first)
    formattedRequests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    const finalRequests = formattedRequests;

    logger.info(`Fetched ${finalRequests.length} pending food approval requests`);

    return successResponse(res, 200, 'Pending food approvals retrieved successfully', {
      requests: finalRequests,
      total: finalRequests.length
    });
  } catch (error) {
    logger.error(`Error fetching pending food approvals: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, 'Failed to fetch pending food approvals');
  }
});

/**
 * Approve a food item
 * POST /api/admin/food-approvals/:id/approve
 */
export const approveFoodItem = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    // Search for the menu containing the item/addon directly in DB
    // This is MUCH faster than fetching all menus and looping
    const menuDoc = await Menu.findOne({
      $or: [
        { "addons.id": id },
        { "sections.items.id": id },
        { "sections.subsections.items.id": id }
      ]
    });

    if (!menuDoc) {
      return errorResponse(res, 404, 'Food item or add-on not found in any menu');
    }

    let foundItem = null;
    let foundSection = null;
    let foundSubsection = null;
    let isAddon = false;

    // Find the specific item in the document to identify its location (section/subsection)
    // Check add-ons first
    const addon = (menuDoc.addons || []).find(a => String(a.id) === String(id));
    if (addon) {
      foundItem = addon;
      isAddon = true;
    } else {
      // Check sections
      for (const section of menuDoc.sections || []) {
        // Check items in section
        const item = section.items.find(i => String(i.id) === String(id));
        if (item) {
          foundItem = item;
          foundSection = section;
          break;
        }

        // Check items in subsections
        for (const subsection of section.subsections || []) {
          const subItem = subsection.items.find(i => String(i.id) === String(id));
          if (subItem) {
            foundItem = subItem;
            foundSection = section;
            foundSubsection = subsection;
            break;
          }
        }
        if (foundItem) break;
      }
    }

    if (!foundItem) {
      return errorResponse(res, 404, 'Food item or add-on not found (ID mismatch)');
    }

    if (foundItem.approvalStatus === 'approved') {
      return errorResponse(res, 400, 'Food item is already approved');
    }

    const menu = menuDoc; // Use the document we already found
    console.log(`[APPROVE] Menu document found: ${menu._id}, sections count: ${menu.sections?.length || 0}, addons count: ${menu.addons?.length || 0}`);

    console.log(`[APPROVE] Menu document found, sections count: ${menu.sections?.length || 0}, addons count: ${menu.addons?.length || 0}`);

    // Handle add-on approval
    if (isAddon) {
      const addonIndex = menu.addons.findIndex(a => String(a.id) === String(id));
      if (addonIndex !== -1) {
        const addon = menu.addons[addonIndex];
        console.log(`[APPROVE] Found addon at index ${addonIndex}`);
        console.log(`[APPROVE] Addon before update:`, {
          id: addon.id,
          name: addon.name,
          approvalStatus: addon.approvalStatus
        });
        
        addon.approvalStatus = 'approved';
        addon.approvedAt = new Date();
        addon.approvedBy = adminId;
        addon.rejectionReason = '';
        
        console.log(`[APPROVE] Addon after update:`, {
          id: addon.id,
          name: addon.name,
          approvalStatus: addon.approvalStatus,
          approvedAt: addon.approvedAt
        });
        
        menu.markModified(`addons.${addonIndex}`);
        menu.markModified('addons');
        
        await menu.save();
        
        console.log(`[APPROVE] ✅ Addon approved and saved successfully`);
        
        return successResponse(res, 200, 'Add-on approved successfully', {
          addon: {
            id: addon.id,
            name: addon.name,
            approvalStatus: addon.approvalStatus,
            approvedAt: addon.approvedAt
          }
        });
      }
      return errorResponse(res, 404, 'Add-on not found in menu');
    }

    // Find and update the item directly in the document
    let itemUpdated = false;
    
    for (let sectionIndex = 0; sectionIndex < menu.sections.length; sectionIndex++) {
      const section = menu.sections[sectionIndex];
      
      // Check if this is the correct section
      if (String(section.id) !== String(foundSection.id)) {
        continue;
      }
      
      console.log(`[APPROVE] Checking section ${sectionIndex}: ${section.name} (id: ${section.id})`);
      
      if (foundSubsection) {
        // Item is in a subsection
        const subsectionIndex = section.subsections.findIndex(s => String(s.id) === String(foundSubsection.id));
        if (subsectionIndex !== -1) {
          const subsection = section.subsections[subsectionIndex];
          const itemIndex = subsection.items.findIndex(i => String(i.id) === String(id));
          if (itemIndex !== -1) {
            const item = subsection.items[itemIndex];
            console.log(`[APPROVE] Found item in subsection ${subsectionIndex}, item index ${itemIndex}`);
            console.log(`[APPROVE] Item before update:`, {
              id: item.id,
              name: item.name,
              approvalStatus: item.approvalStatus
            });
            
            // Update the item directly
            item.approvalStatus = 'approved';
            item.approvedAt = new Date();
            item.approvedBy = adminId;
            item.rejectionReason = '';
            
            itemUpdated = true;
            
            console.log(`[APPROVE] Item after update:`, {
              id: item.id,
              name: item.name,
              approvalStatus: item.approvalStatus,
              approvedAt: item.approvedAt
            });
            
            // Mark all nested paths as modified - CRITICAL for Mongoose
            menu.markModified(`sections.${sectionIndex}.subsections.${subsectionIndex}.items.${itemIndex}`);
            menu.markModified(`sections.${sectionIndex}.subsections.${subsectionIndex}.items`);
            menu.markModified(`sections.${sectionIndex}.subsections.${subsectionIndex}`);
            menu.markModified(`sections.${sectionIndex}.subsections`);
            menu.markModified(`sections.${sectionIndex}`);
            menu.markModified('sections');
            
            console.log(`[APPROVE] Marked all nested paths as modified`);
            break;
          }
        }
      } else {
        // Item is directly in section
        const itemIndex = section.items.findIndex(i => String(i.id) === String(id));
        if (itemIndex !== -1) {
          const item = section.items[itemIndex];
          console.log(`[APPROVE] Found item in section, item index ${itemIndex}`);
          console.log(`[APPROVE] Item before update:`, {
            id: item.id,
            name: item.name,
            approvalStatus: item.approvalStatus
          });
          
          // Update the item directly
          item.approvalStatus = 'approved';
          item.approvedAt = new Date();
          item.approvedBy = adminId;
          item.rejectionReason = '';
          
          itemUpdated = true;
          
          console.log(`[APPROVE] Item after update:`, {
            id: item.id,
            name: item.name,
            approvalStatus: item.approvalStatus,
            approvedAt: item.approvedAt
          });
          
          // Mark all nested paths as modified - CRITICAL for Mongoose
          menu.markModified(`sections.${sectionIndex}.items.${itemIndex}`);
          menu.markModified(`sections.${sectionIndex}.items`);
          menu.markModified(`sections.${sectionIndex}`);
          menu.markModified('sections');
          
          console.log(`[APPROVE] Marked all nested paths as modified`);
          break;
        }
      }
    }

    if (!itemUpdated) {
      console.error(`[APPROVE] ❌ Failed to find item ${id} in menu for update`);
      console.error(`[APPROVE] Menu sections:`, menu.sections.map(s => ({ id: s.id, name: s.name, itemsCount: s.items?.length || 0 })));
      return errorResponse(res, 404, 'Food item not found in menu');
    }

    // Save the menu - this is the CRITICAL step
    console.log(`[APPROVE] Saving menu to database...`);
    await menu.save();
    console.log(`[APPROVE] ✅ Menu saved successfully`);
    
    // Force a fresh query to verify the save
    console.log(`[APPROVE] Verifying save by querying database...`);
    const savedMenu = await Menu.findById(menu._id).lean();
    const savedItem = savedMenu.sections
      .flatMap(s => [
        ...(s.items || []),
        ...(s.subsections || []).flatMap(sub => sub.items || [])
      ])
      .find(i => String(i.id) === String(id));
    
    if (savedItem) {
      console.log(`[APPROVE] ✅ Verification: Item ${id} (${savedItem.name}) status in DB: ${savedItem.approvalStatus}`);
      console.log(`[APPROVE] ✅ Approved at: ${savedItem.approvedAt}`);
      console.log(`[APPROVE] ✅ Approved by: ${savedItem.approvedBy}`);
      
      if (savedItem.approvalStatus !== 'approved') {
        console.error(`[APPROVE] ❌ ERROR: Item status is ${savedItem.approvalStatus}, expected 'approved'`);
        return errorResponse(res, 500, 'Failed to update approval status in database');
      }
    } else {
      console.error(`[APPROVE] ❌ ERROR: Item ${id} not found in saved menu`);
      return errorResponse(res, 404, 'Food item not found after update');
    }
    
    console.log(`[APPROVE] ==========================================`);

    logger.info(`Food item approved: ${id}`, {
      approvedBy: adminId,
      itemName: foundItem.name,
      restaurantId: menu.restaurant
    });

    return successResponse(res, 200, 'Food item approved successfully', {
      itemId: id,
      itemName: savedItem.name,
      approvalStatus: savedItem.approvalStatus,
      approvedAt: savedItem.approvedAt,
      approvedBy: savedItem.approvedBy,
      restaurantId: menu.restaurant,
      message: 'Food item has been approved and is now visible to users (if toggle is ON)'
    });
  } catch (error) {
    logger.error(`Error approving food item: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, 'Failed to approve food item');
  }
});

/**
 * Reject a food item
 * POST /api/admin/food-approvals/:id/reject
 */
export const rejectFoodItem = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    if (!reason || !reason.trim()) {
      return errorResponse(res, 400, 'Rejection reason is required');
    }

    // Search for the menu containing the item/addon directly in DB
    const menuDoc = await Menu.findOne({
      $or: [
        { "addons.id": id },
        { "sections.items.id": id },
        { "sections.subsections.items.id": id }
      ]
    });

    if (!menuDoc) {
      return errorResponse(res, 404, 'Food item or add-on not found in any menu');
    }

    let foundItem = null;
    let foundSection = null;
    let foundSubsection = null;
    let isAddon = false;

    // Find location in document
    const addon = (menuDoc.addons || []).find(a => String(a.id) === String(id));
    if (addon) {
      foundItem = addon;
      isAddon = true;
    } else {
      for (const section of menuDoc.sections || []) {
        const item = section.items.find(i => String(i.id) === String(id));
        if (item) {
          foundItem = item;
          foundSection = section;
          break;
        }
        for (const subsection of section.subsections || []) {
          const subItem = subsection.items.find(i => String(i.id) === String(id));
          if (subItem) {
            foundItem = subItem;
            foundSection = section;
            foundSubsection = subsection;
            break;
          }
        }
        if (foundItem) break;
      }
    }

    if (!foundItem) {
      return errorResponse(res, 404, 'Food item or add-on not found (ID mismatch)');
    }

    if (foundItem.approvalStatus === 'rejected') {
      return errorResponse(res, 400, 'Food item is already rejected');
    }

    const menu = menuDoc;
    console.log(`[REJECT] Menu document found: ${menu._id}, sections count: ${menu.sections?.length || 0}, addons count: ${menu.addons?.length || 0}`);
    if (!menu) {
      console.error(`[REJECT] ❌ Menu not found: ${foundMenu._id}`);
      return errorResponse(res, 404, 'Menu not found');
    }

    console.log(`[REJECT] Menu document found, sections count: ${menu.sections?.length || 0}, addons count: ${menu.addons?.length || 0}`);
    console.log(`[REJECT] Is addon: ${isAddon}`);

    // Handle add-on rejection
    if (isAddon) {
      const addonIndex = menu.addons.findIndex(a => String(a.id) === String(id));
      if (addonIndex !== -1) {
        const addon = menu.addons[addonIndex];
        console.log(`[REJECT] Found addon at index ${addonIndex}`);
        console.log(`[REJECT] Addon before update:`, {
          id: addon.id,
          name: addon.name,
          approvalStatus: addon.approvalStatus
        });
        
        addon.approvalStatus = 'rejected';
        addon.rejectionReason = reason.trim();
        addon.rejectedAt = new Date();
        addon.approvedBy = adminId;
        addon.approvedAt = null;
        
        console.log(`[REJECT] Addon after update:`, {
          id: addon.id,
          name: addon.name,
          approvalStatus: addon.approvalStatus,
          rejectedAt: addon.rejectedAt
        });
        
        menu.markModified(`addons.${addonIndex}`);
        menu.markModified('addons');
        
        await menu.save();
        
        console.log(`[REJECT] ✅ Addon rejected and saved successfully`);
        
        return successResponse(res, 200, 'Add-on rejected successfully', {
          addon: {
            id: addon.id,
            name: addon.name,
            approvalStatus: addon.approvalStatus,
            rejectedAt: addon.rejectedAt,
            rejectionReason: addon.rejectionReason
          }
        });
      }
      return errorResponse(res, 404, 'Add-on not found in menu');
    }

    // Find and update the item directly in the document
    let itemUpdated = false;
    
    for (let sectionIndex = 0; sectionIndex < menu.sections.length; sectionIndex++) {
      const section = menu.sections[sectionIndex];
      
      // Check if this is the correct section
      if (String(section.id) !== String(foundSection.id)) {
        continue;
      }
      
      console.log(`[REJECT] Checking section ${sectionIndex}: ${section.name} (id: ${section.id})`);
      
      if (foundSubsection) {
        // Item is in a subsection
        const subsectionIndex = section.subsections.findIndex(s => String(s.id) === String(foundSubsection.id));
        if (subsectionIndex !== -1) {
          const subsection = section.subsections[subsectionIndex];
          const itemIndex = subsection.items.findIndex(i => String(i.id) === String(id));
          if (itemIndex !== -1) {
            const item = subsection.items[itemIndex];
            console.log(`[REJECT] Found item in subsection ${subsectionIndex}, item index ${itemIndex}`);
            console.log(`[REJECT] Item before update:`, {
              id: item.id,
              name: item.name,
              approvalStatus: item.approvalStatus
            });
            
            // Update the item directly
            item.approvalStatus = 'rejected';
            item.rejectionReason = reason.trim();
            item.rejectedAt = new Date();
            item.approvedBy = adminId;
            item.approvedAt = null;
            
            itemUpdated = true;
            
            console.log(`[REJECT] Item after update:`, {
              id: item.id,
              name: item.name,
              approvalStatus: item.approvalStatus,
              rejectedAt: item.rejectedAt
            });
            
            // Mark all nested paths as modified - CRITICAL for Mongoose
            menu.markModified(`sections.${sectionIndex}.subsections.${subsectionIndex}.items.${itemIndex}`);
            menu.markModified(`sections.${sectionIndex}.subsections.${subsectionIndex}.items`);
            menu.markModified(`sections.${sectionIndex}.subsections.${subsectionIndex}`);
            menu.markModified(`sections.${sectionIndex}.subsections`);
            menu.markModified(`sections.${sectionIndex}`);
            menu.markModified('sections');
            
            console.log(`[REJECT] Marked all nested paths as modified`);
            break;
          }
        }
      } else {
        // Item is directly in section
        const itemIndex = section.items.findIndex(i => String(i.id) === String(id));
        if (itemIndex !== -1) {
          const item = section.items[itemIndex];
          console.log(`[REJECT] Found item in section, item index ${itemIndex}`);
          console.log(`[REJECT] Item before update:`, {
            id: item.id,
            name: item.name,
            approvalStatus: item.approvalStatus
          });
          
          // Update the item directly
          item.approvalStatus = 'rejected';
          item.rejectionReason = reason.trim();
          item.rejectedAt = new Date();
          item.approvedBy = adminId;
          item.approvedAt = null;
          
          itemUpdated = true;
          
          console.log(`[REJECT] Item after update:`, {
            id: item.id,
            name: item.name,
            approvalStatus: item.approvalStatus,
            rejectedAt: item.rejectedAt
          });
          
          // Mark all nested paths as modified - CRITICAL for Mongoose
          menu.markModified(`sections.${sectionIndex}.items.${itemIndex}`);
          menu.markModified(`sections.${sectionIndex}.items`);
          menu.markModified(`sections.${sectionIndex}`);
          menu.markModified('sections');
          
          console.log(`[REJECT] Marked all nested paths as modified`);
          break;
        }
      }
    }

    if (!itemUpdated) {
      console.error(`[REJECT] ❌ Failed to find item ${id} in menu for update`);
      console.error(`[REJECT] Menu sections:`, menu.sections.map(s => ({ id: s.id, name: s.name, itemsCount: s.items?.length || 0 })));
      return errorResponse(res, 404, 'Food item not found in menu');
    }

    // Save the menu - this is the CRITICAL step
    console.log(`[REJECT] Saving menu to database...`);
    await menu.save();
    console.log(`[REJECT] ✅ Menu saved successfully`);
    
    // Force a fresh query to verify the save
    console.log(`[REJECT] Verifying save by querying database...`);
    const savedMenu = await Menu.findById(menu._id).lean();
    const savedItem = savedMenu.sections
      .flatMap(s => [
        ...(s.items || []),
        ...(s.subsections || []).flatMap(sub => sub.items || [])
      ])
      .find(i => String(i.id) === String(id));
    
    if (savedItem) {
      console.log(`[REJECT] ✅ Verification: Item ${id} (${savedItem.name}) status in DB: ${savedItem.approvalStatus}`);
      console.log(`[REJECT] ✅ Rejected at: ${savedItem.rejectedAt}`);
      console.log(`[REJECT] ✅ Rejection reason: ${savedItem.rejectionReason}`);
      
      if (savedItem.approvalStatus !== 'rejected') {
        console.error(`[REJECT] ❌ ERROR: Item status is ${savedItem.approvalStatus}, expected 'rejected'`);
        return errorResponse(res, 500, 'Failed to update rejection status in database');
      }
    } else {
      console.error(`[REJECT] ❌ ERROR: Item ${id} not found in saved menu`);
      return errorResponse(res, 404, 'Food item not found after update');
    }
    
    console.log(`[REJECT] ==========================================`);

    logger.info(`Food item rejected: ${id}`, {
      rejectedBy: adminId,
      itemName: foundItem.name,
      reason: reason.trim(),
      restaurantId: menu.restaurant
    });

    return successResponse(res, 200, 'Food item rejected successfully', {
      itemId: id,
      itemName: savedItem.name,
      approvalStatus: savedItem.approvalStatus,
      rejectionReason: savedItem.rejectionReason,
      rejectedAt: savedItem.rejectedAt,
      restaurantId: menu.restaurant,
      message: 'Food item has been rejected and will not be visible to users'
    });
  } catch (error) {
    logger.error(`Error rejecting food item: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, 'Failed to reject food item');
  }
});


import BusinessSettings from '../models/BusinessSettings.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { uploadToCloudinary } from '../../../shared/utils/cloudinaryService.js';
import { initializeCloudinary } from '../../../config/cloudinary.js';

/**
 * Get Business Settings (Public - for favicon, logo, company name)
 * GET /api/business-settings/public
 */
export const getBusinessSettingsPublic = asyncHandler(async (req, res) => {
  try {
    const settings = await BusinessSettings.getSettings();
    
    // Check if maintenance mode is currently active
    const now = new Date();
    let userMaintenanceActive = false;
    let restaurantDeliveryMaintenanceActive = false;

    if (settings?.maintenanceMode?.user?.isEnabled) {
      const userMode = settings.maintenanceMode.user;
      let isInWindow = true;
      
      if (userMode.startDate && now < new Date(userMode.startDate)) {
        isInWindow = false;
      }
      if (userMode.endDate && now > new Date(userMode.endDate)) {
        isInWindow = false;
      }
      
      userMaintenanceActive = isInWindow;
    }

    if (settings?.maintenanceMode?.restaurantDelivery?.isEnabled) {
      const restaurantMode = settings.maintenanceMode.restaurantDelivery;
      let isInWindow = true;
      
      if (restaurantMode.startDate && now < new Date(restaurantMode.startDate)) {
        isInWindow = false;
      }
      if (restaurantMode.endDate && now > new Date(restaurantMode.endDate)) {
        isInWindow = false;
      }
      
      restaurantDeliveryMaintenanceActive = isInWindow;
    }
    
    // Return only public-facing data with defaults if not set
    return successResponse(res, 200, 'Business settings retrieved successfully', {
      companyName: settings?.companyName || 'Bakala Cart',
      logo: settings?.logo || { url: '', publicId: '' },
      favicon: settings?.favicon || { url: '', publicId: '' },
      maintenanceMode: {
        user: {
          isEnabled: userMaintenanceActive
        },
        restaurantDelivery: {
          isEnabled: restaurantDeliveryMaintenanceActive
        }
      }
    });
  } catch (error) {
    console.error('Error fetching public business settings:', error);
    // Return default values instead of error
    return successResponse(res, 200, 'Business settings retrieved successfully', {
      companyName: 'Bakala Cart',
      logo: { url: '', publicId: '' },
      favicon: { url: '', publicId: '' },
      maintenanceMode: {
        user: { isEnabled: false },
        restaurantDelivery: { isEnabled: false }
      }
    });
  }
});

/**
 * Get Business Settings (Admin - full data)
 * GET /api/admin/business-settings
 */
export const getBusinessSettings = asyncHandler(async (req, res) => {
  try {
    // Use findOne().lean() to get fresh data from database without Mongoose document overhead
    const settings = await BusinessSettings.findOne().lean();
    
    if (!settings) {
      // If no settings exist, create default using getSettings
      const newSettings = await BusinessSettings.getSettings();
      const createdSettings = await BusinessSettings.findById(newSettings._id).lean();
      console.log('📤 Returning NEW settings - maintenanceMode:', JSON.stringify(createdSettings?.maintenanceMode, null, 2));
      return successResponse(res, 200, 'Business settings retrieved successfully', createdSettings);
    }
    
    // Log maintenance mode for debugging
    console.log('📤 Returning EXISTING settings - maintenanceMode:', JSON.stringify(settings?.maintenanceMode, null, 2));
    console.log('   User isEnabled:', settings?.maintenanceMode?.user?.isEnabled, '(type:', typeof settings?.maintenanceMode?.user?.isEnabled, ')');
    console.log('   Restaurant isEnabled:', settings?.maintenanceMode?.restaurantDelivery?.isEnabled, '(type:', typeof settings?.maintenanceMode?.restaurantDelivery?.isEnabled, ')');
    
    return successResponse(res, 200, 'Business settings retrieved successfully', settings);
  } catch (error) {
    console.error('Error fetching business settings:', error);
    return errorResponse(res, 500, 'Failed to fetch business settings');
  }
});

/**
 * Update Business Settings
 * PUT /api/admin/business-settings
 */
export const updateBusinessSettings = asyncHandler(async (req, res) => {
  try {
    // Log entire req.body for debugging
    console.log('📦 Full req.body keys:', Object.keys(req.body));
    console.log('📦 req.body.maintenanceMode type:', typeof req.body.maintenanceMode);
    console.log('📦 req.body.maintenanceMode value:', req.body.maintenanceMode);
    
    const {
      companyName,
      email,
      phoneCountryCode,
      phoneNumber,
      address,
      state,
      pincode,
      maintenanceMode: maintenanceModeRaw
    } = req.body;

    // Parse maintenanceMode if it's a JSON string
    console.log('🔍 Raw maintenanceMode received:', typeof maintenanceModeRaw, maintenanceModeRaw);
    let maintenanceMode = maintenanceModeRaw;
    if (typeof maintenanceModeRaw === 'string') {
      try {
        maintenanceMode = JSON.parse(maintenanceModeRaw);
        console.log('✅ Parsed maintenanceMode from JSON string:', JSON.stringify(maintenanceMode, null, 2));
      } catch (parseError) {
        console.error('❌ Error parsing maintenanceMode JSON:', parseError);
        console.error('Raw maintenanceMode string:', maintenanceModeRaw);
        maintenanceMode = null;
      }
    } else if (maintenanceModeRaw) {
      console.log('✅ maintenanceMode received as object:', JSON.stringify(maintenanceMode, null, 2));
    } else {
      console.warn('⚠️ maintenanceMode is undefined or null');
    }

    // Get existing settings or create new one
    let settings = await BusinessSettings.findOne();
    const isNew = !settings;
    if (!settings) {
      settings = new BusinessSettings();
    }

    // Build update object for findOneAndUpdate (more reliable than save for nested objects)
    const updateData = {};
    
    // Update basic fields
    if (companyName !== undefined) {
      updateData.companyName = companyName;
      settings.companyName = companyName;
    }
    if (email !== undefined) {
      updateData.email = email;
      settings.email = email;
    }
    
    // Handle phone
    if (phoneCountryCode !== undefined || phoneNumber !== undefined) {
      if (!settings.phone) {
        settings.phone = {
          countryCode: '+91',
          number: ''
        };
      }
      if (phoneCountryCode !== undefined) {
        updateData['phone.countryCode'] = phoneCountryCode;
        settings.phone.countryCode = phoneCountryCode;
      }
      if (phoneNumber !== undefined) {
        updateData['phone.number'] = phoneNumber;
        settings.phone.number = phoneNumber;
      }
    }
    
    if (address !== undefined) {
      updateData.address = address;
      settings.address = address;
    }
    if (state !== undefined) {
      updateData.state = state;
      settings.state = state;
    }
    if (pincode !== undefined) {
      updateData.pincode = pincode;
      settings.pincode = pincode;
    }
    
    // Handle maintenance mode updates - CRITICAL: Always update if provided
    if (maintenanceMode !== undefined && maintenanceMode !== null) {
      console.log('🔄 Processing maintenanceMode update:', JSON.stringify(maintenanceMode, null, 2));
      
      // Build the complete maintenanceMode object to ensure all fields are set
      const updatedMaintenanceMode = {
        user: {
          isEnabled: maintenanceMode.user?.isEnabled !== undefined 
            ? Boolean(maintenanceMode.user.isEnabled) 
            : (settings.maintenanceMode?.user?.isEnabled ?? false),
          startDate: maintenanceMode.user?.startDate !== undefined
            ? (maintenanceMode.user.startDate ? new Date(maintenanceMode.user.startDate) : null)
            : (settings.maintenanceMode?.user?.startDate || null),
          endDate: maintenanceMode.user?.endDate !== undefined
            ? (maintenanceMode.user.endDate ? new Date(maintenanceMode.user.endDate) : null)
            : (settings.maintenanceMode?.user?.endDate || null)
        },
        restaurantDelivery: {
          isEnabled: maintenanceMode.restaurantDelivery?.isEnabled !== undefined
            ? Boolean(maintenanceMode.restaurantDelivery.isEnabled)
            : (settings.maintenanceMode?.restaurantDelivery?.isEnabled ?? false),
          startDate: maintenanceMode.restaurantDelivery?.startDate !== undefined
            ? (maintenanceMode.restaurantDelivery.startDate ? new Date(maintenanceMode.restaurantDelivery.startDate) : null)
            : (settings.maintenanceMode?.restaurantDelivery?.startDate || null),
          endDate: maintenanceMode.restaurantDelivery?.endDate !== undefined
            ? (maintenanceMode.restaurantDelivery.endDate ? new Date(maintenanceMode.restaurantDelivery.endDate) : null)
            : (settings.maintenanceMode?.restaurantDelivery?.endDate || null)
        }
      };
      
      console.log('📝 Computed maintenanceMode to save:', JSON.stringify(updatedMaintenanceMode, null, 2));
      console.log('   User isEnabled:', updatedMaintenanceMode.user.isEnabled, '(type:', typeof updatedMaintenanceMode.user.isEnabled, ')');
      console.log('   Restaurant isEnabled:', updatedMaintenanceMode.restaurantDelivery.isEnabled, '(type:', typeof updatedMaintenanceMode.restaurantDelivery.isEnabled, ')');
      
      // Use set() to replace the entire maintenanceMode object
      settings.set('maintenanceMode', updatedMaintenanceMode);
    }

    // Handle logo upload
    if (req.files && req.files.logo && req.files.logo.length > 0) {
      try {
        await initializeCloudinary();
        const logoFile = req.files.logo[0];
        
        // Validate file type
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedMimeTypes.includes(logoFile.mimetype)) {
          return errorResponse(res, 400, 'Invalid logo file type. Allowed: JPEG, PNG, WEBP');
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (logoFile.size > maxSize) {
          return errorResponse(res, 400, 'Logo file size exceeds 5MB limit');
        }

        // Delete old logo from Cloudinary if exists
        if (settings.logo.publicId) {
          try {
            const { cloudinary } = await import('../../../config/cloudinary.js');
            await cloudinary.uploader.destroy(settings.logo.publicId);
          } catch (deleteError) {
            console.warn('Failed to delete old logo:', deleteError);
          }
        }

        // Upload new logo
        const logoResult = await uploadToCloudinary(logoFile.buffer, {
          folder: 'appzeto/business/logo',
          resource_type: 'image',
          transformation: [
            { width: 500, height: 500, crop: 'limit' },
            { quality: 'auto' }
          ]
        });

        settings.logo = {
          url: logoResult.secure_url,
          publicId: logoResult.public_id
        };
      } catch (logoError) {
        console.error('Error uploading logo:', logoError);
        return errorResponse(res, 500, 'Failed to upload logo');
      }
    }

    // Handle favicon upload
    if (req.files && req.files.favicon && req.files.favicon.length > 0) {
      try {
        await initializeCloudinary();
        const faviconFile = req.files.favicon[0];
        
        // Validate file type
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'];
        if (!allowedMimeTypes.includes(faviconFile.mimetype)) {
          return errorResponse(res, 400, 'Invalid favicon file type. Allowed: JPEG, PNG, WEBP, ICO');
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (faviconFile.size > maxSize) {
          return errorResponse(res, 400, 'Favicon file size exceeds 5MB limit');
        }

        // Delete old favicon from Cloudinary if exists
        if (settings.favicon.publicId) {
          try {
            const { cloudinary } = await import('../../../config/cloudinary.js');
            await cloudinary.uploader.destroy(settings.favicon.publicId);
          } catch (deleteError) {
            console.warn('Failed to delete old favicon:', deleteError);
          }
        }

        // Upload new favicon
        const faviconResult = await uploadToCloudinary(faviconFile.buffer, {
          folder: 'appzeto/business/favicon',
          resource_type: 'image',
          transformation: [
            { width: 64, height: 64, crop: 'limit' },
            { quality: 'auto' }
          ]
        });

        settings.favicon = {
          url: faviconResult.secure_url,
          publicId: faviconResult.public_id
        };
      } catch (faviconError) {
        console.error('Error uploading favicon:', faviconError);
        return errorResponse(res, 500, 'Failed to upload favicon');
      }
    }

    // Add logo and favicon to updateData if they were updated
    if (settings.logo?.url) {
      updateData.logo = settings.logo;
    }
    if (settings.favicon?.url) {
      updateData.favicon = settings.favicon;
    }

    // Add maintenanceMode to updateData if it was provided
    if (maintenanceMode !== undefined && maintenanceMode !== null) {
      updateData['maintenanceMode.user.isEnabled'] = settings.maintenanceMode.user.isEnabled;
      updateData['maintenanceMode.user.startDate'] = settings.maintenanceMode.user.startDate;
      updateData['maintenanceMode.user.endDate'] = settings.maintenanceMode.user.endDate;
      updateData['maintenanceMode.restaurantDelivery.isEnabled'] = settings.maintenanceMode.restaurantDelivery.isEnabled;
      updateData['maintenanceMode.restaurantDelivery.startDate'] = settings.maintenanceMode.restaurantDelivery.startDate;
      updateData['maintenanceMode.restaurantDelivery.endDate'] = settings.maintenanceMode.restaurantDelivery.endDate;
    }

    // Set updated by
    if (req.admin && req.admin._id) {
      updateData.updatedBy = req.admin._id;
    }

    // CRITICAL: Save ALL fields using findOneAndUpdate with $set
    // This ensures atomic persistence for all updates (basic fields, logo, favicon, maintenanceMode)
    if (Object.keys(updateData).length > 0) {
      console.log('🔄 Using findOneAndUpdate with $set for all fields:', JSON.stringify(updateData, null, 2));
      // Use findOneAndUpdate to atomically update all fields at once
      const updatedDoc = await BusinessSettings.findOneAndUpdate(
        { _id: settings._id },
        { $set: updateData },
        { new: true, runValidators: true, upsert: false }
      );
      
      if (!updatedDoc) {
        console.error('❌ findOneAndUpdate returned null!');
        throw new Error('Failed to update business settings');
      }
      
      console.log('✅ All settings updated successfully via findOneAndUpdate');
      
      // Update the settings object to reflect the updated values
      settings = updatedDoc;
      
    }
    
    // Reload from database using lean() to get actual saved values (no Mongoose defaults)
    const savedSettings = await BusinessSettings.findById(settings._id).lean();
    
    // Also do a direct MongoDB query to verify what's actually in the database
    const directQuery = await BusinessSettings.collection.findOne({ _id: settings._id });
    
    // Log saved maintenance mode for debugging
    console.log('📥 Reloaded from DB (via Mongoose) - maintenanceMode:', JSON.stringify(savedSettings?.maintenanceMode, null, 2));
    console.log('📥 Direct MongoDB query - maintenanceMode:', JSON.stringify(directQuery?.maintenanceMode, null, 2));
    console.log('   User isEnabled (Mongoose):', savedSettings?.maintenanceMode?.user?.isEnabled, '(type:', typeof savedSettings?.maintenanceMode?.user?.isEnabled, ')');
    console.log('   User isEnabled (Direct):', directQuery?.maintenanceMode?.user?.isEnabled, '(type:', typeof directQuery?.maintenanceMode?.user?.isEnabled, ')');
    console.log('   Restaurant isEnabled (Mongoose):', savedSettings?.maintenanceMode?.restaurantDelivery?.isEnabled, '(type:', typeof savedSettings?.maintenanceMode?.restaurantDelivery?.isEnabled, ')');
    console.log('   Restaurant isEnabled (Direct):', directQuery?.maintenanceMode?.restaurantDelivery?.isEnabled, '(type:', typeof directQuery?.maintenanceMode?.restaurantDelivery?.isEnabled, ')');
    
    // Verify the saved values match what we tried to save
    if (maintenanceMode !== undefined && maintenanceMode !== null) {
      const userExpected = Boolean(maintenanceMode.user?.isEnabled ?? false);
      const userActual = savedSettings?.maintenanceMode?.user?.isEnabled ?? false;
      const restaurantExpected = Boolean(maintenanceMode.restaurantDelivery?.isEnabled ?? false);
      const restaurantActual = savedSettings?.maintenanceMode?.restaurantDelivery?.isEnabled ?? false;
      
      if (userExpected !== userActual) {
        console.error('❌ MISMATCH: User maintenance mode not saved correctly!');
        console.error('   Expected:', userExpected, 'Actual:', userActual);
      } else {
        console.log('✅ User maintenance mode saved correctly');
      }
      
      if (restaurantExpected !== restaurantActual) {
        console.error('❌ MISMATCH: Restaurant maintenance mode not saved correctly!');
        console.error('   Expected:', restaurantExpected, 'Actual:', restaurantActual);
      } else {
        console.log('✅ Restaurant maintenance mode saved correctly');
      }
    }

    return successResponse(res, 200, 'Business settings updated successfully', savedSettings);
  } catch (error) {
    console.error('Error updating business settings:', error);
    return errorResponse(res, 500, 'Failed to update business settings');
  }
});


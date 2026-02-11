import BusinessSettings from '../../modules/admin/models/BusinessSettings.js';
import { errorResponse } from '../utils/response.js';

/**
 * Check Maintenance Mode Middleware
 * Checks if maintenance mode is enabled for user or restaurant delivery
 * @param {string} modeType - 'user' or 'restaurantDelivery'
 */
export const checkMaintenanceMode = (modeType = 'user') => {
  return async (req, res, next) => {
    try {
      const settings = await BusinessSettings.getSettings();
      
      if (!settings || !settings.maintenanceMode) {
        return next();
      }

      const maintenanceMode = settings.maintenanceMode[modeType];
      
      if (!maintenanceMode || !maintenanceMode.isEnabled) {
        return next();
      }

      // Check if maintenance mode has date restrictions
      const now = new Date();
      let isInMaintenanceWindow = true;

      // If startDate is set, check if we're past the start date
      if (maintenanceMode.startDate) {
        const startDate = new Date(maintenanceMode.startDate);
        if (now < startDate) {
          isInMaintenanceWindow = false;
        }
      }

      // If endDate is set, check if we're past the end date
      if (maintenanceMode.endDate) {
        const endDate = new Date(maintenanceMode.endDate);
        if (now > endDate) {
          isInMaintenanceWindow = false;
        }
      }

      // If maintenance mode is enabled and we're in the maintenance window, block access
      if (isInMaintenanceWindow) {
        const modeName = modeType === 'user' ? 'User app' : 'Restaurant delivery';
        return errorResponse(
          res,
          503,
          `${modeName} is currently under maintenance. Please try again later.`
        );
      }

      // Maintenance mode is enabled but we're outside the maintenance window
      return next();
    } catch (error) {
      console.error('Error checking maintenance mode:', error);
      // On error, allow access (fail open)
      return next();
    }
  };
};

export default { checkMaintenanceMode };

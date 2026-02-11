import { useState, useEffect } from "react";
import apiClient from "@/lib/api/axios";
import { API_ENDPOINTS } from "@/lib/api/config";

/**
 * Hook to check maintenance mode status
 * @param {string} modeType - 'user' or 'restaurantDelivery'
 * @returns {object} { isMaintenanceMode, loading }
 */
export function useMaintenanceMode(modeType = "user") {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkMaintenanceMode = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(API_ENDPOINTS.ADMIN.BUSINESS_SETTINGS_PUBLIC);
        const settings = response?.data?.data || response?.data;
        
        if (settings?.maintenanceMode) {
          const maintenanceStatus = 
            modeType === "user" 
              ? settings.maintenanceMode.user?.isEnabled 
              : settings.maintenanceMode.restaurantDelivery?.isEnabled;
          
          setIsMaintenanceMode(maintenanceStatus || false);
        } else {
          setIsMaintenanceMode(false);
        }
      } catch (error) {
        console.error("Error checking maintenance mode:", error);
        // On error, assume not in maintenance mode (fail open)
        setIsMaintenanceMode(false);
      } finally {
        setLoading(false);
      }
    };

    checkMaintenanceMode();
    
    // Check maintenance mode every 30 seconds
    const interval = setInterval(checkMaintenanceMode, 30000);
    
    return () => clearInterval(interval);
  }, [modeType]);

  return { isMaintenanceMode, loading };
}

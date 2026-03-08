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
  // CRITICAL: Start with loading false to prevent initial loading blink
  // We'll check maintenance mode in background without blocking render
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkMaintenanceMode = async () => {
      try {
        // Don't set loading to true on initial check to prevent blink
        // Only set loading for subsequent checks if needed
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
        // Silently handle errors - don't log to prevent console spam
        // On error, assume not in maintenance mode (fail open)
        setIsMaintenanceMode(false);
      }
      // Don't set loading to false - it's already false
    };

    // CRITICAL: Defer maintenance mode check to prevent blocking initial render
    // This prevents the purple loading blink
    const checkTimeout = setTimeout(() => {
      checkMaintenanceMode();
    }, 100); // Small delay to allow app to render first
    
    // Check maintenance mode every 30 seconds (after initial check)
    const interval = setInterval(checkMaintenanceMode, 30000);
    
    return () => {
      clearTimeout(checkTimeout);
      clearInterval(interval);
    };
  }, [modeType]);

  return { isMaintenanceMode, loading };
}

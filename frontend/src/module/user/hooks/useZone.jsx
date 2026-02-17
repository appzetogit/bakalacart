import { useContext } from "react"
import { LocationContext } from "../context/LocationContext"

/**
 * Hook to access global zone state
 * Automatically uses the shared zone state from LocationContext
 */
export function useZone(location) {
  const context = useContext(LocationContext)

  if (!context) {
    // For safety, though it should be wrapped in LocationProvider
    return {
      zoneId: null,
      zone: null,
      zoneStatus: 'loading',
      loading: false,
      error: null,
      isInService: false,
      isOutOfService: false,
      refreshZone: () => { }
    }
  }

  return {
    zoneId: context.zoneId,
    zone: context.zone,
    zoneStatus: context.zoneStatus,
    loading: context.zoneLoading,
    error: context.zoneError,
    isInService: context.isInService,
    isOutOfService: context.isOutOfService,
    refreshZone: context.refreshZone
  }
}

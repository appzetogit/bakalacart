import { useContext } from "react"
import { LocationContext } from "../context/LocationContext"

/**
 * Hook to access global location state
 * Re-exports the context-based useLocation for backward compatibility
 */
export function useLocation() {
  const context = useContext(LocationContext)
  if (!context) {
    // Return a dummy state or throw error? 
    // Since we'll wrap UserLayout, it will be available for all user components.
    // For safety during transition, we'll throw.
    throw new Error('useLocation must be used within a LocationProvider')
  }
  return context
}

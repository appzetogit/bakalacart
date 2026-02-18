import { Navigate, useLocation } from "react-router-dom";
import { isModuleAuthenticated } from "@/lib/utils/auth";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import MaintenanceModeScreen from "./MaintenanceModeScreen";

/**
 * Role-based Protected Route Component
 * Only allows access if user is authenticated for the specific module
 */
export default function ProtectedRoute({ children, requiredRole, loginPath }) {
  const location = useLocation();

  // Check maintenance mode for user and restaurant roles
  const userMaintenance = useMaintenanceMode("user");
  const restaurantMaintenance = useMaintenanceMode("restaurantDelivery");

  // Determine which maintenance mode to check based on role
  let maintenanceCheck = null;
  if (requiredRole === "user") {
    maintenanceCheck = userMaintenance;
  } else if (requiredRole === "restaurant") {
    maintenanceCheck = restaurantMaintenance;
  }

  // Show maintenance screen if maintenance mode is enabled
  if (maintenanceCheck && !maintenanceCheck.loading && maintenanceCheck.isMaintenanceMode) {
    return <MaintenanceModeScreen />;
  }

  // Check if user is authenticated for the required module using module-specific token
  if (!requiredRole) {
    // If no role required, allow access
    return children;
  }

  const isAuthenticated = isModuleAuthenticated(requiredRole);

  // If not authenticated for this module, redirect to login
  if (!isAuthenticated) {
    const currentPath = location.pathname + location.search;
    if (loginPath) {
      return <Navigate to={`${loginPath}?returnTo=${encodeURIComponent(currentPath)}`} state={{ from: currentPath }} replace />;
    }

    // Fallback: redirect to appropriate login page
    const roleLoginPaths = {
      'admin': '/admin/login',
      'restaurant': '/restaurant/login',
      'delivery': '/delivery/sign-in',
      'user': '/user/auth/sign-in'
    };

    const redirectPath = roleLoginPaths[requiredRole] || '/';
    return <Navigate to={`${redirectPath}?returnTo=${encodeURIComponent(currentPath)}`} state={{ from: currentPath }} replace />;
  }

  return children;
}


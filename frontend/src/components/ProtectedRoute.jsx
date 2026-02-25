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

  // Maintenance mode is now handled via top banners in layouts/components
  // instead of blocking the entire application, allowing users to still view the app.
  /*
  if (maintenanceCheck && !maintenanceCheck.loading && maintenanceCheck.isMaintenanceMode) {
    return <MaintenanceModeScreen />;
  }
  */

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
      'user': '/auth/sign-in'
    };

    const redirectPath = roleLoginPaths[requiredRole] || '/';
    return <Navigate to={`${redirectPath}?returnTo=${encodeURIComponent(currentPath)}`} state={{ from: currentPath }} replace />;
  }

  if (maintenanceCheck && !maintenanceCheck.loading && maintenanceCheck.isMaintenanceMode) {
    return (
      <div className="relative min-h-screen">
        <div className="absolute inset-0 z-[9998] bg-gray-500/10 backdrop-blur-[1px] cursor-not-allowed" />
        {children}
      </div>
    );
  }

  return children;
}


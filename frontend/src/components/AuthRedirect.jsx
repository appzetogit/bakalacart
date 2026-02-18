import { Navigate, useLocation } from "react-router-dom"
import { isModuleAuthenticated } from "@/lib/utils/auth"

/**
 * AuthRedirect Component
 * Redirects authenticated users away from auth pages to their module's home page
 * Only shows auth pages to unauthenticated users
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Auth page component to render if not authenticated
 * @param {string} props.module - Module name (user, restaurant, delivery, admin)
 * @param {string} props.redirectTo - Path to redirect to if authenticated (optional, defaults to module home)
 */
export default function AuthRedirect({ children, module, redirectTo = null }) {
  const location = useLocation()
  // Check if user is authenticated for this module (Strict check)
  const isAuthenticated = isModuleAuthenticated(module, true)

  // If authenticated, redirect to module home page or the page they came from
  if (isAuthenticated) {
    const params = new URLSearchParams(location.search);
    const returnTo = params.get('returnTo');
    const fromState = location.state?.from?.pathname || location.state?.from;
    const from = fromState || returnTo;

    // Ensure we don't redirect to the current login page itself or OTP pages (infinite loop)
    const currentPath = location.pathname;

    // Sanitize destination to avoid infinite redirect loops
    // If no specific 'from' or 'returnTo' exists, we default to the module's home page
    const moduleHomePaths = {
      'admin': '/admin',
      'restaurant': '/restaurant',
      'delivery': '/delivery',
      'user': '/'
    };

    let finalPath = (from && from !== currentPath) ? from : (redirectTo || moduleHomePaths[module] || "/");

    // Final check to prevent redirecting to another auth page
    if (finalPath.includes('/login') || finalPath.includes('/sign-in') || finalPath.includes('/otp')) {
      finalPath = moduleHomePaths[module] || "/";
    }

    return <Navigate to={finalPath} replace />
  }

  // If not authenticated, show the auth page
  return <>{children}</>
}


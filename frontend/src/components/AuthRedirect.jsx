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

  // Define default home pages for each module
  const moduleHomePages = {
    user: "/",
    restaurant: "/restaurant",
    delivery: "/delivery",
    admin: "/admin",
  }

  // If authenticated, redirect to module home page or the page they came from
  // We prioritize:
  // 1. location.state.from (React Router state)
  // 2. returnTo query parameter (URL fallback)
  // 3. redirectTo prop (explicit override)
  // 4. module home page (default)
  // If authenticated, redirect to module home page or the page they came from
  if (isAuthenticated) {
    const params = new URLSearchParams(location.search);
    const returnTo = params.get('returnTo');
    const fromState = location.state?.from?.pathname || location.state?.from;
    const from = fromState || returnTo;

    // Ensure we don't redirect to the current login page itself or OTP pages (infinite loop)
    const currentPath = location.pathname;
    const isAuthPage = currentPath.includes('/login') || currentPath.includes('/sign-in') || currentPath.includes('/otp');

    // Sanitize destination to avoid infinite redirect loops
    let finalPath = (from && from !== currentPath) ? from : (redirectTo || moduleHomePages[module] || "/");

    // Final check to prevent redirecting to another auth page
    if (finalPath.includes('/login') || finalPath.includes('/sign-in') || finalPath.includes('/otp')) {
      finalPath = moduleHomePages[module] || "/";
    }

    return <Navigate to={finalPath} replace />
  }

  // If not authenticated, show the auth page
  return <>{children}</>
}


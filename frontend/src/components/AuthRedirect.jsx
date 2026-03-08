import { Navigate, useLocation } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
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
  // CRITICAL: Check authentication immediately but defer redirect
  // This prevents any visual blink while still checking auth
  const [shouldRedirect, setShouldRedirect] = useState(false)
  const redirectPathRef = useRef(null)
  const checkedRef = useRef(false)

  useEffect(() => {
    // Only check once to prevent multiple checks
    if (checkedRef.current) return
    checkedRef.current = true

    // Use requestAnimationFrame to defer check after initial render
    // This ensures page renders first, then checks auth
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const authStatus = isModuleAuthenticated(module, true)
        
        if (authStatus) {
          // Calculate redirect path
          const params = new URLSearchParams(location.search);
          const returnTo = params.get('returnTo');
          const fromState = location.state?.from?.pathname || location.state?.from;
          const from = fromState || returnTo;
          const currentPath = location.pathname;

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

          redirectPathRef.current = finalPath
          
          // Delay redirect slightly to ensure smooth transition
          setTimeout(() => {
            setShouldRedirect(true)
          }, 100)
        }
      })
    })
  }, [module, location])

  // If authenticated, redirect to module home page or the page they came from
  if (shouldRedirect && redirectPathRef.current) {
    return <Navigate to={redirectPathRef.current} replace />
  }

  // CRITICAL: Always show children initially to prevent any blink
  // Redirect will happen after auth check completes
  return <>{children}</>
}


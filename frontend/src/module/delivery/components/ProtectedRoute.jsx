import { Navigate, useLocation } from "react-router-dom"
import { isModuleAuthenticated } from "@/lib/utils/auth"

export default function ProtectedRoute({ children }) {
  const location = useLocation()
  
  // Check if user is authenticated using proper token validation
  const isAuthenticated = isModuleAuthenticated("delivery")

  if (!isAuthenticated) {
    // Pass the current location so user can be redirected back after login
    return <Navigate to="/delivery/sign-in" state={{ from: location.pathname }} replace />
  }

  return children
}


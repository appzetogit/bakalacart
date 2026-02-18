import { Navigate, useLocation } from "react-router-dom"

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  // Simple check - in real app, check authentication token
  const isAuthenticated = localStorage.getItem("admin_authenticated") === "true"

  if (!isAuthenticated) {
    const currentPath = location.pathname + location.search;
    return <Navigate to={`/admin/login?returnTo=${encodeURIComponent(currentPath)}`} state={{ from: currentPath }} replace />
  }

  return children
}


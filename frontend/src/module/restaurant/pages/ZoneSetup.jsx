import RestaurantNavbar from "../components/RestaurantNavbar"
import { ArrowLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"

export default function ZoneSetup() {
  const navigate = useNavigate()

  // Zone setup is disabled; this page now only shows an info message
  return (
    <div className="min-h-screen bg-gray-50">
      <RestaurantNavbar />
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Zone Setup Disabled</h1>
            <p className="text-sm text-gray-600">
              Delivery zone configuration is no longer required. Your restaurant can accept orders from any location supported by the platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { 
  ArrowLeft
} from "lucide-react"
// Mock data removed - using API data only

export default function PrivacyPolicy() {
  const navigate = useNavigate()
  const [sections, setSections] = useState([])
  const [lastUpdated, setLastUpdated] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Fetch privacy policy data from API
    // Example:
    // fetchPrivacyPolicy().then(data => {
    //   setSections(data.sections)
    //   setLastUpdated(data.lastUpdated)
    //   setLoading(false)
    // })
    setLoading(false)
  }, [])

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 md:py-3 flex items-center gap-4 rounded-b-3xl md:rounded-b-none">
        <button 
          onClick={() => navigate("/delivery/profile")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg md:text-xl font-bold text-gray-900">Privacy Policy</h1>
      </div>

      {/* Main Content */}
      <div className="w-full px-4 py-6 pb-24 md:pb-6">
        <div className="w-full max-w-none">
          {lastUpdated && (
            <p className="text-gray-600 text-sm md:text-base mb-6">
              Last updated: {lastUpdated}
            </p>
          )}
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-600">Loading privacy policy...</p>
            </div>
          ) : sections.length > 0 ? (
            <div className="space-y-6">
              {sections.map((section, index) => (
                <motion.div
                  key={section.id || index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <h3 className="text-gray-900 font-bold text-base md:text-lg mb-2">
                    {section.title}
                  </h3>
                  <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                    {section.content}
                  </p>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-600">No privacy policy content available.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}


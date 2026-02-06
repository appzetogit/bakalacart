import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import Lenis from "lenis"
import { ArrowLeft } from "lucide-react"
import BottomNavbar from "../components/BottomNavbar"
import MenuOverlay from "../components/MenuOverlay"
// Mock data removed - using API data only

export default function PrivacyPolicyPage() {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [sections, setSections] = useState([])
  const [lastUpdated, setLastUpdated] = useState("")
  const [title, setTitle] = useState("Privacy Policy")
  const [contactInfo, setContactInfo] = useState({})
  const [loading, setLoading] = useState(true)

  // Fetch privacy policy data from API
  useEffect(() => {
    const fetchPrivacyPolicy = async () => {
      try {
        setLoading(true)
        // TODO: Fetch privacy policy data from API
        // Example:
        // const response = await restaurantAPI.getPrivacyPolicy()
        // setSections(response.data.sections)
        // setLastUpdated(response.data.lastUpdated)
        // setTitle(response.data.title || "Privacy Policy")
        // setContactInfo(response.data.contactInfo || {})
      } catch (error) {
        console.error("Error fetching privacy policy:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchPrivacyPolicy()
  }, [])

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden pb-24 md:pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3">
        <button 
          onClick={() => navigate(-1)}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Privacy Policy</h1>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-600">Loading privacy policy...</p>
            </div>
          </div>
        ) : sections.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6"
          >
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
              {lastUpdated && (
                <p className="text-sm text-gray-600">
                  Last updated: {lastUpdated}
                </p>
              )}
            </div>

            <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
              {sections.map((section, index) => (
                <section key={section.id || index}>
                  {section.title && (
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      {section.title}
                    </h3>
                  )}
                  {section.content && (
                    <div className="space-y-2">
                      {typeof section.content === 'string' ? (
                        <p>{section.content}</p>
                      ) : (
                        section.content.map((paragraph, pIndex) => (
                          <p key={pIndex} className={pIndex > 0 ? "mt-2" : ""}>
                            {paragraph}
                          </p>
                        ))
                      )}
                    </div>
                  )}
                  {section.listItems && section.listItems.length > 0 && (
                    <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                      {section.listItems.map((item, itemIndex) => (
                        <li key={itemIndex}>{item}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}

              {/* Contact Information Section */}
              {Object.keys(contactInfo).length > 0 && (
                <section>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact Us</h3>
                  <p className="mb-2">
                    If you have any questions about this Privacy Policy, please contact us at:
                  </p>
                  <div className="mt-2 space-y-1">
                    {contactInfo.email && (
                      <p>
                        <strong>Email:</strong> {contactInfo.email}
                      </p>
                    )}
                    {contactInfo.phone && (
                      <p>
                        <strong>Phone:</strong> {contactInfo.phone}
                      </p>
                    )}
                    {contactInfo.address && (
                      <p>
                        <strong>Address:</strong> {contactInfo.address}
                      </p>
                    )}
                  </div>
                </section>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-600">No privacy policy content available.</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <BottomNavbar onMenuClick={() => setShowMenu(true)} />
      
      {/* Menu Overlay */}
      <MenuOverlay showMenu={showMenu} setShowMenu={setShowMenu} />
    </div>
  )
}


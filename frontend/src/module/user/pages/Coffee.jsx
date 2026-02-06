import { useCallback, useState, useEffect } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Star, ArrowLeft, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import AnimatedPage from "../components/AnimatedPage"
import { useLocationSelector } from "../components/UserLayout"
import { useLocation as useLocationHook } from "../hooks/useLocation"
import { FaLocationDot } from "react-icons/fa6"
// Mock data removed - using API data only

export default function Coffee() {
  const navigate = useNavigate()
  const { categoryId } = useParams()
  const { openLocationSelector } = useLocationSelector()
  const { location } = useLocationHook()
  const cityName = location?.city || "Select"
  
  const [loading, setLoading] = useState(true)
  const [bannerImage, setBannerImage] = useState("")
  const [categoryTitle, setCategoryTitle] = useState("")
  const [categoryDescription, setCategoryDescription] = useState("")
  const [storeSections, setStoreSections] = useState([])
  const [imageErrors, setImageErrors] = useState(new Set())

  // Fetch coffee category data from API
  useEffect(() => {
    const fetchCategoryData = async () => {
      try {
        setLoading(true)
        // TODO: Fetch category data from API
        // Example:
        // const response = await userAPI.getCategory(categoryId || "coffee")
        // setBannerImage(response.data.bannerImage || "")
        // setCategoryTitle(response.data.title || "")
        // setCategoryDescription(response.data.description || "")
        // setStoreSections(response.data.storeSections || [])
      } catch (error) {
        console.error("Error fetching category data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchCategoryData()
  }, [categoryId])

  const handleLocationClick = useCallback(() => {
    openLocationSelector()
  }, [openLocationSelector])

  const renderStoreList = (stores, sectionTitle) => {
    if (!stores || stores.length === 0) return null
    
    return (
      <div className="mb-8">
        {/* Section Header */}
        {sectionTitle && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide text-center">
              {sectionTitle}
            </h3>
          </div>
        )}

        {/* Store List */}
        <div className="space-y-0">
          {stores.map((store, index) => {
            const storeSlug = store.slug || store.name?.toLowerCase().replace(/\s+/g, "-") || `store-${store.id}`
            const isHighRating = store.rating >= 4.0
            
            return (
              <Link 
                key={store.id} 
                to={`/user/restaurants/${storeSlug}`}
                className="block"
              >
                <div className={`flex items-start gap-4 py-4 ${index !== stores.length - 1 ? 'border-b border-gray-200' : ''}`}>
                  {/* Logo - Circular */}
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                      {store.logo && !imageErrors.has(store.id) ? (
                        <img
                          src={store.logo}
                          alt={store.name || "Store"}
                          className="w-full h-full object-cover"
                          onError={() => {
                            setImageErrors(prev => new Set([...prev, store.id]))
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-400 text-xs font-semibold">
                            {store.name?.charAt(0) || "?"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Store Info */}
                  <div className="flex-1 min-w-0">
                    {/* Location Name */}
                    {store.location && (
                      <h4 className="text-base font-bold text-gray-900 mb-2">
                        {store.location}
                      </h4>
                    )}

                    {/* Rating Badge */}
                    {store.rating && (
                      <div className="mb-2">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded ${
                          isHighRating 
                            ? 'bg-green-600 text-white' 
                            : 'bg-yellow-400 text-gray-900'
                        }`}>
                          <span className="text-sm font-semibold">{store.rating}</span>
                          <Star className={`h-3 w-3 ${isHighRating ? 'fill-white text-white' : 'fill-gray-900 text-gray-900'}`} />
                        </div>
                      </div>
                    )}

                    {/* Distance */}
                    {store.distance && (
                      <p className="text-sm text-gray-500 mb-1">
                        {store.distance}
                      </p>
                    )}

                    {/* Price and Offer */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {store.price && (
                        <p className="text-sm text-gray-700">
                          {store.price}
                        </p>
                      )}
                      {store.offer && (
                        <span className="text-sm font-medium text-blue-600">
                          {store.offer}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <AnimatedPage className="bg-white" style={{ minHeight: '100vh', paddingBottom: '80px', overflow: 'visible' }}>
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-600">Loading...</p>
        </div>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage className="bg-white" style={{ minHeight: '100vh', paddingBottom: '80px', overflow: 'visible' }}>
      {/* Banner Section with Back Button and Location */}
      <div className="relative w-full overflow-hidden">
        {/* Background with coffee banner */}
        {bannerImage ? (
          <div className="relative w-full z-0">
            <img
              src={bannerImage}
              alt={categoryTitle || "Coffee"}
              className="w-full h-auto object-contain"
              style={{ display: 'block' }}
              onError={(e) => {
                e.target.style.display = 'none'
              }}
            />
          </div>
        ) : (
          <div className="relative w-full z-0 bg-gray-200 h-64 flex items-center justify-center">
            <ImageIcon className="w-16 h-16 text-gray-400" />
          </div>
        )}

        {/* Navbar with Back Button - Overlay on top of image */}
        <nav className="absolute top-0 left-0 right-0 z-20 w-full px-3 sm:px-6 lg:px-8 py-3 sm:py-4 backdrop-blur-sm">
          <div className="flex items-center justify-start gap-3 sm:gap-4">
            {/* Back Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-9 w-9 sm:h-10 sm:w-10 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5 text-gray-800" strokeWidth={2.5} />
            </Button>

            {/* Location with Dotted Underline */}
            <Button
              variant="ghost"
              onClick={handleLocationClick}
              className="text-left text-white text-sm sm:text-base font-semibold backdrop-blur-sm rounded-full px-3 sm:px-4 py-2 hover:bg-white transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FaLocationDot className="h-4 w-4 sm:h-5 sm:w-5 text-white flex-shrink-0" />
                <span className="text-sm sm:text-base font-semibold text-white truncate border-b-2 border-dotted border-white">
                  {cityName}
                </span>
              </div>
            </Button>
          </div>
        </nav>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          {(categoryTitle || categoryDescription) && (
            <div className="mb-6">
              {categoryTitle && (
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                  {categoryTitle}
                </h1>
              )}
              {categoryDescription && (
                <p className="text-sm sm:text-base text-gray-500">
                  {categoryDescription}
                </p>
              )}
              <div className="h-px bg-gray-200 mt-4"></div>
            </div>
          )}

          {/* Multiple Store Lists */}
          {storeSections.length > 0 ? (
            storeSections.map((section, index) => (
              <div key={section.id || index}>
                {renderStoreList(section.stores || [], section.title || "")}
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-600">No stores available.</p>
            </div>
          )}
        </div>
      </div>
    </AnimatedPage>
  )
}
import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { X, Search, Clock, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { restaurantAPI } from "@/lib/api"

// LocalStorage key for recent searches
const RECENT_SEARCHES_KEY = 'bakalacart_recent_searches'
const MAX_RECENT_SEARCHES = 8

// Helper function to get recent searches from localStorage
const getRecentSearches = () => {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Error reading recent searches:', error)
    return []
  }
}

// Helper function to save recent search to localStorage
const saveRecentSearch = (searchTerm) => {
  try {
    const recentSearches = getRecentSearches()
    // Remove if already exists
    const filtered = recentSearches.filter(term => term.toLowerCase() !== searchTerm.toLowerCase())
    // Add to beginning
    const updated = [searchTerm, ...filtered].slice(0, MAX_RECENT_SEARCHES)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error('Error saving recent search:', error)
  }
}

export default function SearchOverlay({ isOpen, onClose, searchValue, onSearchChange }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [allDishes, setAllDishes] = useState([])
  const [filteredDishes, setFilteredDishes] = useState([])
  const [recentSearches, setRecentSearches] = useState([])
  const [loadingDishes, setLoadingDishes] = useState(true)

  // Load recent searches from localStorage
  useEffect(() => {
    if (isOpen) {
      setRecentSearches(getRecentSearches())
    }
  }, [isOpen])

  // Fetch all dishes from all restaurants
  useEffect(() => {
    const fetchAllDishes = async () => {
      if (!isOpen) return

      try {
        setLoadingDishes(true)

        // Fetch all restaurants
        const restaurantsResponse = await restaurantAPI.getRestaurants()

        if (restaurantsResponse?.data?.success && restaurantsResponse?.data?.data?.restaurants) {
          const restaurants = restaurantsResponse.data.data.restaurants

          // Fetch menus for all restaurants in parallel (limit to first 50 for performance)
          const menuPromises = restaurants.slice(0, 50).map(async (restaurant) => {
            try {
              const restaurantId = restaurant.restaurantId || restaurant._id
              const menuResponse = await restaurantAPI.getMenuByRestaurantId(restaurantId)

              if (menuResponse?.data?.success && menuResponse?.data?.data?.menu) {
                const menu = menuResponse.data.data.menu
                const dishes = []

                // Extract all dishes from menu sections and subsections
                if (menu.sections && Array.isArray(menu.sections)) {
                  menu.sections.forEach((section) => {
                    // Items directly in section
                    if (section.items && Array.isArray(section.items)) {
                      section.items.forEach((item) => {
                        if (item.name && item.isAvailable !== false) {
                          // Calculate final price
                          const originalPrice = item.originalPrice || item.price || 0
                          const discountPercent = item.discountPercent || 0
                          const finalPrice = discountPercent > 0
                            ? Math.round(originalPrice * (1 - discountPercent / 100))
                            : originalPrice

                          // Get image
                          const image = item.image?.url || item.image ||
                            section.image?.url || section.image ||
                            restaurant.profileImage?.url || ''

                          dishes.push({
                            id: item._id || item.id || `${restaurantId}-${item.name}`,
                            name: item.name,
                            image: image,
                            price: finalPrice,
                            originalPrice: originalPrice,
                            restaurantId: restaurantId,
                            restaurantName: restaurant.name || 'Unknown Restaurant',
                            restaurantSlug: restaurant.slug || restaurant.name?.toLowerCase().replace(/\s+/g, '-'),
                            category: item.category || section.name || '',
                            foodType: item.foodType || 'Non-Veg',
                            description: item.description || ''
                          })
                        }
                      })
                    }

                    // Items in subsections
                    if (section.subsections && Array.isArray(section.subsections)) {
                      section.subsections.forEach((subsection) => {
                        if (subsection.items && Array.isArray(subsection.items)) {
                          subsection.items.forEach((item) => {
                            if (item.name && item.isAvailable !== false) {
                              // Calculate final price
                              const originalPrice = item.originalPrice || item.price || 0
                              const discountPercent = item.discountPercent || 0
                              const finalPrice = discountPercent > 0
                                ? Math.round(originalPrice * (1 - discountPercent / 100))
                                : originalPrice

                              // Get image
                              const image = item.image?.url || item.image ||
                                subsection.image?.url || subsection.image ||
                                section.image?.url || section.image ||
                                restaurant.profileImage?.url || ''

                              dishes.push({
                                id: item._id || item.id || `${restaurantId}-${item.name}`,
                                name: item.name,
                                image: image,
                                price: finalPrice,
                                originalPrice: originalPrice,
                                restaurantId: restaurantId,
                                restaurantName: restaurant.name || 'Unknown Restaurant',
                                restaurantSlug: restaurant.slug || restaurant.name?.toLowerCase().replace(/\s+/g, '-'),
                                category: item.category || subsection.name || section.name || '',
                                foodType: item.foodType || 'Non-Veg',
                                description: item.description || ''
                              })
                            }
                          })
                        }
                      })
                    }
                  })
                }

                return dishes
              }
              return []
            } catch (error) {
              console.warn(`Failed to fetch menu for restaurant:`, error)
              return []
            }
          })

          // Wait for all menu fetches to complete
          const allDishesArrays = await Promise.all(menuPromises)

          // Flatten and deduplicate dishes by name (keep first occurrence)
          const dishesMap = new Map()
          allDishesArrays.flat().forEach(dish => {
            const key = dish.name.toLowerCase().trim()
            if (!dishesMap.has(key)) {
              dishesMap.set(key, dish)
            }
          })

          const uniqueDishes = Array.from(dishesMap.values())
          setAllDishes(uniqueDishes)
          setFilteredDishes(uniqueDishes)
        }
      } catch (error) {
        console.error('Error fetching dishes:', error)
        setAllDishes([])
        setFilteredDishes([])
      } finally {
        setLoadingDishes(false)
      }
    }

    fetchAllDishes()
  }, [isOpen])

  // Filter dishes based on search value
  useEffect(() => {
    if (searchValue.trim() === "") {
      setFilteredDishes(allDishes)
    } else {
      const lowerSearch = searchValue.toLowerCase().trim()
      const filtered = allDishes.filter((dish) => {
        const nameMatch = (dish.name || "").toLowerCase().includes(lowerSearch)
        const categoryMatch = (dish.category || "").toLowerCase().includes(lowerSearch)
        const restaurantMatch = (dish.restaurantName || "").toLowerCase().includes(lowerSearch)
        const descriptionMatch = (dish.description || "").toLowerCase().includes(lowerSearch)

        return nameMatch || categoryMatch || restaurantMatch || descriptionMatch
      })
      setFilteredDishes(filtered)
    }
  }, [searchValue, allDishes])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose])

  const handleSuggestionClick = (suggestion) => {
    onSearchChange(suggestion)
    inputRef.current?.focus()
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchValue.trim()) {
      const searchTerm = searchValue.trim()
      saveRecentSearch(searchTerm)
      navigate(`/user/search?q=${encodeURIComponent(searchTerm)}`)
      onClose()
      onSearchChange("")
    }
  }

  const handleFoodClick = (dish) => {
    const searchTerm = dish.name
    saveRecentSearch(searchTerm)
    navigate(`/user/search?q=${encodeURIComponent(searchTerm)}`)
    onClose()
    onSearchChange("")
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-[#0a0a0a]"
      style={{
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      {/* Header with Search Bar */}
      <div className="flex-shrink-0 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground dark:text-gray-400 z-10" />
              <Input
                ref={inputRef}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search for food, restaurants..."
                aria-label="Search for food and restaurants"
                className="pl-12 pr-4 h-12 w-full bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-gray-800 focus:border-primary-orange dark:focus:border-primary-orange rounded-full text-lg dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close search"
              className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5 text-gray-700 dark:text-gray-300" aria-hidden="true" />
            </Button>
          </form>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 scrollbar-hide bg-white dark:bg-[#0a0a0a]">
        {/* Recent Searches Section */}
        {recentSearches.length > 0 && (
          <div
            className="mb-6"
            style={{
              animation: 'slideDown 0.3s ease-out 0.1s both'
            }}
          >
            <h3 className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary-orange" />
              Recent Searches
            </h3>
            <div className="flex gap-2 sm:gap-3 flex-wrap">
              {recentSearches.map((suggestion, index) => (
                <button
                  key={`${suggestion}-${index}`}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 border border-orange-200 dark:border-orange-800 hover:border-orange-300 dark:hover:border-orange-700 text-gray-700 dark:text-gray-300 hover:text-primary-orange dark:hover:text-orange-400 transition-all duration-200 text-xs sm:text-sm font-medium shadow-sm hover:shadow-md"
                  style={{
                    animation: `scaleIn 0.3s ease-out ${0.1 + index * 0.02}s both`
                  }}
                >
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-primary-orange flex-shrink-0" />
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loadingDishes && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary-orange mb-4" />
            <p className="text-gray-600 dark:text-gray-400 text-sm">Loading dishes...</p>
          </div>
        )}

        {/* Dishes Grid */}
        {!loadingDishes && (
          <div
            style={{
              animation: 'fadeIn 0.3s ease-out 0.2s both'
            }}
          >
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
              {searchValue.trim() === ""
                ? `All Dishes (${filteredDishes.length})`
                : `Search Results (${filteredDishes.length})`}
            </h3>
            {filteredDishes.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
                {filteredDishes.map((dish, index) => (
                  <div
                    key={dish.id}
                    className="flex flex-col items-center gap-2 sm:gap-3 cursor-pointer group"
                    style={{
                      animation: `slideUp 0.3s ease-out ${0.25 + 0.05 * (index % 12)}s both`
                    }}
                    onClick={() => handleFoodClick(dish)}
                  >
                    <div className="relative w-full aspect-square rounded-full overflow-hidden transition-all duration-200 shadow-md group-hover:shadow-lg bg-white dark:bg-[#1a1a1a] p-1 sm:p-1.5">
                      {dish.image ? (
                        <img
                          src={dish.image}
                          alt={dish.name}
                          className="w-full h-full object-cover rounded-full"
                          loading="lazy"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                      ) : null}
                      {!dish.image && (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full">
                          <span className="text-2xl">🍽️</span>
                        </div>
                      )}
                    </div>
                    <div className="px-1 sm:px-2 text-center w-full">
                      <span className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 group-hover:text-primary-orange dark:group-hover:text-orange-400 transition-colors line-clamp-2">
                        {dish.name}
                      </span>
                      {dish.price > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          ₹{dish.price}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 sm:py-16">
                <Search className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 text-base sm:text-lg font-semibold">
                  {searchValue.trim()
                    ? `No results found for "${searchValue}"`
                    : "No dishes available"}
                </p>
                <p className="text-sm sm:text-base text-gray-500 dark:text-gray-500 mt-2">
                  {searchValue.trim()
                    ? "Try a different search term"
                    : "Please check back later"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes scaleIn {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
    </div>
  )
}


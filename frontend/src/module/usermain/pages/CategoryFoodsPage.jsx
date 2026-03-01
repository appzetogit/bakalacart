import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Search,
  Clock,
  Star,
  Plus,
  Filter,
  Heart
} from "lucide-react"
import Toast from "../components/Toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function CategoryFoodsPage() {
  const navigate = useNavigate()
  const { categoryName } = useParams()
  const [activeFilter, setActiveFilter] = useState("Popular")
  const [searchQuery, setSearchQuery] = useState("")
  const [wishlist, setWishlist] = useState(() => {
    const saved = localStorage.getItem('wishlist')
    return saved ? JSON.parse(saved) : []
  })
  const [toast, setToast] = useState({ show: false, message: '' })

  // Show toast notification
  const showToast = (message) => {
    setToast({ show: true, message })
    setTimeout(() => {
      setToast({ show: false, message: '' })
    }, 3000)
  }

  // Toggle wishlist item
  const toggleWishlist = (item, type = 'food') => {
    const itemId = type === 'food' ? `food-${item.id}` : `restaurant-${item.id}`
    const { id, ...restItem } = item
    const wishlistItem = {
      id: itemId,
      type,
      originalId: item.id,
      ...restItem
    }

    setWishlist((prev) => {
      const isInWishlist = prev.some((w) => w.id === itemId)
      if (isInWishlist) {
        const updated = prev.filter((w) => w.id !== itemId)
        localStorage.setItem('wishlist', JSON.stringify(updated))
        // Dispatch custom event to notify other components
        window.dispatchEvent(new Event('wishlistUpdated'))
        return updated
      } else {
        // Show toast notification
        setToast({
          show: true,
          message: `Your food item "${item.name}" is added to wishlist`
        })
        setTimeout(() => {
          setToast({ show: false, message: '' })
        }, 3000)
        const updated = [...prev, wishlistItem]
        localStorage.setItem('wishlist', JSON.stringify(updated))
        // Dispatch custom event to notify other components
        window.dispatchEvent(new Event('wishlistUpdated'))
        return updated
      }
    })
  }

  // Check if item is in wishlist
  const isInWishlist = (item, type = 'food') => {
    const itemId = type === 'food' ? `food-${item.id}` : `restaurant-${item.id}`
    return wishlist.some((w) => w.id === itemId)
  }

  // Filter tabs
  const filters = ["Nearby", "Popular", "Cuisines"]

  // Filter food items based on the categoryName param
  const items = [
    {
      id: 1,
      name: "American Burger - Special",
      image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop",
      discount: "10% OFF",
      deliveryTime: "40 mins",
      rating: 4.8,
      cuisine: "American",
      price: 9.50,
      originalPrice: 12.00
    },
    {
      id: 2,
      name: "Bengali Fish Curry",
      image: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=300&fit=crop",
      discount: "15% OFF",
      deliveryTime: "45 mins",
      rating: 4.6,
      cuisine: "Bengali",
      price: 12.50,
      originalPrice: 15.00
    },
    {
      id: 3,
      name: "Caribbean Jerk Chicken",
      image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=300&fit=crop",
      discount: "12% OFF",
      deliveryTime: "35 mins",
      rating: 4.7,
      cuisine: "Caribbean",
      price: 11.00,
      originalPrice: 14.00
    },
    {
      id: 4,
      name: "Woke Ramen - Chinese Mix",
      image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=300&fit=crop",
      discount: "10% OFF",
      deliveryTime: "30 mins",
      rating: 4.5,
      cuisine: "Chinese",
      price: 8.50,
      originalPrice: 10.00
    },
    {
      id: 5,
      name: "Handmade Italian Pasta",
      image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=400&h=300&fit=crop",
      discount: "20% OFF",
      deliveryTime: "25 mins",
      rating: 4.9,
      cuisine: "Italian",
      price: 10.00,
      originalPrice: 13.00
    },
    {
      id: 6,
      name: "Spicy Mexican Tacos",
      image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&h=300&fit=crop",
      discount: "25% OFF",
      deliveryTime: "20 mins",
      rating: 4.4,
      cuisine: "Mexican",
      price: 6.50,
      originalPrice: 9.00
    },
    {
      id: 7,
      name: "Butter Chicken - Indian Special",
      image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop",
      discount: "20% OFF",
      deliveryTime: "40 mins",
      rating: 4.8,
      cuisine: "Indian",
      price: 13.50,
      originalPrice: 17.00
    }
  ]

  // Filter items that match the categoryName from URL
  const categoryFoods = items.filter(item =>
    !categoryName || item.cuisine.toLowerCase() === categoryName.toLowerCase()
  )

  return (
    <div className="min-h-screen bg-[#f6e9dc] pb-20">
      {/* Toast Notification */}
      <Toast show={toast.show} message={toast.message} />
      {/* Top Header */}
      <div className="bg-white sticky top-0 z-50 border-b border-gray-100">
        <div className="px-4 py-3">
          {/* Title Row */}
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-gray-800" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">{categoryName} Food</h1>
          </div>
          {/* Search Bar Row */}
          <div className="flex items-center gap-3">
            {/* Search Bar - Using Input Component */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
              <Input
                type="text"
                placeholder={`Search in ${categoryName}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 h-10 w-full bg-gray-50 border-gray-200 rounded-lg focus:bg-white focus:border-[#ff8100] transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="relative flex gap-2 overflow-x-auto scrollbar-hide flex-1 -mx-4 px-4">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`relative px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${activeFilter === filter
                  ? 'text-white'
                  : 'text-gray-700 border border-gray-200 bg-white'
                  }`}
              >
                {activeFilter === filter && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-[#ff8100] rounded-full z-0"
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30
                    }}
                  />
                )}
                <span className="relative z-10">{filter}</span>
              </button>
            ))}
          </div>

          {/* Filter Button */}
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 transition-colors flex-shrink-0">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* Food Items List */}
      <div className="px-4 py-4 space-y-4 min-h-[50vh]">
        {categoryFoods.length > 0 ? (
          categoryFoods.map((food) => (
            <div
              key={food.id}
              className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/usermain/food/${food.id}`)}
            >
              <div className="flex gap-3 p-3">
                {/* Food Image */}
                <div className="relative flex-shrink-0">
                  <img
                    src={food.image}
                    alt={food.name}
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                  {/* Heart Icon - Top Right */}
                  <button
                    className="absolute top-1 right-1 p-1 bg-white/80 backdrop-blur-sm rounded-full hover:scale-110 transition-transform z-10"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleWishlist(food, 'food')
                    }}
                  >
                    <Heart
                      className={`w-4 h-4 transition-all ${isInWishlist(food, 'food')
                        ? 'text-red-500 fill-red-500'
                        : 'text-gray-400 hover:text-red-500'
                        }`}
                    />
                  </button>
                </div>

                {/* Food Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-sm font-bold text-gray-900 flex-1 truncate">{food.name}</h3>
                    {/* Discount Tag */}
                    <div className="bg-[#ff8100] text-white text-xs font-bold px-2 py-0.5 rounded ml-2 flex-shrink-0">
                      {food.discount}
                    </div>
                  </div>

                  {/* Delivery Time */}
                  <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                    <Clock className="w-3 h-3" />
                    <span>{food.deliveryTime}</span>
                  </div>

                  {/* Rating and Cuisine */}
                  <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span>{food.rating}</span>
                    <span className="ml-1">{food.cuisine}</span>
                  </div>

                  {/* Price and Add Button */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-bold text-gray-900">${food.price.toFixed(2)}</span>
                      <span className="text-xs text-gray-400 line-through">${food.originalPrice.toFixed(2)}</span>
                    </div>

                    {/* Add Button */}
                    <Button
                      className="bg-[#ff8100] hover:bg-[#e67300] text-white rounded-lg px-4 py-1.5 h-auto flex items-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        showToast("Item added to the cart")
                        // Handle add to cart logic here
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-xs font-semibold">Add</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 flex flex-col items-center gap-3">
            <Search className="w-12 h-12 text-gray-300" />
            <p className="text-gray-500 font-medium">No items found in {categoryName}</p>
            <Button
              variant="outline"
              onClick={() => navigate('/usermain')}
              className="mt-2 text-[#ff8100] border-[#ff8100]"
            >
              Go Back Home
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
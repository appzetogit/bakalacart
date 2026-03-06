import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { X, Search, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// LocalStorage key for recent searches
const RECENT_SEARCHES_KEY = 'bakalacart_recent_searches'
const MAX_RECENT_SEARCHES = 8

// Helper function to get recent searches from localStorage
const getRecentSearches = () => {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    return []
  }
}

// Helper function to save recent search to localStorage
const saveRecentSearch = (searchTerm) => {
  try {
    const recentSearches = getRecentSearches()
    const filtered = recentSearches.filter(term => term.toLowerCase() !== searchTerm.toLowerCase())
    const updated = [searchTerm, ...filtered].slice(0, MAX_RECENT_SEARCHES)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  } catch (error) {
    // silently ignore
  }
}

export default function SearchOverlay({ isOpen, onClose, searchValue, onSearchChange }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [recentSearches, setRecentSearches] = useState([])

  // Load recent searches from localStorage when overlay opens
  useEffect(() => {
    if (isOpen) {
      setRecentSearches(getRecentSearches())
    }
  }, [isOpen])

  // Focus input when overlay opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Handle Escape key
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
    // Clicking a recent search fills the input and immediately navigates
    saveRecentSearch(suggestion)
    // Use canonical search route without /user prefix to avoid routing inconsistencies
    navigate(`/search?q=${encodeURIComponent(suggestion)}`)
    onClose()
    onSearchChange("")
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchValue.trim()) {
      const searchTerm = searchValue.trim()
      saveRecentSearch(searchTerm)
      // Use canonical search route without /user prefix to avoid routing inconsistencies
      navigate(`/search?q=${encodeURIComponent(searchTerm)}`)
      onClose()
      onSearchChange("")
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-[#0a0a0a]"
      style={{ animation: 'fadeIn 0.2s ease-out' }}
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 scrollbar-hide bg-white dark:bg-[#0a0a0a]">

        {/* Recent Searches Section */}
        {recentSearches.length > 0 && (
          <div className="mb-6" style={{ animation: 'slideDown 0.3s ease-out 0.05s both' }}>
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
                  style={{ animation: `scaleIn 0.3s ease-out ${0.1 + index * 0.02}s both` }}
                >
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-primary-orange flex-shrink-0" />
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Prompt to type and search */}
        <div className="flex flex-col items-center justify-center py-16" style={{ animation: 'fadeIn 0.3s ease-out 0.1s both' }}>
          <div className="w-20 h-20 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center mb-5">
            <Search className="h-9 w-9 text-primary-orange" />
          </div>
          <p className="text-gray-800 dark:text-white text-lg font-semibold mb-2">
            {searchValue.trim() ? `Press Enter to search "${searchValue}"` : "What are you craving?"}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Search for dishes, restaurants, or cuisines
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

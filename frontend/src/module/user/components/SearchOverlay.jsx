import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { X, Search, Clock, Loader2, UtensilsCrossed, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { restaurantAPI } from "@/lib/api"

// LocalStorage key for recent searches
const RECENT_SEARCHES_KEY = 'bakalacart_recent_searches'
const MAX_RECENT_SEARCHES = 8
// Debounce delay (200–300ms per requirements)
const SEARCH_DEBOUNCE_MS = 250
const MAX_SUGGESTIONS = 4
// Client-side cache for API responses (5 min TTL)
const SUGGESTIONS_CACHE_KEY = 'search_suggestions_cache'
const CACHE_MAX_AGE_MS = 5 * 60 * 1000

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

// Get cached suggestions from sessionStorage
function getCachedSuggestions(query) {
  try {
    const raw = sessionStorage.getItem(SUGGESTIONS_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw)
    if (Date.now() - (cache.timestamp || 0) > CACHE_MAX_AGE_MS) return null
    const entry = cache.entries?.[query.trim().toLowerCase()]
    return entry ? entry.suggestions : null
  } catch {
    return null
  }
}

// Save suggestions to cache
function setCachedSuggestions(query, suggestions) {
  try {
    const raw = sessionStorage.getItem(SUGGESTIONS_CACHE_KEY)
    const cache = raw ? JSON.parse(raw) : { entries: {}, timestamp: Date.now() }
    cache.timestamp = Date.now()
    cache.entries = cache.entries || {}
    cache.entries[query.trim().toLowerCase()] = { suggestions, timestamp: Date.now() }
    // Keep only last 50 entries to avoid memory bloat
    const keys = Object.keys(cache.entries)
    if (keys.length > 50) {
      const toRemove = keys.slice(0, keys.length - 50)
      toRemove.forEach(k => delete cache.entries[k])
    }
    sessionStorage.setItem(SUGGESTIONS_CACHE_KEY, JSON.stringify(cache))
  } catch (_) {}
}

export default function SearchOverlay({ isOpen, onClose, searchValue, onSearchChange }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)
  const [recentSearches, setRecentSearches] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(true)
  const debounceRef = useRef(null)

  // LOCAL STATE for instant typing – input updates immediately without waiting for parent
  const [localValue, setLocalValue] = useState(searchValue || "")

  // Sync from parent when overlay opens (e.g. reset on close)
  useEffect(() => {
    if (isOpen) {
      setLocalValue(searchValue || "")
    } else {
      setLocalValue("")
    }
  }, [isOpen, searchValue])

  // Load recent searches when overlay opens
  useEffect(() => {
    if (!isOpen) return
    setRecentSearches(getRecentSearches())
  }, [isOpen])

  // Debounced API search – 250ms after last keystroke
  const runSearch = useCallback((value) => {
    const trimmed = (value || "").trim()
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([])
      setSuggestionsLoading(false)
      return
    }

    // Check cache first for instant display
    const cached = getCachedSuggestions(trimmed)
    if (cached && cached.length >= 0) {
      setSuggestions(cached.slice(0, MAX_SUGGESTIONS))
      setSuggestionsLoading(false)
      return
    }

    setSuggestionsLoading(true)

    restaurantAPI
      .searchSuggestions(trimmed, MAX_SUGGESTIONS)
      .then((res) => {
        if (!res?.data?.success || !Array.isArray(res?.data?.data?.suggestions)) {
          setSuggestions([])
          return
        }
        const list = res.data.data.suggestions.slice(0, MAX_SUGGESTIONS)
        setSuggestions(list)
        setCachedSuggestions(trimmed, list)
      })
      .catch(() => {
        setSuggestions([])
      })
      .finally(() => {
        setSuggestionsLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const val = localValue
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!(val || "").trim() || val.trim().length < 2) {
      setSuggestions([])
      setSuggestionsLoading(false)
      setShowDropdown(true)
      return
    }
    setShowDropdown(true)
    setSuggestionsLoading(true)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      runSearch(val)
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [isOpen, localValue, runSearch])

  // Hide dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return
    const handleMouseDown = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleMouseDown)
    return () => document.removeEventListener("mousedown", handleMouseDown)
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
    saveRecentSearch(suggestion)
    navigate(`/search?q=${encodeURIComponent(suggestion)}`)
    onClose()
    onSearchChange("")
  }

  const handleLiveSuggestionClick = (item) => {
    saveRecentSearch(item.type === "dish" ? item.dishName : item.name)
    if (item.type === "restaurant") {
      navigate(`/user/restaurants/${item.slug || item.restaurantId}`)
    } else {
      // Food item → show all restaurants that serve this food
      navigate(`/search?q=${encodeURIComponent(item.dishName || "")}`)
    }
    onClose()
    onSearchChange("")
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    const trimmed = localValue.trim()
    if (trimmed) {
      saveRecentSearch(trimmed)
      navigate(`/search?q=${encodeURIComponent(trimmed)}`)
      onClose()
      onSearchChange("")
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-[#0a0a0a]"
      style={{ animation: "fadeIn 0.2s ease-out" }}
    >
      {/* Header with Search Bar */}
      <div className="flex-shrink-0 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-4">
            <div className="flex-1 relative" ref={dropdownRef}>
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground dark:text-gray-400 z-10" />
              <Input
                ref={inputRef}
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                placeholder="Search for food, restaurants..."
                aria-label="Search for food and restaurants"
                aria-expanded={suggestions.length > 0 || suggestionsLoading}
                aria-haspopup="listbox"
                className="pl-12 pr-4 h-12 w-full bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-gray-800 focus:border-primary-orange dark:focus:border-primary-orange rounded-full text-lg dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
              />
              {/* Live suggestions dropdown - show when 2+ chars typed */}
              {showDropdown && localValue.trim().length >= 2 && (
                <div
                  className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] shadow-lg py-2 max-h-64 overflow-y-auto"
                  role="listbox"
                >
                  {suggestionsLoading && suggestions.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-3 text-gray-500 dark:text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span className="text-sm">Searching...</span>
                    </div>
                  ) : suggestions.length > 0 ? (
                    suggestions.map((item, idx) => (
                      <button
                        key={
                          item.type === "dish"
                            ? `dish-${item.restaurantId}-${item.dishName}-${idx}`
                            : `rest-${item.restaurantId}-${idx}`
                        }
                        type="button"
                        role="option"
                        className="w-full text-left px-4 py-2.5 hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-center gap-3 transition-colors"
                        onClick={() => handleLiveSuggestionClick(item)}
                      >
                        {item.type === "dish" ? (
                          <UtensilsCrossed className="h-4 w-4 text-primary-orange flex-shrink-0" />
                        ) : (
                          <Store className="h-4 w-4 text-primary-orange flex-shrink-0" />
                        )}
                        <span className="text-gray-800 dark:text-white flex-1 min-w-0">
                          {item.type === "dish" ? (
                            <>
                              <strong>{item.dishName}</strong>
                              <span className="text-gray-500 dark:text-gray-400 text-sm ml-1">
                                ({item.restaurantName})
                              </span>
                            </>
                          ) : (
                            <strong>{item.name}</strong>
                          )}
                        </span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 flex-shrink-0">
                          {item.type === "dish" ? "Food" : "Restaurant"}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-gray-500 dark:text-gray-400 text-sm text-center">
                      No results found. Press Enter to search.
                    </div>
                  )}
                </div>
              )}
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
          <div className="mb-6" style={{ animation: "slideDown 0.3s ease-out 0.05s both" }}>
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
        <div className="flex flex-col items-center justify-center py-16" style={{ animation: "fadeIn 0.3s ease-out 0.1s both" }}>
          <div className="w-20 h-20 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center mb-5">
            <Search className="h-9 w-9 text-primary-orange" />
          </div>
          <p className="text-gray-800 dark:text-white text-lg font-semibold mb-2">
            {localValue.trim() ? `Press Enter to search "${localValue}"` : "What are you craving?"}
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

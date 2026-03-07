import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { locationAPI, userAPI, zoneAPI } from "@/lib/api"

export const LocationContext = createContext(null)

/**
 * Global Location Provider to manage user location and zone state
 * Ensures only one instance of geolocation watchers and API calls
 */
export const LocationProvider = ({ children }) => {
    // CRITICAL: Initialize from localStorage immediately to prevent loading blink
    const [location, setLocation] = useState(() => {
        try {
            const stored = localStorage.getItem("userLocation")
            if (stored) {
                const parsed = JSON.parse(stored)
                return parsed
            }
        } catch (e) {
            // Ignore parse errors
        }
        return null
    })
    
    // CRITICAL: Set loading to false if we have location from localStorage
    const [loading, setLoading] = useState(() => {
        try {
            const stored = localStorage.getItem("userLocation")
            if (stored) {
                const parsed = JSON.parse(stored)
                // If we have valid location data, don't show loading
                if (parsed && (parsed.latitude || parsed.city)) {
                    return false
                }
            }
        } catch (e) {
            // Ignore parse errors
        }
        return true
    })
    
    const [error, setError] = useState(null)
    const [permissionGranted, setPermissionGranted] = useState(() => {
        // If we have location in localStorage, assume permission was granted
        try {
            const stored = localStorage.getItem("userLocation")
            if (stored) {
                const parsed = JSON.parse(stored)
                if (parsed && (parsed.latitude || parsed.city)) {
                    return true
                }
            }
        } catch (e) {
            // Ignore parse errors
        }
        return false
    })

    // Zone State (from useZone)
    const [zoneId, setZoneId] = useState(null)
    const [zoneStatus, setZoneStatus] = useState('IN_SERVICE') // Always in service
    const [zone, setZone] = useState(null)
    const [zoneLoading, setZoneLoading] = useState(false)
    const [zoneError, setZoneError] = useState(null)

    const watchIdRef = useRef(null)
    const updateTimerRef = useRef(null)
    const prevLocationCoordsRef = useRef({ latitude: null, longitude: null })
    const prevZoneCoordsRef = useRef({ latitude: null, longitude: null })
    const isManualRef = useRef(false)
    const hasInitializedRef = useRef(false) // Prevent multiple initializations

    /* ===================== DB UPDATE ===================== */
    const updateLocationInDB = useCallback(async (locationData) => {
        try {
            const hasPlaceholder =
                locationData?.city === "Current Location" ||
                locationData?.address === "Select location" ||
                locationData?.formattedAddress === "Select location" ||
                (!locationData?.city && !locationData?.address && !locationData?.formattedAddress);

            if (hasPlaceholder) return;

            const userToken = localStorage.getItem('user_accessToken') || localStorage.getItem('accessToken')
            if (!userToken || userToken === 'null' || userToken === 'undefined') return

            const locationPayload = {
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                address: locationData.address || "",
                city: locationData.city || "",
                state: locationData.state || "",
                area: locationData.area || "",
                formattedAddress: locationData.formattedAddress || locationData.address || "",
            }

            if (locationData.accuracy !== undefined) locationPayload.accuracy = locationData.accuracy
            if (locationData.postalCode) locationPayload.postalCode = locationData.postalCode

            // Critical: Ensure we have coordinates before calling API
            const lat = parseFloat(locationPayload.latitude);
            const lng = parseFloat(locationPayload.longitude);
            if (isNaN(lat) || isNaN(lng)) {
                console.warn("⚠️ [LocationContext] Skipping DB update: Missing or invalid coordinates")
                return
            }

            console.log("💾 [LocationContext] Updating live location in DB")
            await userAPI.updateLocation(locationPayload)
        } catch (err) {
            if (err.response?.status !== 503 && err.response?.status !== 404 && err.response?.status !== 401) {
                console.error("❌ [LocationContext] DB update error:", err)
            }
        }
    }, [])

    /* ===================== ZONE DETECTION ===================== */
    const detectZone = useCallback(async (lat, lng) => {
        // Zone detection disabled: always treat user as in service
        setZoneStatus('IN_SERVICE')
        setZoneLoading(false)
        setZoneError(null)
        setZoneId(null)
        setZone(null)
    }, [])

    /* ===================== REVERSE GEOCODING ===================== */
    const reverseGeocodeDirect = async (latitude, longitude) => {
        try {
            const controller = new AbortController()
            setTimeout(() => controller.abort(), 3000)
            const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`, { signal: controller.signal })
            const data = await res.json()
            return {
                city: data.city || data.locality || "Unknown City",
                state: data.principalSubdivision || "",
                country: data.countryName || "",
                area: data.subLocality || "",
                address: data.formattedAddress || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                formattedAddress: data.formattedAddress || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            }
        } catch {
            return {
                city: "Current Location",
                address: "Select location",
                formattedAddress: "Select location",
            }
        }
    }

    const reverseGeocodeWithGoogleMaps = useCallback(async (latitude, longitude) => {
        try {
            const { getGoogleMapsApiKey } = await import('@/lib/utils/googleMapsApiKey.js')
            const GOOGLE_MAPS_API_KEY = await getGoogleMapsApiKey()

            if (!GOOGLE_MAPS_API_KEY) return reverseGeocodeDirect(latitude, longitude)

            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 15000)

            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}&language=en&region=in&result_type=premise|street_address|establishment|point_of_interest|route|sublocality`,
                { signal: controller.signal }
            )
            clearTimeout(timeoutId)

            const data = await response.json()
            if (data.status !== "OK" || !data.results || data.results.length === 0) {
                return reverseGeocodeDirect(latitude, longitude)
            }

            const exactResult = data.results[0]
            const addressComponents = exactResult.address_components || []
            const formattedAddress = exactResult.formatted_address || ""

            // Extract components Zomato-style
            let city = "", state = "", area = "", postalCode = "", pointOfInterest = "", premise = ""

            for (const component of addressComponents) {
                const types = component.types || []
                const name = component.long_name
                if (types.includes("locality")) city = name
                if (types.includes("administrative_area_level_1")) state = name
                if (types.includes("sublocality_level_1")) area = name
                if (types.includes("postal_code")) postalCode = name
                if (types.includes("point_of_interest")) pointOfInterest = name
                if (types.includes("premise")) premise = name
            }

            const displayAddress = pointOfInterest || premise || area || city || "Location Found"

            return {
                city, state, area: area || city,
                address: displayAddress,
                formattedAddress: formattedAddress,
                postalCode
            }
        } catch (err) {
            console.error("❌ [LocationContext] Google Geocoding failed:", err)
            return reverseGeocodeDirect(latitude, longitude)
        }
    }, [])

    /* ===================== CORE LOCATION GETTER ===================== */
    const getLocation = useCallback(async (updateDB = true, forceFresh = false, showLoading = false, ignoreManual = false) => {
        if (showLoading) setLoading(true)

        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                setError("Geolocation not supported")
                resolve(null)
                return
            }

            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const { latitude, longitude, accuracy } = pos.coords
                    const addr = await reverseGeocodeWithGoogleMaps(latitude, longitude)
                    const finalLoc = { ...addr, latitude, longitude, accuracy, isManual: false }

                    // Only update if not currently a manual selection, OR if we are explicitly ignoring manual (e.g. user clicked "Use current location")
                    if (!isManualRef.current || ignoreManual) {
                        isManualRef.current = false // Reset manual status as we are using GPS
                        setLocation(finalLoc)
                        localStorage.setItem("userLocation", JSON.stringify(finalLoc))
                        if (updateDB) updateLocationInDB(finalLoc)
                    }

                    setPermissionGranted(true)
                    setLoading(false)
                    resolve(finalLoc)
                },
                async (err) => {
                    console.warn("⚠️ [LocationContext] Geolocation error:", err.message)
                    const stored = localStorage.getItem("userLocation")
                    if (stored) {
                        const parsed = JSON.parse(stored)
                        setLocation(parsed)
                        setPermissionGranted(true)
                        setLoading(false)
                        resolve(parsed)
                    } else {
                        const fallback = { city: "Select location", address: "Select location", formattedAddress: "Select location" }
                        setLocation(fallback)
                        setPermissionGranted(false)
                        setLoading(false)
                        resolve(fallback)
                    }
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: forceFresh ? 0 : 60000 }
            )
        })
    }, [reverseGeocodeWithGoogleMaps, updateLocationInDB])

    /* ===================== LIVE TRACKING ===================== */
    const startWatchingLocation = useCallback(() => {
        if (!navigator.geolocation) return
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current)

        watchIdRef.current = navigator.geolocation.watchPosition(
            async (pos) => {
                const { latitude, longitude, accuracy } = pos.coords

                // Threshold check to avoid excessive updates (roughly 22 meters)
                const latDiff = Math.abs(latitude - (prevLocationCoordsRef.current.latitude || 0))
                const lngDiff = Math.abs(longitude - (prevLocationCoordsRef.current.longitude || 0))

                if (latDiff < 0.0002 && lngDiff < 0.0002) return

                prevLocationCoordsRef.current = { latitude, longitude }

                const addr = await reverseGeocodeWithGoogleMaps(latitude, longitude)
                const loc = { ...addr, latitude, longitude, accuracy, isManual: false }

                // Only update if not currently a manual selection
                if (!isManualRef.current) {
                    setLocation(loc)
                    localStorage.setItem("userLocation", JSON.stringify(loc))

                    // Debounced DB update (10 seconds to avoid spamming server)
                    clearTimeout(updateTimerRef.current)
                    updateTimerRef.current = setTimeout(() => updateLocationInDB(loc), 10000)
                }
            },
            (err) => {
                if (err.code !== 3) console.warn("⚠️ [LocationContext] Watch error:", err.message)
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
        )
    }, [reverseGeocodeWithGoogleMaps, updateLocationInDB])

    const stopWatchingLocation = useCallback(() => {
        if (watchIdRef.current) {
            navigator.geolocation.clearWatch(watchIdRef.current)
            watchIdRef.current = null
        }
        clearTimeout(updateTimerRef.current)
    }, [])

    /* ===================== INITIALIZATION ===================== */
    useEffect(() => {
        // CRITICAL: Prevent multiple initializations
        if (hasInitializedRef.current) {
            return
        }

        let isMounted = true
        let initTimeout = null
        
        // CRITICAL: Only initialize if we don't already have location from localStorage
        // This prevents unnecessary state updates and blinks
        if (!location || (!location.latitude && !location.city && location.city !== "Select location")) {
            // CRITICAL: Defer initialization to allow app to render first
            // This prevents blocking the initial render in Flutter WebView
            initTimeout = setTimeout(() => {
                const init = async () => {
                    if (hasInitializedRef.current || !isMounted) return // Double check
                    hasInitializedRef.current = true // Mark as initialized

                    const stored = localStorage.getItem("userLocation")
                    if (stored) {
                        try {
                            const parsed = JSON.parse(stored)
                            if (isMounted) {
                                // Only update if different to prevent unnecessary re-renders
                                if (JSON.stringify(location) !== JSON.stringify(parsed)) {
                                    setLocation(parsed)
                                }
                                isManualRef.current = !!parsed.isManual
                                if (!permissionGranted) {
                                    setPermissionGranted(true)
                                }
                                if (loading) {
                                    setLoading(false)
                                }
                            }
                        } catch (e) {
                            if (isMounted && !location) {
                                getLocation(false, true)
                            }
                        }
                    } else {
                        if (isMounted && !location) {
                            getLocation(false, true)
                        }
                    }

                    if (isMounted) {
                        startWatchingLocation()
                    }
                }

                init()
            }, 300) // 300ms delay to ensure app renders first
        } else {
            // We already have location, just start watching and mark as initialized
            hasInitializedRef.current = true
            isManualRef.current = !!location.isManual
            if (isMounted) {
                startWatchingLocation()
            }
        }

        const handleStorageChange = (e) => {
            if (e.key === "userLocation" && e.newValue && isMounted) {
                try {
                    const parsed = JSON.parse(e.newValue)
                    setLocation(parsed)
                    isManualRef.current = !!parsed.isManual
                } catch { }
            }
        }
        window.addEventListener("storage", handleStorageChange)

        return () => {
            isMounted = false
            if (initTimeout) {
                clearTimeout(initTimeout)
            }
            stopWatchingLocation()
            window.removeEventListener("storage", handleStorageChange)
            // Reset on unmount to allow re-initialization if component remounts
            hasInitializedRef.current = false
        }
    }, []) // CRITICAL: Empty dependency array - only run once on mount

    // Auto-detect zone when location changes (with debouncing and change detection)
    const detectZoneTimeoutRef = useRef(null)
    useEffect(() => {
        if (!location?.latitude || !location?.longitude) return

        const lat = location.latitude
        const lng = location.longitude
        const prevCoords = prevZoneCoordsRef.current
        
        // Check if coordinates have changed significantly (threshold: ~22 meters)
        const latDiff = Math.abs(lat - (prevCoords.latitude || 0))
        const lngDiff = Math.abs(lng - (prevCoords.longitude || 0))
        const threshold = 0.0002 // Roughly 22 meters
        
        // Only detect zone if coordinates changed significantly
        if (latDiff > threshold || lngDiff > threshold || !prevCoords.latitude) {
            prevZoneCoordsRef.current = { latitude: lat, longitude: lng }
            
            // Clear any existing timeout
            if (detectZoneTimeoutRef.current) {
                clearTimeout(detectZoneTimeoutRef.current)
            }
            
            // Debounce zone detection to prevent excessive calls
            detectZoneTimeoutRef.current = setTimeout(() => {
                detectZone(lat, lng)
            }, 500) // 500ms debounce
        }
        
        return () => {
            if (detectZoneTimeoutRef.current) {
                clearTimeout(detectZoneTimeoutRef.current)
            }
        }
    }, [location?.latitude, location?.longitude, detectZone])

    const requestLocation = useCallback(async () => {
        return await getLocation(true, true, true, true)
    }, [getLocation])

    const value = useMemo(() => ({
        location,
        loading,
        error,
        permissionGranted,
        requestLocation,
        startWatchingLocation,
        stopWatchingLocation,
        // Zone stuff
        zoneId,
        zone,
        zoneStatus,
        zoneLoading,
        isInService: true,
        isOutOfService: false,
        refreshZone: () => detectZone(location?.latitude, location?.longitude),
        setLocation,
        updateLocation: (newLoc) => {
            isManualRef.current = !!newLoc.isManual
            setLocation(newLoc)
            localStorage.setItem("userLocation", JSON.stringify(newLoc))
        }
    }), [
        location, loading, error, permissionGranted, requestLocation,
        startWatchingLocation, stopWatchingLocation,
        zoneId, zone, zoneStatus, zoneLoading, detectZone, setLocation
    ])

    return (
        <LocationContext.Provider value={value}>
            {children}
        </LocationContext.Provider>
    )
}

export const useLocation = () => {
    const context = useContext(LocationContext)
    if (!context) {
        throw new Error('useLocation must be used within a LocationProvider')
    }
    return context
}

import { useEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import Lenis from "lenis"
import { useNavigate, useLocation } from "react-router-dom"
import {
  Home,
  FileText,
  UtensilsCrossed,
  User,
  ArrowRight,
  Star,
  Briefcase,
  Bike,
  Headphones,
  Ticket,
  Bell,
  ChevronRight,
  Sparkles,
  LogOut,
  X
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { deliveryAPI } from "@/lib/api"
import { toast } from "sonner"
import { clearModuleAuth } from "@/lib/utils/auth"
import alertSound from "@/assets/audio/delivery aacept ringtone.mp3"
import originalSound from "@/assets/audio/delivery aacept ringtone.mp3"

export default function ProfilePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [animationKey, setAnimationKey] = useState(0)
  const profileRef = useRef(null)
  const navButtonsRef = useRef(null)
  const sectionsRef = useRef(null)
  const previewAudioRef = useRef(null) // Ref to track preview audio
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAlertSoundPopup, setShowAlertSoundPopup] = useState(false)
  const [selectedAlertSound, setSelectedAlertSound] = useState(() => {
    // Load from localStorage, default to "zomato_tone"
    return localStorage.getItem('delivery_alert_sound') || 'zomato_tone'
  })
  const [tempSelectedSound, setTempSelectedSound] = useState(() => {
    // Temporary selection for preview (not saved until Set is clicked)
    return localStorage.getItem('delivery_alert_sound') || 'zomato_tone'
  })

  useEffect(() => {
    // Initialize Lenis for smooth scrolling
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

    // Small delay to ensure refs are set
    const timeoutId = setTimeout(() => {
      // Reset GSAP animations
      if (profileRef.current) {
        gsap.set(profileRef.current, { opacity: 0, y: 30 })
      }
      if (navButtonsRef.current) {
        gsap.set(navButtonsRef.current, { opacity: 0, y: 30 })
      }
      if (sectionsRef.current) {
        gsap.set(sectionsRef.current, { opacity: 0, y: 30 })
      }

      // GSAP animations
      const tl = gsap.timeline()

      if (profileRef.current) {
        tl.to(profileRef.current, {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power3.out"
        })
      }

      if (navButtonsRef.current) {
        tl.to(navButtonsRef.current, {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power3.out"
        }, "-=0.4")
      }

      if (sectionsRef.current) {
        tl.to(sectionsRef.current, {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power3.out"
        }, "-=0.4")
      }
    }, 100)

    return () => {
      lenis.destroy()
      clearTimeout(timeoutId)
    }
  }, [location.pathname, animationKey])

  // Cleanup preview audio when popup closes
  useEffect(() => {
    if (!showAlertSoundPopup) {
      // Stop preview audio if popup is closed
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current.currentTime = 0
        previewAudioRef.current = null
      }
    }
  }, [showAlertSoundPopup])

  // Handle hardware back button for all popups/dialogs
  useEffect(() => {
    if (showAlertSoundPopup) {
      window.history.pushState({ popup: true }, "");
    }

    const handlePopState = () => {
      if (showAlertSoundPopup) {
        setShowAlertSoundPopup(false);
        console.log('🔙 Back button detected: Closing ProfilePage UI elements');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showAlertSoundPopup]);

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        const response = await deliveryAPI.getProfile()
        if (response?.data?.success && response?.data?.data?.profile) {
          const profileData = response.data.data.profile
          setProfile(profileData)
          // Debug: Log profile image data
          console.log("Profile image data:", {
            profileImage: profileData.profileImage,
            documentsPhoto: profileData.documents?.photo,
            hasProfileImage: !!profileData.profileImage?.url,
            hasDocumentsPhoto: !!profileData.documents?.photo
          })
        }
      } catch (error) {
        console.error("Error fetching profile:", error)
        toast.error("Failed to load profile data")
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [])

  // Listen for refresh events from bottom navigation
  useEffect(() => {
    const handleProfileRefresh = () => {
      setAnimationKey(prev => prev + 1)
      // Refetch profile data
      const fetchProfile = async () => {
        try {
          const response = await deliveryAPI.getProfile()
          if (response?.data?.success && response?.data?.data?.profile) {
            setProfile(response.data.data.profile)
          }
        } catch (error) {
          console.error("Error fetching profile:", error)
        }
      }
      fetchProfile()
    }

    window.addEventListener('deliveryProfileRefresh', handleProfileRefresh)

    return () => {
      window.removeEventListener('deliveryProfileRefresh', handleProfileRefresh)
    }
  }, [])

  const handleLogout = async () => {
    if (!window.confirm("Are you sure you want to logout?")) {
      return
    }

    try {
      // Call logout API to clear refresh token on server
      await deliveryAPI.logout()
    } catch (error) {
      console.error("Logout API error (continuing with local cleanup):", error)
      // Continue with local cleanup even if API call fails
    }

    // Use utility function to clear module auth
    clearModuleAuth("delivery")

    // Clear all delivery-related data
    localStorage.removeItem("delivery_gig_storage")
    localStorage.removeItem("delivery_module_storage")
    localStorage.removeItem("app:isOnline")

    // Clear sessionStorage
    sessionStorage.removeItem("deliveryAuthData")

    // Clear any other delivery-related data
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith("delivery_")) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))

    // Dispatch custom events for same-tab updates
    window.dispatchEvent(new Event('deliveryAuthChanged'))
    window.dispatchEvent(new Event('onlineStatusChanged'))

    toast.success("Logged out successfully")

    // Small delay to ensure cleanup completes
    setTimeout(() => {
      // Redirect to sign-in
      navigate("/delivery/sign-in", { replace: true })
    }, 100)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 text-gray-900 font-poppins overflow-x-hidden">
        <div className="bg-white p-4 w-full shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-48 bg-gray-200 animate-pulse rounded"></div>
              </div>
              <div className="h-4 w-32 bg-gray-200 animate-pulse rounded mb-3"></div>
            </div>
            <div className="relative shrink-0 ml-4">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gray-200 animate-pulse border-2 border-gray-200"></div>
            </div>
          </div>
        </div>
        <div className="px-4 py-6 pb-24 md:pb-6">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading profile...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-poppins overflow-x-hidden">
      {/* Main Content */}
      {/* Back Button and Profile Section */}
      <div ref={profileRef} className="mb-0">
        <div className="bg-white p-4 w-full shadow-sm">
          {/* Profile Information */}
          <div
            onClick={() => navigate("/delivery/profile/details")}
            className="flex items-start justify-between"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-2xl md:text-3xl font-bold">
                  {profile?.name || "Delivery Partner"}
                </h2>
                <ChevronRight className="w-5 h-5" />
              </div>
              <p className="text-gray-600 text-sm md:text-base mb-3">
                {profile?.deliveryId || "N/A"}
              </p>
            </div>
            <div className="relative shrink-0 ml-4">
              {profile?.profileImage?.url ? (
                <img
                  src={profile.profileImage.url}
                  alt="Profile"
                  className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-2 border-gray-200"
                  onError={(e) => {
                    // Fallback to documents.photo if profileImage fails to load
                    if (profile?.documents?.photo) {
                      e.target.src = profile.documents.photo
                    } else {
                      // Show default icon if both fail
                      e.target.style.display = 'none'
                      e.target.nextElementSibling?.classList.remove('hidden')
                    }
                  }}
                />
              ) : profile?.documents?.photo ? (
                <img
                  src={profile.documents.photo}
                  alt="Profile"
                  className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-2 border-gray-200"
                  onError={(e) => {
                    // Show default icon if image fails to load
                    e.target.style.display = 'none'
                    e.target.nextElementSibling?.classList.remove('hidden')
                  }}
                />
              ) : null}
              {(!profile?.profileImage?.url && !profile?.documents?.photo) && (
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gray-300 flex items-center justify-center border-2 border-gray-200">
                  <User className="w-10 h-10 md:w-12 md:h-12 text-gray-500" />
                </div>
              )}
              <div className="absolute bottom-0 right-0 bg-white rounded-full p-2 border-2 border-white">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 pb-24 md:pb-6">

        {/* Navigation Buttons */}
        <div ref={navButtonsRef} className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => navigate("/delivery/trip-history")}
            className="bg-white rounded-xl p-5 flex flex-col items-center gap-2 hover:bg-gray-50 transition-all shadow-sm border border-gray-100"
          >
            <div className="bg-blue-50 p-2.5 rounded-lg">
              <Bike className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-bold text-gray-900">My Trips</span>
            <span className="text-[10px] text-gray-500 font-medium">History & details</span>
          </button>
          <button
            onClick={() => navigate("/delivery/earnings")}
            className="bg-white rounded-xl p-5 flex flex-col items-center gap-2 hover:bg-gray-50 transition-all shadow-sm border border-gray-100"
          >
            <div className="bg-green-50 p-2.5 rounded-lg">
              <Star className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm font-bold text-gray-900">Statistics</span>
            <span className="text-[10px] text-gray-500 font-medium">Earnings & stats</span>
          </button>
        </div>

        {/* Sections */}
        <div ref={sectionsRef} className="space-y-4">
          {/* Support Section */}
          <div>
            <h3 className="text-base font-medium mb-3 px-1">Support</h3>
            <div className="space-y-0">
              <div className="h-px bg-gray-200"></div>
              <Card
                onClick={() => navigate("/delivery/help/tickets")}
                className="bg-white py-0 border-0 shadow-none rounded-none first:rounded-t-lg last:rounded-b-lg cursor-pointer hover:bg-gray-200 transition-colors"
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Ticket className="w-5 h-5" />
                    <span className="text-sm font-medium">Support tickets</span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Partner options Section */}
          <div>
            <h3 className="text-base font-medium mb-3 px-1">Partner options</h3>
            <Card
              onClick={() => navigate("/delivery/agreement")}
              className="bg-white py-0 border-0 shadow-none rounded-lg cursor-pointer hover:bg-gray-200 transition-colors mb-3"
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5" />
                  <span className="text-sm font-medium">Agreement</span>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </CardContent>
            </Card>
            <Card
              onClick={() => navigate("/delivery/terms")}
              className="bg-white py-0 border-0 shadow-none rounded-lg cursor-pointer hover:bg-gray-200 transition-colors mb-3"
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5" />
                  <span className="text-sm font-medium">Terms and Conditions</span>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </CardContent>
            </Card>
            <Card
              onClick={() => {
                // Initialize temp selection with current selection when opening popup
                setTempSelectedSound(selectedAlertSound)
                setShowAlertSoundPopup(true)
              }}
              className="bg-white py-0 border-0 shadow-none rounded-lg cursor-pointer hover:bg-gray-200 transition-colors"
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5" />
                  <span className="text-sm font-medium">Order alert sound</span>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </CardContent>
            </Card>
          </div>

          {/* Logout Section */}
          <div className="pt-4">
            <Card
              onClick={handleLogout}
              className="bg-white py-0 border-0 shadow-none rounded-lg cursor-pointer hover:bg-gray-200 transition-colors"
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <LogOut className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-medium text-red-600">Log out</span>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Order Alert Sound Popup */}
      {showAlertSoundPopup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Order alert sound</h3>
              <button
                onClick={() => {
                  // Stop preview audio if playing
                  if (previewAudioRef.current) {
                    previewAudioRef.current.pause()
                    previewAudioRef.current.currentTime = 0
                    previewAudioRef.current = null
                  }
                  // Reset to original selection if cancelled
                  setTempSelectedSound(selectedAlertSound)
                  setShowAlertSoundPopup(false)
                }}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Options */}
            <div className="p-4">
              <div className="space-y-4">
                {/* Original Option */}
                <label className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors">
                  <span className="text-base font-medium">Original</span>
                  <input
                    type="radio"
                    name="alertSound"
                    value="original"
                    checked={tempSelectedSound === 'original'}
                    onChange={(e) => {
                      setTempSelectedSound(e.target.value)
                      // Stop any previously playing preview sound
                      if (previewAudioRef.current) {
                        previewAudioRef.current.pause()
                        previewAudioRef.current.currentTime = 0
                        previewAudioRef.current = null
                      }
                      // Play preview sound (only once, no loop)
                      try {
                        console.log('🔊 Playing preview sound: Original', { originalSoundPath: originalSound })
                        const audio = new Audio(originalSound)
                        audio.volume = 0.7
                        audio.loop = false // Don't loop preview
                        previewAudioRef.current = audio
                        const playPromise = audio.play()
                        if (playPromise !== undefined) {
                          playPromise
                            .then(() => {
                              console.log('✅ Preview sound playing: Original')
                              // Auto-stop when sound ends
                              audio.addEventListener('ended', () => {
                                previewAudioRef.current = null
                              })
                            })
                            .catch(err => {
                              console.error('❌ Preview audio error:', err)
                              previewAudioRef.current = null
                            })
                        }
                      } catch (err) {
                        console.error('❌ Could not create preview audio:', err)
                        previewAudioRef.current = null
                      }
                    }}
                    className="w-5 h-5 text-black focus:ring-2 focus:ring-black"
                  />
                </label>

                {/* Zomato Tone Option */}
                <label className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors">
                  <span className="text-base font-medium">Zomato Tone</span>
                  <input
                    type="radio"
                    name="alertSound"
                    value="zomato_tone"
                    checked={tempSelectedSound === 'zomato_tone'}
                    onChange={(e) => {
                      setTempSelectedSound(e.target.value)
                      // Stop any previously playing preview sound
                      if (previewAudioRef.current) {
                        previewAudioRef.current.pause()
                        previewAudioRef.current.currentTime = 0
                        previewAudioRef.current = null
                      }
                      // Play preview sound (only once, no loop)
                      try {
                        console.log('🔊 Playing preview sound: Zomato Tone', { alertSoundPath: alertSound })
                        const audio = new Audio(alertSound)
                        audio.volume = 0.7
                        audio.loop = false // Don't loop preview
                        previewAudioRef.current = audio
                        const playPromise = audio.play()
                        if (playPromise !== undefined) {
                          playPromise
                            .then(() => {
                              console.log('✅ Preview sound playing: Zomato Tone')
                              // Auto-stop when sound ends
                              audio.addEventListener('ended', () => {
                                previewAudioRef.current = null
                              })
                            })
                            .catch(err => {
                              console.error('❌ Preview audio error:', err)
                              previewAudioRef.current = null
                            })
                        }
                      } catch (err) {
                        console.error('❌ Could not create preview audio:', err)
                        previewAudioRef.current = null
                      }
                    }}
                    className="w-5 h-5 text-black focus:ring-2 focus:ring-black"
                  />
                </label>
              </div>
            </div>

            {/* Set Button */}
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  // Stop preview audio if playing
                  if (previewAudioRef.current) {
                    previewAudioRef.current.pause()
                    previewAudioRef.current.currentTime = 0
                    previewAudioRef.current = null
                  }
                  // Save the selected sound
                  setSelectedAlertSound(tempSelectedSound)
                  localStorage.setItem('delivery_alert_sound', tempSelectedSound)
                  setShowAlertSoundPopup(false)
                  // Show success message
                  toast.success(`Alert sound set to ${tempSelectedSound === 'original' ? 'Original' : 'Zomato Tone'}`)
                }}
                className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
              >
                Set
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}


import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { restaurantAPI } from "@/lib/api"
import { setAuthData as setRestaurantAuthData } from "@/lib/utils/auth"
import { registerFCMToken, getFCMToken, getPlatform } from "@/services/pushNotificationService"
import { checkOnboardingStatus } from "../../utils/onboardingUtils"

export default function RestaurantOTP() {
  const navigate = useNavigate()
  const location = useLocation()

  // Get the page user was trying to access before login
  const searchParamsInURL = new URLSearchParams(location.search);
  const returnTo = searchParamsInURL.get('returnTo');
  const from = location.state?.from || returnTo || "/restaurant";
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [resendTimer, setResendTimer] = useState(0)
  const [authData, setAuthData] = useState(null)
  const [contactInfo, setContactInfo] = useState("") // Can be phone or email
  const [contactType, setContactType] = useState("phone") // "phone" or "email"
  const [focusedIndex, setFocusedIndex] = useState(null)
  const [showNameInput, setShowNameInput] = useState(false)
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState("")
  const [verifiedOtp, setVerifiedOtp] = useState("")
  const inputRefs = useRef([])

  useEffect(() => {
    // Get auth data from sessionStorage
    const stored = sessionStorage.getItem("restaurantAuthData")
    if (stored) {
      const data = JSON.parse(stored)
      setAuthData(data)

      // Handle both phone and email
      if (data.method === "email" && data.email) {
        setContactType("email")
        setContactInfo(data.email)
      } else if (data.phone) {
        setContactType("phone")
        // Extract and format phone number for display
        const phoneMatch = data.phone?.match(/(\+\d+)\s*(.+)/)
        if (phoneMatch) {
          const formattedPhone = `${phoneMatch[1]}-${phoneMatch[2].replace(/\D/g, "")}`
          setContactInfo(formattedPhone)
        } else {
          setContactInfo(data.phone || "")
        }
      }
    } else {
      // No auth data, redirect to login
      navigate("/restaurant/login")
      return
    }

    // Start resend timer (60 seconds)
    setResendTimer(60)
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [navigate])

  useEffect(() => {
    // Focus first input on mount (only if not showing name input)
    if (inputRefs.current[0] && !showNameInput) {
      inputRefs.current[0].focus()
    }
  }, [showNameInput])

  const handleChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) {
      return
    }

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError("")

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits are entered
    if (newOtp.every((digit) => digit !== "") && newOtp.length === 6) {
      handleVerify(newOtp.join(""))
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (otp[index]) {
        const newOtp = [...otp]
        newOtp[index] = ""
        setOtp(newOtp)
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus()
        const newOtp = [...otp]
        newOtp[index - 1] = ""
        setOtp(newOtp)
      }
    }
    // Handle paste
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, "").slice(0, 6).split("")
        const newOtp = [...otp]
        digits.forEach((digit, i) => {
          if (i < 6) {
            newOtp[i] = digit
          }
        })
        setOtp(newOtp)
        if (digits.length === 6) {
          handleVerify(newOtp.join(""))
        } else {
          inputRefs.current[digits.length]?.focus()
        }
      })
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text")
    const digits = pastedData.replace(/\D/g, "").slice(0, 6).split("")
    const newOtp = [...otp]
    digits.forEach((digit, i) => {
      if (i < 6) {
        newOtp[i] = digit
      }
    })
    setOtp(newOtp)
    if (digits.length === 6) {
      handleVerify(newOtp.join(""))
      return
    } else {
      inputRefs.current[digits.length]?.focus()
    }
  }

  const handleVerify = async (otpValue = null) => {
    const code = otpValue || otp.join("")

    if (code.length !== 6) {
      setError("Please enter the complete 6-digit code")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      if (!authData) {
        throw new Error("Session expired. Please try logging in again.")
      }

      // Determine identifier type (phone or email)
      const phone = authData.method === "phone" ? authData.phone : null
      const email = authData.method === "email" ? authData.email : null
      const purpose = authData.isSignUp ? "register" : "login"

      // Get FCM Token before login
      let fcmToken = null;
      try {
        fcmToken = await getFCMToken();
      } catch (fcmError) {
        console.error("❌ Error getting FCM token during login:", fcmError);
      }

      // For registration, send a temporary name (will be updated during onboarding)
      // For login, send null as name is not required
      const nameToSend = purpose === "register" ? "Restaurant" : null

      const response = await restaurantAPI.verifyOTP(phone, code, purpose, nameToSend, email, null, fcmToken, getPlatform())

      // Extract restaurant and token from backend response
      const data = response?.data?.data || response?.data

      // If backend tells us this is a new restaurant, ask for name
      if (data.needsName) {
        setShowNameInput(true)
        setVerifiedOtp(code)
        setOtp(["", "", "", "", "", ""])
        setIsLoading(false)
        return
      }

      const accessToken = data?.accessToken
      const restaurant = data?.restaurant

      if (!accessToken || !restaurant) {
        console.error("❌ [Restaurant OTP] Missing accessToken or restaurant in response:", {
          hasAccessToken: !!accessToken,
          hasRestaurant: !!restaurant,
          responseData: data
        })
        throw new Error("Invalid response from server. Please try again.")
      }

      // Store auth data using utility function to ensure proper module-specific token storage
      setRestaurantAuthData("restaurant", accessToken, restaurant, data.refreshToken)

      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new Event("restaurantAuthChanged"))

      // Register FCM Token (non-blocking)
      console.log("🔔 [Restaurant OTP] Attempting to register FCM token...");
      registerFCMToken('restaurant', accessToken).then(() => {
        console.log("✅ [Restaurant OTP] FCM token registration called successfully");
      }).catch((fcmError) => {
        console.error("❌ [Restaurant OTP] Failed to register FCM token:", fcmError);
      })

      sessionStorage.removeItem("restaurantAuthData")

      // Check onboarding status before navigating
      try {
        const onboardingStep = await checkOnboardingStatus()
        console.log("✅ [Restaurant OTP] Onboarding status check:", onboardingStep)

        if (onboardingStep === null) {
          // Onboarding is complete, navigate to restaurant home
          console.log("✅ [Restaurant OTP] Onboarding already complete, redirecting to restaurant home...")
          const finalPath = (from && from !== "/restaurant/otp" && from !== "/restaurant/login") ? from : "/restaurant";
          navigate(finalPath, { replace: true })
        } else {
          // Onboarding not complete, navigate to onboarding with appropriate step
          console.log(`✅ [Restaurant OTP] Onboarding incomplete (step ${onboardingStep}), redirecting to onboarding...`)
          navigate(`/restaurant/onboarding?step=${onboardingStep}`, { replace: true })
        }
      } catch (error) {
        console.error("❌ [Restaurant OTP] Error checking onboarding status:", error)
        // Default to onboarding if check fails (for new registrations)
        navigate("/restaurant/onboarding", { replace: true })
      }
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Invalid OTP. Please try again."
      setError(message)
      setOtp(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return

    setIsLoading(true)
    setError("")

    try {
      if (!authData) {
        throw new Error("Session expired. Please go back and try again.")
      }

      const purpose = authData.isSignUp ? "register" : "login"
      const phone = authData.method === "phone" ? authData.phone : null
      const email = authData.method === "email" ? authData.email : null

      await restaurantAPI.sendOTP(phone, purpose, email)
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to resend OTP. Please try again."
      setError(message)
    }

    setResendTimer(60)
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    setIsLoading(false)
    setOtp(["", "", "", "", "", ""])
    inputRefs.current[0]?.focus()
  }

  const handleSubmitName = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError("Restaurant name is required")
      return
    }

    if (trimmedName.length < 2) {
      setNameError("Restaurant name must be at least 2 characters")
      return
    }

    if (!verifiedOtp) {
      setError("OTP verification step missing. Please request a new OTP.")
      return
    }

    setIsLoading(true)
    setError("")
    setNameError("")

    try {
      if (!authData) {
        throw new Error("Session expired. Please try logging in again.")
      }

      const phone = authData.method === "phone" ? authData.phone : null
      const email = authData.method === "email" ? authData.email : null
      const purpose = authData.isSignUp ? "register" : "login"

      // Get FCM Token before login
      let fcmToken = null;
      try {
        fcmToken = await getFCMToken();
      } catch (fcmError) {
        console.error("❌ Error getting FCM token during registration:", fcmError);
      }

      // Second call with name to auto-register and login
      const response = await restaurantAPI.verifyOTP(phone, verifiedOtp, purpose, trimmedName, email, null, fcmToken, getPlatform())
      const data = response?.data?.data || response?.data

      const accessToken = data?.accessToken
      const restaurant = data?.restaurant

      if (!accessToken || !restaurant) {
        console.error("❌ [Restaurant OTP] Missing accessToken or restaurant in response:", {
          hasAccessToken: !!accessToken,
          hasRestaurant: !!restaurant,
          responseData: data
        })
        throw new Error("Invalid response from server. Please try again.")
      }

      // Store auth data using utility function to ensure proper module-specific token storage
      setRestaurantAuthData("restaurant", accessToken, restaurant, data.refreshToken)

      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new Event("restaurantAuthChanged"))

      // Register FCM Token (non-blocking)
      console.log("🔔 [Restaurant OTP] Attempting to register FCM token...");
      registerFCMToken('restaurant', accessToken).then(() => {
        console.log("✅ [Restaurant OTP] FCM token registration called successfully");
      }).catch((fcmError) => {
        console.error("❌ [Restaurant OTP] Failed to register FCM token:", fcmError);
      })

      sessionStorage.removeItem("restaurantAuthData")

      // Check onboarding status before navigating
      try {
        const onboardingStep = await checkOnboardingStatus()
        console.log("✅ [Restaurant OTP] Onboarding status check:", onboardingStep)

        if (onboardingStep === null) {
          // Onboarding is complete, navigate to restaurant home
          console.log("✅ [Restaurant OTP] Onboarding already complete, redirecting to restaurant home...")
          const finalPath = (from && from !== "/restaurant/otp" && from !== "/restaurant/login") ? from : "/restaurant";
          navigate(finalPath, { replace: true })
        } else {
          // Onboarding not complete, navigate to onboarding with appropriate step
          console.log(`✅ [Restaurant OTP] Onboarding incomplete (step ${onboardingStep}), redirecting to onboarding...`)
          navigate(`/restaurant/onboarding?step=${onboardingStep}`, { replace: true })
        }
      } catch (error) {
        console.error("❌ [Restaurant OTP] Error checking onboarding status:", error)
        // Default to onboarding if check fails (for new registrations)
        navigate("/restaurant/onboarding", { replace: true })
      }
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to complete registration. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const isOtpComplete = otp.every((digit) => digit !== "")

  if (!authData) {
    return null
  }

  return (
    <div className="max-h-screen h-screen bg-white flex flex-col">
      {/* Header with Back Button and Title */}
      <div className="relative flex items-center justify-center py-4 px-4">
        <button
          onClick={() => navigate("/restaurant/login")}
          className="absolute left-4 top-1/2 -translate-y-1/2"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-black" />
        </button>
        <h2 className="text-lg font-bold text-black">Verify details</h2>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col px-6 overflow-y-auto">
        <div className="w-full max-w-md mx-auto space-y-8 py-8">
          {showNameInput ? (
            <>
              {/* Name Input Section */}
              <div className="text-center">
                <p className="text-base text-gray-900 leading-relaxed mb-6">
                  Please enter your restaurant name to complete registration.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Input
                    type="text"
                    placeholder="Restaurant Name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      setNameError("")
                      setError("")
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && name.trim().length >= 2) {
                        handleSubmitName()
                      }
                    }}
                    disabled={isLoading}
                    className="w-full h-12 text-base border-gray-300 focus:border-blue-600 focus:ring-blue-600"
                    autoFocus
                  />
                  {nameError && (
                    <p className="text-sm text-red-600 mt-2">{nameError}</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Instruction Text */}
              <div className="text-center">
                <p className="text-base text-gray-900 leading-relaxed">
                  Enter OTP sent on <span className="font-semibold">{contactInfo}</span>. Do not share OTP with anyone.
                </p>
              </div>

              {/* OTP Input Fields - Square Borders */}
              <div className="flex justify-center gap-3">
                {otp.map((digit, index) => {
                  const hasValue = digit !== ""
                  const isFocused = focusedIndex === index

                  return (
                    <div key={index} className="relative">
                      <input
                        ref={(el) => (inputRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit || ""}
                        onChange={(e) => handleChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={index === 0 ? handlePaste : undefined}
                        onFocus={() => setFocusedIndex(index)}
                        onBlur={() => setFocusedIndex(null)}
                        disabled={isLoading}
                        className={`w-12 h-12 text-center text-2xl font-semibold border-2 rounded-md transition-colors ${isFocused
                          ? "border-blue-600 bg-blue-50"
                          : hasValue
                            ? "border-blue-600 bg-white"
                            : "border-gray-300 bg-white"
                          } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed`}
                        aria-label={`OTP digit ${index + 1}`}
                      />
                    </div>
                  )
                })}
              </div>

              {/* Error Message */}
              {error && (
                <div className="text-center">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Resend OTP Timer */}
              <div className="text-center">
                {resendTimer > 0 ? (
                  <p className="text-sm text-gray-900">
                    Resend OTP in <span className="font-semibold">{resendTimer} secs</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isLoading}
                    className="text-sm text-blue-600 hover:underline font-medium disabled:opacity-50"
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Section - Continue Button */}
      <div className="px-6 pb-8 pt-4">
        <div className="w-full max-w-md mx-auto">
          {showNameInput ? (
            <Button
              onClick={handleSubmitName}
              disabled={isLoading || !name.trim() || name.trim().length < 2}
              className={`w-full h-12 rounded-lg font-bold text-base transition-colors ${!isLoading && name.trim().length >= 2
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
            >
              {isLoading ? "Registering..." : "Continue"}
            </Button>
          ) : (
            <Button
              onClick={() => handleVerify()}
              disabled={isLoading || !isOtpComplete}
              className={`w-full h-12 rounded-lg font-bold text-base transition-colors ${!isLoading && isOtpComplete
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
            >
              {isLoading ? "Verifying..." : "Continue"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, ChevronDown } from "lucide-react"
import { setAuthData } from "@/lib/utils/auth"
import { registerFCMToken, getFCMToken, getPlatform } from "@/services/pushNotificationService"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { restaurantAPI } from "@/lib/api"
import { firebaseAuth, googleProvider } from "@/lib/firebase"

// Common country codes
const countryCodes = [
  { code: "+1", country: "US/CA", flag: "🇺🇸" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+91", country: "IN", flag: "🇮🇳" },
  { code: "+86", country: "CN", flag: "🇨🇳" },
  { code: "+81", country: "JP", flag: "🇯🇵" },
  { code: "+49", country: "DE", flag: "🇩🇪" },
  { code: "+33", country: "FR", flag: "🇫🇷" },
  { code: "+39", country: "IT", flag: "🇮🇹" },
  { code: "+34", country: "ES", flag: "🇪🇸" },
  { code: "+61", country: "AU", flag: "🇦🇺" },
  { code: "+7", country: "RU", flag: "🇷🇺" },
  { code: "+55", country: "BR", flag: "🇧🇷" },
  { code: "+52", country: "MX", flag: "🇲🇽" },
  { code: "+82", country: "KR", flag: "🇰🇷" },
  { code: "+65", country: "SG", flag: "🇸🇬" },
  { code: "+971", country: "AE", flag: "🇦🇪" },
  { code: "+966", country: "SA", flag: "🇸🇦" },
  { code: "+27", country: "ZA", flag: "🇿🇦" },
  { code: "+31", country: "NL", flag: "🇳🇱" },
  { code: "+46", country: "SE", flag: "🇸🇪" },
]

export default function RestaurantLogin() {
  const navigate = useNavigate()
  const [loginMethod, setLoginMethod] = useState("phone") // "phone" or "email"
  const [formData, setFormData] = useState({
    phone: "",
    countryCode: "+91",
    email: "",
  })
  const [errors, setErrors] = useState({
    phone: "",
    email: "",
  })
  const [touched, setTouched] = useState({
    phone: false,
    email: false,
  })
  const [isSending, setIsSending] = useState(false)
  const [apiError, setApiError] = useState("")

  // Get selected country details dynamically
  const selectedCountry = countryCodes.find(c => c.code === formData.countryCode) || countryCodes[2] // Default to India (+91)

  // Phone number validation
  const validatePhone = (phone, countryCode) => {
    if (!phone || phone.trim() === "") {
      return "Phone number is required"
    }

    // Remove any non-digit characters for validation
    const digitsOnly = phone.replace(/\D/g, "")

    // Minimum length check (at least 7 digits)
    if (digitsOnly.length < 7) {
      return "Phone number must be at least 7 digits"
    }

    // Maximum length check (typically 15 digits for international numbers)
    if (digitsOnly.length > 15) {
      return "Phone number is too long"
    }

    // Country-specific validation (India +91)
    if (countryCode === "+91") {
      if (digitsOnly.length !== 10) {
        return "Indian phone number must be 10 digits"
      }
      // Check if it starts with valid Indian mobile prefixes
      const firstDigit = digitsOnly[0]
      if (!["6", "7", "8", "9"].includes(firstDigit)) {
        return "Invalid Indian mobile number"
      }
    }

    return ""
  }

  const handleSendOTP = async () => {
    // Mark all fields as touched
    setTouched({ phone: true })
    setApiError("")

    // Validate
    const phoneError = validatePhone(formData.phone, formData.countryCode)

    if (phoneError) {
      setErrors({ phone: phoneError })
      return
    }

    // Clear errors if validation passes
    setErrors({ phone: "" })

    // Build full phone in E.164-ish format (e.g. +91xxxxxxxxxx)
    const fullPhone = `${formData.countryCode} ${formData.phone}`.trim()

    try {
      setIsSending(true)

      // Call backend to send OTP for login
      await restaurantAPI.sendOTP(fullPhone, "login")

      // Store auth data in sessionStorage for OTP page
      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        module: "restaurant",
      }
      sessionStorage.setItem("restaurantAuthData", JSON.stringify(authData))

      // Navigate to OTP page
      navigate("/restaurant/otp")
    } catch (error) {
      // Extract backend error message if available
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Failed to send OTP. Please try again."
      setApiError(message)
    } finally {
      setIsSending(false)
    }
  }

  // Email validation
  const validateEmail = (email) => {
    if (!email || email.trim() === "") {
      return "Email is required"
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address"
    }

    return ""
  }

  const handleEmailChange = (e) => {
    const value = e.target.value
    const newFormData = {
      ...formData,
      email: value,
    }
    setFormData(newFormData)

    // Validate if field has been touched
    if (touched.email) {
      const error = validateEmail(value)
      setErrors({ ...errors, email: error })
    }
  }

  const handleEmailBlur = () => {
    setTouched({ ...touched, email: true })
    const error = validateEmail(formData.email)
    setErrors({ ...errors, email: error })
  }

  const handleEmailLogin = () => {
    setLoginMethod("email")
  }

  const handleSendEmailOTP = async () => {
    // Mark email field as touched
    setTouched({ ...touched, email: true })
    setApiError("")

    // Validate
    const emailError = validateEmail(formData.email)

    if (emailError) {
      setErrors({ ...errors, email: emailError })
      return
    }

    // Clear errors if validation passes
    setErrors({ ...errors, email: "" })

    try {
      setIsSending(true)

      // Call backend API to send OTP via email
      await restaurantAPI.sendOTP(null, "login", formData.email)

      // Store auth data in sessionStorage for OTP page
      const authData = {
        method: "email",
        email: formData.email,
        isSignUp: false,
        module: "restaurant",
      }
      sessionStorage.setItem("restaurantAuthData", JSON.stringify(authData))

      // Navigate to OTP page
      navigate("/restaurant/otp")
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Failed to send OTP. Please try again."
      setApiError(message)
    } finally {
      setIsSending(false)
    }
  }

  const handleGoogleLogin = async () => {
    setApiError("")
    setIsSending(true)

    try {
      const { signInWithPopup } = await import("firebase/auth")

      // Sign in with Google using Firebase Auth
      const result = await signInWithPopup(firebaseAuth, googleProvider)
      const user = result.user

      // Get Firebase ID token
      const idToken = await user.getIdToken()

      // Get FCM Token before login
      let fcmToken = null;
      try {
        fcmToken = await getFCMToken();
      } catch (fcmError) {
        console.error("❌ Error getting FCM token during login:", fcmError);
      }

      // Call backend to login/register via Firebase Google
      const response = await restaurantAPI.firebaseGoogleLogin(idToken, fcmToken, getPlatform())
      const data = response?.data?.data || {}

      const accessToken = data.accessToken
      const restaurant = data.restaurant

      if (!accessToken || !restaurant) {
        throw new Error("Invalid response from server")
      }

      // Store auth data for restaurant module using utility function
      setAuthData("restaurant", accessToken, restaurant)

      // Register FCM Token (Still call it to ensure sync status is updated in localStorage)
      await registerFCMToken('restaurant', accessToken);

      // Notify any listeners that auth state has changed
      window.dispatchEvent(new Event("restaurantAuthChanged"))

      // Navigate to restaurant home
      navigate("/restaurant")
    } catch (error) {
      console.error("Firebase Google login error [v3]:", error)
      const errorCode = error?.code

      let message = "Failed to login with Google. Please try again."

      if (errorCode === "auth/configuration-not-found") {
        message = "[v3] Firebase configuration error. Please ensure your domain is authorized in Firebase Console and Google Auth is enabled. Current domain: " + window.location.hostname
      } else {
        message = error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          message
      }

      setApiError(message)
    } finally {
      setIsSending(false)
    }
  }

  const handlePhoneChange = (e) => {
    // Only allow digits
    const value = e.target.value.replace(/\D/g, "")
    const newFormData = {
      ...formData,
      phone: value,
    }
    setFormData(newFormData)

    // Real-time validation
    const error = validatePhone(value, formData.countryCode)
    setErrors({ ...errors, phone: error })

    // Mark as touched when user starts typing
    if (!touched.phone && value.length > 0) {
      setTouched({ ...touched, phone: true })
    }
  }

  const handlePhoneBlur = () => {
    // Mark as touched on blur if not already touched
    if (!touched.phone) {
      setTouched({ ...touched, phone: true })
    }
    // Re-validate on blur
    const error = validatePhone(formData.phone, formData.countryCode)
    setErrors({ ...errors, phone: error })
  }

  const handleCountryCodeChange = (value) => {
    const newFormData = {
      ...formData,
      countryCode: value,
    }
    setFormData(newFormData)

    // Re-validate phone if it's been touched
    if (touched.phone) {
      const error = validatePhone(formData.phone, value)
      setErrors({ ...errors, phone: error })
    }
  }

  const isValidPhone = !errors.phone && formData.phone.trim().length > 0
  const isValidEmail = !errors.email && formData.email.trim().length > 0

  return (
    <div className="max-h-screen h-screen bg-white flex flex-col">
      {/* Header with Back Button */}
      <div className="relative flex items-center justify-center py-4 px-4 mt-2">

        <button
          onClick={() => navigate("/restaurant/welcome")}
          className="absolute left-4 top-4"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-black" />
        </button>
      </div>

      {/* Top Section - Logo and Badge */}
      <div className="flex flex-col items-center pt-8 pb-8 px-6">
        {/* Appzeto Logo */}
        <div>
          <h1
            className="text-3xl italic md:text-4xl tracking-wide font-extrabold text-black"
            style={{
              WebkitTextStroke: "0.5px black",
              textStroke: "0.5px black"
            }}
          >

            Bakala Cart
          </h1>
        </div>

        {/* Restaurant Partner Badge */}
        <div className="">
          <span className="text-gray-600 font-light text-sm tracking-wide block text-center">
            — restaurant partner —
          </span>
        </div>
      </div>

      {/* Main Content - Form Section */}
      <div className="flex-1 flex flex-col px-6 overflow-y-auto">
        <div className="w-full max-w-md mx-auto space-y-6 py-4">
          {/* Instruction Text */}
          <div className="text-center">
            <p className="text-base text-gray-700 leading-relaxed">
              {loginMethod === "email"
                ? "Enter your registered email and we will send an OTP to continue"
                : "Enter your registered phone number and we will send an OTP to continue"
              }
            </p>
          </div>

          {/* Phone Number Input */}
          {loginMethod === "phone" && (
            <div className="space-y-4">
              <div className="flex gap-2 items-stretch w-full">
                {/* Country Code Selector */}
                <Select
                  value={formData.countryCode}
                  onValueChange={handleCountryCodeChange}
                >
                  <SelectTrigger className="w-[100px] h-12 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center shrink-0" style={{ height: '48px' }}>
                    <SelectValue>
                      <span className="flex items-center gap-1.5">
                        <span className="text-base">{selectedCountry.flag}</span>
                        <span className="text-sm font-medium text-gray-900">{selectedCountry.code}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {countryCodes.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        <span className="flex items-center gap-2">
                          <span>{country.flag}</span>
                          <span>{country.code}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Phone Number Input */}
                <div className="flex-1 flex flex-col">
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    onBlur={handlePhoneBlur}
                    className={`w-full px-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 text-base border rounded-lg min-w-0 bg-white ${errors.phone && formData.phone.length > 0
                      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                      }`}
                    style={{ height: '48px' }}
                  />
                  {errors.phone && formData.phone.length > 0 && (
                    <p className="text-red-500 text-xs mt-1 ml-1">{errors.phone}</p>
                  )}
                </div>
              </div>

              {/* API error */}
              {apiError && (
                <p className="text-red-500 text-xs mt-1 ml-1">{apiError}</p>
              )}

              {/* Send OTP Button */}
              <Button
                onClick={handleSendOTP}
                disabled={!isValidPhone || isSending}
                className={`w-full h-12 rounded-lg font-bold text-base transition-colors ${isValidPhone && !isSending
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
              >
                {isSending ? "Sending OTP..." : "Send OTP"}
              </Button>
            </div>
          )}

          {/* Email Input */}
          {loginMethod === "email" && (
            <div className="space-y-4">
              <div className="flex flex-col">
                <input
                  type="email"
                  inputMode="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={handleEmailChange}
                  onBlur={handleEmailBlur}
                  className={`w-full px-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 text-base border rounded-lg bg-white ${errors.email && formData.email.length > 0
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                    }`}
                  style={{ height: '48px' }}
                />
                {errors.email && formData.email.length > 0 && (
                  <p className="text-red-500 text-xs mt-1 ml-1">{errors.email}</p>
                )}
              </div>

              {/* API error */}
              {apiError && (
                <p className="text-red-500 text-xs mt-1 ml-1">{apiError}</p>
              )}

              {/* Send OTP Button */}
              <Button
                onClick={handleSendEmailOTP}
                disabled={!isValidEmail || isSending}
                className={`w-full h-12 rounded-lg font-bold text-base transition-colors ${isValidEmail && !isSending
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
              >
                {isSending ? "Sending OTP..." : "Send OTP"}
              </Button>
            </div>
          )}

        </div>
      </div>

      {/* Bottom Section - Terms and Conditions */}
      <div className="px-6 pb-8 pt-4">
        <div className="w-full max-w-md mx-auto">
          <p className="text-xs text-center text-gray-600 leading-relaxed">
            By continuing, you agree to our
          </p>
          <p className="text-xs text-center text-gray-600 underline mt-1">
            Terms of Service | Privacy Policy | Code of Conduct
          </p>
        </div>
      </div>
    </div>
  )
}


import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { deliveryAPI } from "@/lib/api"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"

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

export default function DeliverySignIn() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get the page user was trying to access before login
  const from = location.state?.from || "/delivery"
  const [formData, setFormData] = useState({
    phone: "",
    countryCode: "+91",
  })
  const [error, setError] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [companyName, setCompanyName] = useState("Bakala Cart")

  // Prefill phone number from sessionStorage when returning from OTP screen
  useEffect(() => {
    const stored = sessionStorage.getItem("deliveryAuthData")
    if (stored) {
      try {
        const authData = JSON.parse(stored)
        if (authData.method === "phone" && authData.phone) {
          // Extract country code and phone number from stored data
          // Format is like "+91 7610416911" or "+91-7610416911" or "+917610416911"
          const phoneStr = authData.phone.replace(/\s/g, "").replace(/-/g, "")
          
          // Find matching country code (try longest codes first to avoid partial matches)
          const sortedCodes = [...countryCodes].sort((a, b) => b.code.length - a.code.length)
          const matchedCountry = sortedCodes.find(country => 
            phoneStr.startsWith(country.code)
          )
          
          if (matchedCountry) {
            // Extract phone number (remove country code)
            const phoneNumber = phoneStr.slice(matchedCountry.code.length).replace(/\D/g, "").slice(0, 10)
            
            if (phoneNumber.length === 10) {
              setFormData({
                phone: phoneNumber,
                countryCode: matchedCountry.code,
              })
            }
          }
        }
      } catch (error) {
        console.error("Error parsing stored auth data:", error)
      }
    }
  }, [])

  // Fetch business settings for company name
  useEffect(() => {
    const fetchBusinessSettings = async () => {
      try {
        const response = await api.get(API_ENDPOINTS.ADMIN.BUSINESS_SETTINGS_PUBLIC)
        if (response.data.success && response.data.data?.companyName) {
          setCompanyName(response.data.data.companyName)
        }
      } catch (error) {
        console.error('Error fetching business settings:', error)
        // Keep default "Bakala Cart" if fetch fails
      }
    }
    
    fetchBusinessSettings()
  }, [])

  // Get selected country details dynamically
  const selectedCountry = countryCodes.find(c => c.code === formData.countryCode) || countryCodes[2] // Default to India (+91)

  const validatePhone = (phone, countryCode) => {
    if (!phone || phone.trim() === "") {
      return "Phone number is required"
    }

    const digitsOnly = phone.replace(/\D/g, "")

    // Strict validation: must be exactly 10 digits
    if (digitsOnly.length !== 10) {
      return "Mobile number must be exactly 10 digits"
    }

    // India-specific validation for first digit
    if (countryCode === "+91") {
      const firstDigit = digitsOnly[0]
      if (!["6", "7", "8", "9"].includes(firstDigit)) {
        return "Invalid Indian mobile number"
      }
    }

    return ""
  }

  const handleSendOTP = async () => {
    setError("")

    const phoneError = validatePhone(formData.phone, formData.countryCode)
    if (phoneError) {
      setError(phoneError)
      return
    }

    const fullPhone = `${formData.countryCode} ${formData.phone}`.trim()

    try {
      setIsSending(true)

      // Call backend to send OTP for delivery login
      await deliveryAPI.sendOTP(fullPhone, "login")

      // Store auth data in sessionStorage for OTP page
      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        module: "delivery",
      }
      sessionStorage.setItem("deliveryAuthData", JSON.stringify(authData))

      // Navigate to OTP page
      navigate("/delivery/otp")
    } catch (err) {
      console.error("Send OTP Error:", err)
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to send OTP. Please try again."
      setError(message)
      setIsSending(false)
    }
  }

  const handlePhoneChange = (e) => {
    // Only allow digits and limit to 10 digits
    const value = e.target.value.replace(/\D/g, "").slice(0, 10)
    setFormData({
      ...formData,
      phone: value,
    })
    // Clear error when user starts typing
    if (error) {
      setError("")
    }
  }

  const handleCountryCodeChange = (value) => {
    setFormData({
      ...formData,
      countryCode: value,
    })
  }

  const isValid = !validatePhone(formData.phone, formData.countryCode)

  return (
    <div className="max-h-screen h-screen bg-white flex flex-col">
      {/* Top Section - Logo and Badge */}
      <div className="flex flex-col items-center pt-8 pb-6 px-6">
        <div>
          <h1 className="text-3xl text-black font-extrabold italic lowercase tracking-tight">
            {companyName}
          </h1>
        </div>
        
        {/* DELIVERY Badge */}
        <div className="bg-black px-6 py-2 rounded mt-2">
          <span className="text-white font-semibold text-sm uppercase tracking-wide">
            DELIVERY
          </span>
        </div>
      </div>

      {/* Main Content - Form Section */}
      <div className="flex-1 flex flex-col px-6">
        <div className="w-full max-w-md mx-auto space-y-6">
          {/* Sign In Heading */}
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold text-black">
              Sign in to your account
            </h2>
            <p className="text-base text-gray-600">
              Login or create an account
            </p>
          </div>

          {/* Mobile Number Input */}
          <div className="space-y-2 w-full">
            <div className="flex gap-2 items-stretch w-full">
              <Select
                value={formData.countryCode}
                onValueChange={handleCountryCodeChange}
              >
                <SelectTrigger className="w-[100px] !h-12 border-gray-300 rounded-lg flex items-center shrink-0" size="default">
                  <SelectValue>
                    <span className="flex items-center gap-2">
                      <span>{selectedCountry.flag}</span>
                      <span>{selectedCountry.code}</span>
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
              <input
                type="tel"
                inputMode="numeric"
                placeholder="Enter mobile number"
                value={formData.phone}
                onChange={handlePhoneChange}
                autoComplete="off"
                autoFocus={false}
                className={`flex-1 h-12 px-4 text-gray-900 placeholder-gray-400 focus:outline-none text-base border rounded-lg min-w-0 ${
                  error ? "border-red-500" : "border-gray-300"
                }`}
              />
            </div>

            {/* Hint Text */}
            <p className="text-sm text-gray-500">
              Enter a valid 10 digit mobile number
            </p>

            {error && (
              <p className="text-sm text-red-500">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section - Continue Button and Terms */}
      <div className="px-6 pb-8 pt-4">
        <div className="w-full max-w-md mx-auto space-y-4">
          {/* Continue Button */}
          <button
            onClick={handleSendOTP}
            disabled={!isValid || isSending}
            className={`w-full py-4 rounded-lg font-bold text-base transition-colors ${
              isValid && !isSending
                ? "bg-[#00B761] hover:bg-[#00A055] active:bg-[#009049] text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isSending ? "Sending OTP..." : "Continue"}
          </button>

          {/* Terms and Conditions */}
          <p className="text-xs text-center text-gray-600 px-4">
            By continuing, you agree to our{" "}
            <button
              onClick={() => navigate("/delivery/terms")}
              className="text-blue-600 hover:underline bg-transparent border-none p-0 cursor-pointer"
            >
              Terms and Conditions
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}


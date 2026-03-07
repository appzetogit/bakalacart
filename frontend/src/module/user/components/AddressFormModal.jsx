import React, { useState, useEffect } from "react"
import { X, MapPin, ChevronLeft, Navigation, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useProfile } from "../context/ProfileContext"
import { useLocation } from "../context/LocationContext"
import { toast } from "sonner"

export default function AddressFormModal({ isOpen, onClose, onSaveSuccess, editAddress = null }) {
    const { addAddress, updateAddress, userProfile } = useProfile()
    const { location } = useLocation()

    const [formData, setFormData] = useState({
        flatNo: "",
        floor: "",
        buildingName: "",
        landmark: "",
        phone: "",
        pinCode: "",
        city: "",
        state: "",
        label: "Home",
        autoAddress: "" // Hidden from typing, used for bottom box
    })

    // Reset or pre-fill form when modal opens or editAddress changes
    useEffect(() => {
        if (isOpen) {
            if (editAddress) {
                // Parse additionalDetails to extract flat, floor, landmark
                // Format: "Flat 123, Floor 3, Landmark: near temple, Location: XYZ"
                const details = editAddress.additionalDetails || ""
                const flatMatch = details.match(/Flat ([^,]*)/)
                const floorMatch = details.match(/Floor ([^,]*)/)
                const landmarkMatch = details.match(/Landmark: ([^,]*)/)
                const locationMatch = details.match(/Location: (.*)/)

                setFormData({
                    flatNo: flatMatch ? flatMatch[1].trim() : "",
                    floor: floorMatch ? floorMatch[1].trim() : "",
                    buildingName: editAddress.street || "",
                    landmark: landmarkMatch ? landmarkMatch[1].trim() : "",
                    name: editAddress.receiverName || editAddress.name || "",
                    phone: (editAddress.phone || "").replace(/^\+91\s?/, "").replace(/\D/g, "").slice(0, 10),
                    pinCode: (editAddress.zipCode || "").replace(/\D/g, '').slice(0, 6),
                    city: editAddress.city || "",
                    state: editAddress.state || "",
                    label: editAddress.label || "Home",
                    autoAddress: locationMatch ? locationMatch[1].trim() : ""
                })
            } else {
                setFormData({
                    flatNo: "",
                    floor: "",
                    buildingName: "",
                    landmark: "",
                    name: "",
                    phone: "",
                    pinCode: "",
                    city: location?.city || "",
                    state: location?.state || "",
                    label: "Home",
                    autoAddress: ""
                })
            }
        }
    }, [isOpen, editAddress])

    useEffect(() => {
        // Only set pinCode from location if it's currently empty
        if (isOpen && location?.postalCode && !editAddress && !formData.pinCode) {
            // Validate and limit pin code from location
            const validatedPinCode = String(location.postalCode || '').replace(/\D/g, '').slice(0, 6)
            setFormData(prev => ({ ...prev, pinCode: validatedPinCode }))
        }
    }, [location?.postalCode, isOpen, editAddress, formData.pinCode])

    const handleChange = (e) => {
        const { name, value } = e.target

        // Validation for phone number
        if (name === "phone") {
            // Only allow numbers and max 10 digits
            const cleanValue = value.replace(/\D/g, "").slice(0, 10)
            setFormData(prev => ({ ...prev, [name]: cleanValue }))
            return
        }

        // Validation for pin code - only numbers, max 6 digits
        if (name === "pinCode") {
            // Only allow numeric input and limit to 6 digits
            const numericValue = value.replace(/\D/g, '') // Remove non-numeric characters
            const limitedValue = numericValue.slice(0, 6) // Strictly limit to 6 digits
            setFormData(prev => ({ ...prev, [name]: limitedValue }))
            return
        }

        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!formData.flatNo.trim()) {
            toast.error("Flat/Room No is required")
            return
        }

        if (!formData.floor.trim()) {
            toast.error("Floor is required")
            return
        }

        if (!formData.buildingName.trim()) {
            toast.error("Building/Chawl Name is required")
            return
        }

        if (!formData.name.trim()) {
            toast.error("Receiver's name is required")
            return
        }

        if (!formData.phone) {
            toast.error("Phone number is required")
            return
        }

        if (formData.phone.length !== 10) {
            toast.error("Please enter a valid 10-digit phone number")
            return
        }

        if (!formData.pinCode) {
            toast.error("Pin Code is required")
            return
        }

        // Validate pin code: must be numeric and max 6 digits
        const numericPinCode = formData.pinCode.replace(/\D/g, '')
        if (numericPinCode.length === 0) {
            toast.error("Pin Code is required")
            return
        }
        if (numericPinCode.length > 6) {
            toast.error("Pin Code cannot exceed 6 digits")
            return
        }
        
        // Final safety check: ensure pin code doesn't exceed 6 digits
        const finalPinCode = numericPinCode.slice(0, 6)
        if (finalPinCode !== formData.pinCode) {
            setFormData(prev => ({ ...prev, pinCode: finalPinCode }))
        }

        // City & State must be entered manually but are not restricted to any region
        const manualCity = (formData.city || "").trim()
        const manualState = (formData.state || "").trim()

        if (!manualCity) {
            toast.error("City is required")
            return
        }

        if (!manualState) {
            toast.error("State is required")
            return
        }

        try {
            // Map form fields to backend address structure
            const additionalDetails = [
                formData.flatNo ? `Flat ${formData.flatNo}` : "",
                formData.floor ? `Floor ${formData.floor}` : "",
                formData.landmark ? `Landmark: ${formData.landmark}` : "",
                formData.autoAddress ? `Location: ${formData.autoAddress}` : ""
            ].filter(Boolean).join(", ")

            // Ensure all required fields are properly trimmed and not empty
            const trimmedStreet = formData.buildingName.trim()
            const trimmedCity = manualCity.trim()
            const trimmedState = manualState.trim()
            
            if (!trimmedStreet || !trimmedCity || !trimmedState) {
                toast.error("Building name, City, and State are required fields")
                return
            }
            
            // Ensure zipCode is present and valid
            const finalZipCode = (formData.pinCode || editAddress?.zipCode || "").replace(/\D/g, '').slice(0, 6)
            if (!finalZipCode) {
                toast.error("Pin Code is required")
                setSavingAddress(false)
                return
            }

            const addressData = {
                label: formData.label || "Home",
                street: trimmedStreet,
                additionalDetails: additionalDetails || "",
                city: trimmedCity,
                state: trimmedState,
                zipCode: finalZipCode,
                latitude: location?.latitude || editAddress?.latitude || null,
                longitude: location?.longitude || editAddress?.longitude || null,
                phone: formData.phone || "",
                receiverName: formData.name || ""
            }
            
            // Log the data being sent for debugging
            console.log("💾 Saving address with data:", {
                ...addressData,
                hasStreet: !!addressData.street,
                hasCity: !!addressData.city,
                hasZipCode: !!addressData.zipCode,
                zipCodeLength: addressData.zipCode.length
            })

            if (editAddress) {
                const addressId = editAddress.id || editAddress._id
                await updateAddress(addressId, addressData)
                toast.success("Address updated successfully!")
            } else {
                const newAddress = await addAddress(addressData)
                toast.success("Address saved successfully!")
                if (onSaveSuccess) onSaveSuccess(newAddress)
            }
            onClose()
        } catch (error) {
            console.error("Error saving address:", error)
            console.error("Error details:", {
                message: error?.message,
                response: error?.response?.data,
                status: error?.response?.status
            })
            
            // Extract error message from backend response structure
            // Backend format: { success: false, message: "...", errors: [...] }
            let errorMessage = "Failed to save address. Please try again."
            
            if (error?.response?.data) {
                const responseData = error.response.data
                
                // Backend sends message in response.data.message
                if (responseData.message) {
                    errorMessage = responseData.message
                } 
                // Handle validation errors array
                else if (responseData.errors && Array.isArray(responseData.errors)) {
                    errorMessage = responseData.errors.join(", ")
                }
                // Handle errors object (from validation)
                else if (responseData.errors && typeof responseData.errors === 'object') {
                    const errorMessages = Object.values(responseData.errors).map(err => 
                        typeof err === 'string' ? err : err.message || err
                    )
                    errorMessage = errorMessages.join(", ")
                }
                // Fallback to error or msg
                else if (responseData.error) {
                    errorMessage = responseData.error
                } else if (responseData.msg) {
                    errorMessage = responseData.msg
                } else if (typeof responseData === 'string') {
                    errorMessage = responseData
                }
            } else if (error?.message) {
                errorMessage = error.message
            }
            
            // Show more specific error messages based on status code
            if (error?.response?.status === 400) {
                if (!errorMessage || errorMessage === "Failed to save address. Please try again.") {
                    errorMessage = "Invalid address data. Please check all required fields (Building name, City, State)."
                }
            } else if (error?.response?.status === 401) {
                errorMessage = "Please login to save address."
            } else if (error?.response?.status === 500) {
                if (!errorMessage || errorMessage === "Failed to save address. Please try again.") {
                    errorMessage = "Server error. Please try again later."
                }
            }
            
            toast.error(errorMessage)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[10000] flex flex-col bg-white dark:bg-[#0a0a0a] animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="flex items-center px-4 py-4 border-b dark:border-gray-800">
                <button onClick={onClose} className="p-1">
                    <ChevronLeft className="h-6 w-6" />
                </button>
                <h1 className="ml-4 text-lg font-bold">{editAddress ? "Edit address" : "Enter your address"}</h1>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            name="flatNo"
                            placeholder="Flat/Room No *"
                            value={formData.flatNo}
                            onChange={handleChange}
                            required
                            className={`h-12 rounded-xl bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700 ${!formData.flatNo.trim() && formData.flatNo !== undefined ? '' : ''}`}
                        />
                    </div>

                    <div className="space-y-2">
                        <Input
                            name="floor"
                            placeholder="Floor *"
                            value={formData.floor}
                            onChange={handleChange}
                            required
                            className="h-12 rounded-xl bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700"
                        />
                    </div>

                    <div className="space-y-2">
                        <Input
                            name="buildingName"
                            placeholder="Building/Chawl Name *"
                            value={formData.buildingName}
                            onChange={handleChange}
                            required
                            className="h-12 rounded-xl bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700"
                        />
                    </div>

                    <div className="space-y-2">
                        <Input
                            name="landmark"
                            placeholder="Landmark"
                            value={formData.landmark}
                            onChange={handleChange}
                            className="h-12 rounded-xl bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700"
                        />
                    </div>

                    <div className="space-y-2">
                        <Input
                            name="name"
                            placeholder="Your Name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            className="h-12 rounded-xl bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700"
                        />
                    </div>

                    <div className="space-y-2 relative">
                        <div className="flex items-center h-12 rounded-xl bg-gray-50 border border-gray-200 dark:bg-gray-900/50 dark:border-gray-700 overflow-hidden px-4">
                            <span className="text-gray-500 font-medium mr-2 border-r pr-2 dark:border-gray-700">+91</span>
                            <input
                                name="phone"
                                type="tel"
                                maxLength={10}
                                placeholder="Phone Number"
                                value={formData.phone}
                                onChange={handleChange}
                                required
                                className="flex-1 bg-transparent border-none outline-none text-sm md:text-base"
                            />
                            {formData.phone && (
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, phone: "" }))}
                                    className="text-gray-400 p-1"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Input
                                name="city"
                                placeholder="City *"
                                value={formData.city}
                                onChange={handleChange}
                                required
                                className="h-12 rounded-xl bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700"
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                name="state"
                                placeholder="State *"
                                value={formData.state}
                                onChange={handleChange}
                                required
                                className="h-12 rounded-xl bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Input
                            name="pinCode"
                            placeholder="Pin code *"
                            value={formData.pinCode}
                            onChange={handleChange}
                            onKeyDown={(e) => {
                                // Prevent typing if already 6 digits (except backspace, delete, arrow keys, etc.)
                                const currentLength = formData.pinCode.replace(/\D/g, '').length
                                if (currentLength >= 6 && 
                                    !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End'].includes(e.key) &&
                                    !e.ctrlKey && !e.metaKey &&
                                    /[0-9]/.test(e.key)) {
                                    e.preventDefault()
                                    return false
                                }
                            }}
                            onPaste={(e) => {
                                e.preventDefault()
                                const pastedText = e.clipboardData.getData('text')
                                const numericPasted = pastedText.replace(/\D/g, '').slice(0, 6)
                                setFormData(prev => ({ ...prev, pinCode: numericPasted }))
                            }}
                            onInput={(e) => {
                                // Real-time validation on input event
                                const inputValue = e.target.value.replace(/\D/g, '')
                                if (inputValue.length > 6) {
                                    const limited = inputValue.slice(0, 6)
                                    e.target.value = limited
                                    setFormData(prev => ({ ...prev, pinCode: limited }))
                                }
                            }}
                            onBeforeInput={(e) => {
                                // Additional layer: prevent input if already 6 digits
                                if (e.data && /[0-9]/.test(e.data)) {
                                    const currentLength = formData.pinCode.replace(/\D/g, '').length
                                    if (currentLength >= 6) {
                                        e.preventDefault()
                                        return false
                                    }
                                }
                            }}
                            required
                            className="h-12 rounded-xl bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700"
                            maxLength={6}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]{0,6}"
                        />
                    </div>

                    {/* Add Location (Static Box) */}
                    <div className="space-y-2 relative">
                        <div className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 min-h-[56px]">
                            <span className="text-sm text-gray-400 truncate pr-4">
                                Add Location
                            </span>
                            {(formData.autoAddress || formData.buildingName || formData.landmark) && (
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, buildingName: "", landmark: "", autoAddress: "" }))}
                                    className="text-gray-400 p-1 flex-shrink-0"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Save Address Button */}
                    <div className="pt-4 border-t dark:border-gray-800 pb-10">
                        <Button
                            type="submit"
                            className="w-full h-14 bg-[#01522c] hover:bg-[#014022] text-white rounded-xl text-lg font-semibold"
                        >
                            {editAddress ? "Update Address" : "Save Address"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}

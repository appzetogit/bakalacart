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
        name: "",
        phone: "",
        pinCode: "",
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
                    pinCode: editAddress.zipCode || "",
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
                    label: "Home",
                    autoAddress: ""
                })
            }
        }
    }, [isOpen, editAddress])

    useEffect(() => {
        if (isOpen && location?.postalCode && !editAddress) {
            setFormData(prev => ({ ...prev, pinCode: location.postalCode }))
        }
    }, [location?.postalCode, isOpen, editAddress])

    const handleChange = (e) => {
        const { name, value } = e.target

        // Validation for phone number
        if (name === "phone") {
            // Only allow numbers and max 10 digits
            const cleanValue = value.replace(/\D/g, "").slice(0, 10)
            setFormData(prev => ({ ...prev, [name]: cleanValue }))
            return
        }

        // Validation for pin code
        if (name === "pinCode") {
            const cleanValue = value.replace(/\D/g, "").slice(0, 6)
            setFormData(prev => ({ ...prev, [name]: cleanValue }))
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

        if (!formData.pinCode || formData.pinCode.length !== 6) {
            toast.error("A valid 6-digit Pin Code is required")
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

            // Try to get city/state from location context, then localStorage fallback
            let city = location?.city || editAddress?.city || ""
            let state = location?.state || editAddress?.state || ""

            if (!city || !state) {
                try {
                    const savedLocation = localStorage.getItem("userLocation")
                    if (savedLocation) {
                        const parsed = JSON.parse(savedLocation)
                        city = city || parsed.city || ""
                        state = state || parsed.state || ""
                    }
                } catch (e) {
                    // ignore parse error
                }
            }

            // Backend requires city and state - show specific error if missing
            if (!city || !state) {
                toast.error("City/State not detected. Please set your location first before saving an address.")
                return
            }

            const addressData = {
                label: formData.label,
                street: formData.buildingName,
                additionalDetails: additionalDetails,
                city,
                state,
                zipCode: formData.pinCode || location?.postalCode || editAddress?.zipCode || "",
                latitude: location?.latitude || editAddress?.latitude || 22.7196,
                longitude: location?.longitude || editAddress?.longitude || 75.8577,
                phone: formData.phone,
                receiverName: formData.name
            }

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
            // Show backend error message if available
            const backendMsg = error?.response?.data?.message
            toast.error(backendMsg || "Failed to save address. Please try again.")
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

                    <div className="space-y-2">
                        <Input
                            name="pinCode"
                            placeholder="Pin code *"
                            value={formData.pinCode}
                            onChange={handleChange}
                            required
                            className="h-12 rounded-xl bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700"
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

import React, { useState, useEffect } from "react"
import { X, MapPin, ChevronLeft, Navigation, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useProfile } from "../context/ProfileContext"
import { useLocation } from "../context/LocationContext"
import { toast } from "sonner"

export default function AddressFormModal({ isOpen, onClose, onSaveSuccess }) {
    const { addAddress, userProfile } = useProfile()
    const { location } = useLocation()

    const [formData, setFormData] = useState({
        flatNo: "",
        floor: "",
        buildingName: "",
        landmark: "",
        name: userProfile?.name || "",
        phone: userProfile?.phone || "",
        pinCode: "",
        label: "Home"
    })

    useEffect(() => {
        if (location?.postalCode) {
            setFormData(prev => ({ ...prev, pinCode: location.postalCode }))
        }
        if (location?.address || location?.area) {
            setFormData(prev => ({ ...prev, landmark: location.address || location.area }))
        }
    }, [location])

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!formData.buildingName || !formData.name || !formData.phone) {
            toast.error("Please fill in required fields")
            return
        }

        try {
            // Map form fields to backend address structure
            const additionalDetails = [
                formData.flatNo ? `Flat ${formData.flatNo}` : "",
                formData.floor ? `Floor ${formData.floor}` : "",
                formData.landmark ? `Landmark: ${formData.landmark}` : ""
            ].filter(Boolean).join(", ")

            const addressData = {
                label: formData.label,
                street: formData.buildingName,
                additionalDetails: additionalDetails,
                city: location?.city || "Indore",
                state: location?.state || "Madhya Pradesh",
                zipCode: formData.pinCode || location?.postalCode || "",
                latitude: location?.latitude || 22.7196,
                longitude: location?.longitude || 75.8577,
                phone: formData.phone,
                receiverName: formData.name
            }

            const newAddress = await addAddress(addressData)
            toast.success("Address saved successfully!")
            if (onSaveSuccess) onSaveSuccess(newAddress)
            onClose()
        } catch (error) {
            console.error("Error saving address:", error)
            toast.error("Failed to save address. Please try again.")
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
                <h1 className="ml-4 text-lg font-bold">Enter your address</h1>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            name="flatNo"
                            placeholder="Flat/Room No"
                            value={formData.flatNo}
                            onChange={handleChange}
                            className="h-12 rounded-xl bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700"
                        />
                    </div>

                    <div className="space-y-2">
                        <Input
                            name="floor"
                            placeholder="Floor"
                            value={formData.floor}
                            onChange={handleChange}
                            className="h-12 rounded-xl bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700"
                        />
                    </div>

                    <div className="space-y-2">
                        <Input
                            name="buildingName"
                            placeholder="Building/Chawl Name"
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
                        <Input
                            name="phone"
                            placeholder="Phone Number"
                            value={formData.phone}
                            onChange={handleChange}
                            required
                            className="h-12 rounded-xl bg-gray-50 border-gray-200 pr-10 dark:bg-gray-900/50 dark:border-gray-700"
                        />
                        {formData.phone && (
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, phone: "" }))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Input
                            name="pinCode"
                            placeholder="Pin code"
                            value={formData.pinCode}
                            onChange={handleChange}
                            className="h-12 rounded-xl bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700"
                        />
                    </div>

                    {/* Add Location Button */}
                    <button
                        type="button"
                        className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
                    >
                        <span className="text-gray-500">Add Location</span>
                        <X className="h-4 w-4 text-gray-400" />
                    </button>

                    {/* Save Address Button */}
                    <div className="pt-4 border-t dark:border-gray-800 pb-10">
                        <Button
                            type="submit"
                            className="w-full h-14 bg-[#01522c] hover:bg-[#014022] text-white rounded-xl text-lg font-semibold"
                        >
                            Save Address
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}

import React from "react"
import { Plus, ChevronRight, MapPin, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DeliveryAddressSelectionModal({
    isOpen,
    onClose,
    addresses,
    selectedAddressId,
    onSelect,
    onAddNew
}) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/50 animate-in fade-in duration-300">
            <div
                className="w-full max-w-lg bg-white dark:bg-[#1a1a1a] rounded-t-[32px] overflow-hidden animate-in slide-in-from-bottom duration-300"
                style={{ maxHeight: '85vh' }}
            >
                {/* Handle bar */}
                <div className="flex justify-center py-3">
                    <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full" />
                </div>

                <div className="px-6 pb-8 space-y-6">
                    <h2 className="text-2xl font-bold dark:text-white">Delivery Address</h2>

                    {/* Add New Address Button */}
                    <button
                        onClick={onAddNew}
                        className="w-full flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl group"
                    >
                        <div className="flex items-center gap-3">
                            <Plus className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">Add New Address</span>
                        </div>
                        <ChevronRight className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                    </button>

                    {/* Saved Addresses Section */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Saved Addresses</h3>

                        <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 scrollbar-hide">
                            {addresses.length > 0 ? (
                                addresses.map((address) => {
                                    const isSelected = selectedAddressId === address.id
                                    const addressString = [
                                        address.street,
                                        address.additionalDetails,
                                        `${address.city}, ${address.state} ${address.zipCode}`
                                    ].filter(Boolean).join(", ")

                                    return (
                                        <div
                                            key={address.id}
                                            onClick={() => onSelect(address.id)}
                                            className="flex items-start gap-4 cursor-pointer group"
                                        >
                                            <div className="p-2 rounded-full bg-gray-50 dark:bg-gray-800 mt-1">
                                                <MapPin className="h-5 w-5 text-emerald-600" />
                                            </div>
                                            <div className="flex-1 min-w-0 border-b dark:border-gray-800 pb-4">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
                                                        {addressString}
                                                    </p>
                                                    <div className={`flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center ${isSelected
                                                            ? "border-emerald-600 bg-emerald-600"
                                                            : "border-gray-200 dark:border-gray-700"
                                                        }`}>
                                                        {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            ) : (
                                <p className="text-sm text-gray-500 py-2">No saved addresses found.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Close on click outside */}
                <div
                    className="absolute inset-x-0 top-0 -translate-y-full h-screen cursor-pointer"
                    onClick={onClose}
                />
            </div>
        </div>
    )
}

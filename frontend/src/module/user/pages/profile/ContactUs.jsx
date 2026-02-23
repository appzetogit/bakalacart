import { Link } from "react-router-dom"
import { useState, useEffect } from "react"
import {
    ArrowLeft,
    Phone,
    Mail,
    MapPin,
    Clock,
    MessageCircle,
    Loader2,
    ExternalLink,
} from "lucide-react"
import { motion } from "framer-motion"
import AnimatedPage from "../../components/AnimatedPage"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import api from "@/lib/api"

export default function ContactUs() {
    const [loading, setLoading] = useState(true)
    const [businessSettings, setBusinessSettings] = useState(null)

    useEffect(() => {
        const fetchBusinessSettings = async () => {
            try {
                setLoading(true)
                const response = await api.get("/business-settings/public")
                if (response.data && response.data.success) {
                    setBusinessSettings(response.data.data)
                }
            } catch (error) {
                // Silent — fallback UI will show
            } finally {
                setLoading(false)
            }
        }
        fetchBusinessSettings()
    }, [])

    const companyName = businessSettings?.companyName || "Bakalaa"
    const supportEmail = businessSettings?.supportEmail || businessSettings?.email || null
    const supportPhone = businessSettings?.supportPhone || businessSettings?.phone || null
    const address = businessSettings?.address || null
    const workingHours = businessSettings?.workingHours || null

    if (loading) {
        return (
            <AnimatedPage className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-[#0a0a0a] dark:to-[#1a1a1a]">
                <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 flex items-center justify-center min-h-[60vh]">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-600 dark:text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
                    </div>
                </div>
            </AnimatedPage>
        )
    }

    return (
        <AnimatedPage className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-[#0a0a0a] dark:to-[#1a1a1a]">
            <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
                {/* Header */}
                <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
                    <Link to="/user/profile">
                        <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 p-0 hover:bg-gray-100 dark:hover:bg-gray-800">
                            <ArrowLeft className="h-5 w-5 md:h-6 md:w-6 text-gray-900 dark:text-white" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">Contact Us</h1>
                </div>

                {/* Hero Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-6"
                >
                    <Card className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-lg border-0 dark:border-gray-800 overflow-hidden">
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-8 md:p-10 text-center">
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.2, duration: 0.5 }}
                                className="flex justify-center mb-5"
                            >
                                <div className="relative">
                                    <div className="absolute inset-0 bg-green-400 rounded-full blur-2xl opacity-30 animate-pulse" />
                                    <div className="relative bg-white dark:bg-gray-800 rounded-full p-5 shadow-xl">
                                        <MessageCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
                                    </div>
                                </div>
                            </motion.div>

                            <motion.h2
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3, duration: 0.5 }}
                                className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2"
                            >
                                We're here to help
                            </motion.h2>

                            <motion.p
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4, duration: 0.5 }}
                                className="text-gray-600 dark:text-gray-400 text-base md:text-lg max-w-xl mx-auto"
                            >
                                Have a question or need support? Reach out to the {companyName} team through any of the options below.
                            </motion.p>
                        </div>
                    </Card>
                </motion.div>

                {/* Contact Options */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                    className="space-y-3 mb-6"
                >
                    {/* Phone */}
                    {supportPhone && (
                        <a href={`tel:${supportPhone}`} className="block">
                            <motion.div whileHover={{ scale: 1.02, x: 4 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }}>
                                <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className="bg-green-100 dark:bg-green-900/30 rounded-xl p-3 flex-shrink-0">
                                            <Phone className="h-6 w-6 text-green-600 dark:text-green-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Phone Support</p>
                                            <p className="text-base font-semibold text-gray-900 dark:text-white truncate">{supportPhone}</p>
                                        </div>
                                        <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                    </CardContent>
                                </Card>
                            </motion.div>
                        </a>
                    )}

                    {/* Email */}
                    {supportEmail && (
                        <a href={`mailto:${supportEmail}`} className="block">
                            <motion.div whileHover={{ scale: 1.02, x: 4 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }}>
                                <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className="bg-blue-100 dark:bg-blue-900/30 rounded-xl p-3 flex-shrink-0">
                                            <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Email Support</p>
                                            <p className="text-base font-semibold text-gray-900 dark:text-white truncate">{supportEmail}</p>
                                        </div>
                                        <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                    </CardContent>
                                </Card>
                            </motion.div>
                        </a>
                    )}

                    {/* Address */}
                    {address && (
                        <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border-0 dark:border-gray-800">
                            <CardContent className="p-4 flex items-start gap-4">
                                <div className="bg-orange-100 dark:bg-orange-900/30 rounded-xl p-3 flex-shrink-0">
                                    <MapPin className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Our Address</p>
                                    <p className="text-base font-semibold text-gray-900 dark:text-white leading-snug">{address}</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Working Hours */}
                    {workingHours && (
                        <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border-0 dark:border-gray-800">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="bg-purple-100 dark:bg-purple-900/30 rounded-xl p-3 flex-shrink-0">
                                    <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Working Hours</p>
                                    <p className="text-base font-semibold text-gray-900 dark:text-white">{workingHours}</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Fallback — show if no contact info available */}
                    {!supportPhone && !supportEmail && !address && (
                        <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border-0 dark:border-gray-800">
                            <CardContent className="p-6 text-center">
                                <MessageCircle className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                <p className="text-base font-medium text-gray-900 dark:text-white mb-1">Contact details coming soon</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Please check back later for support contact information.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </motion.div>

                {/* Help Center Link */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, duration: 0.5 }}
                >
                    <Link to="/user/help">
                        <motion.div whileHover={{ scale: 1.02, x: 4 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }}>
                            <Card className="bg-green-50 dark:bg-green-900/20 rounded-xl shadow-sm border border-green-200 dark:border-green-800 cursor-pointer">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="bg-green-600 rounded-xl p-3 flex-shrink-0">
                                        <MessageCircle className="h-6 w-6 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-base font-semibold text-green-900 dark:text-green-300">Visit Help Center</p>
                                        <p className="text-sm text-green-700 dark:text-green-400">Browse FAQs and order-related help</p>
                                    </div>
                                    <ExternalLink className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Link>
                </motion.div>

                {/* Footer note */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9, duration: 0.5 }}
                    className="text-center mt-8 mb-4"
                >
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                        © {new Date().getFullYear()} {companyName}. All rights reserved.
                    </p>
                </motion.div>
            </div>
        </AnimatedPage>
    )
}

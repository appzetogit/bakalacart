import { useState, useEffect, useRef } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Volume2, VolumeX, Bell, X, ShoppingBag, MapPin, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { useRestaurantNotifications } from "../hooks/useRestaurantNotifications"
import RestaurantNavbar from "./RestaurantNavbar"
import notificationSound from "@/assets/audio/restaurant aacept ringtone.mp3"

/**
 * Global Restaurant Layout to handle notifications and sound across all pages
 */
export default function RestaurantLayout() {
    const navigate = useNavigate()
    const [showNewOrderPopup, setShowNewOrderPopup] = useState(false)
    const [popupOrder, setPopupOrder] = useState(null)
    const [isMuted, setIsMuted] = useState(() => {
        return localStorage.getItem('restaurant_muted') === 'true'
    })
    const [countdown, setCountdown] = useState(240)
    const [isAudioUnlocked, setIsAudioUnlocked] = useState(false)

    const audioRef = useRef(null)
    const shownOrdersRef = useRef(new Set())

    const { newOrder, clearNewOrder, isConnected } = useRestaurantNotifications()

    // Initialize audio once
    useEffect(() => {
        const audio = new Audio(notificationSound)
        audio.loop = true
        audio.volume = 0.8
        audioRef.current = audio

        // Tentative play to check if unlocked
        const checkUnlock = () => {
            audio.play().then(() => {
                audio.pause()
                setIsAudioUnlocked(true)
                window.removeEventListener('click', checkUnlock)
            }).catch(() => {
                // Still locked
            })
        }

        window.addEventListener('click', checkUnlock)

        return () => {
            audio.pause()
            audioRef.current = null
            window.removeEventListener('click', checkUnlock)
        }
    }, [])

    // Persist mute setting
    useEffect(() => {
        localStorage.setItem('restaurant_muted', isMuted)
    }, [isMuted])

    // Process new orders from Socket.io
    useEffect(() => {
        if (newOrder) {
            console.log('🛎️ Layout Received New Order:', newOrder)
            const orderId = newOrder.orderId || newOrder.orderMongoId
            if (orderId && !shownOrdersRef.current.has(orderId)) {
                shownOrdersRef.current.add(orderId)
                setPopupOrder(newOrder)
                setShowNewOrderPopup(true)
                setCountdown(240)

                // Ensure audio plays if allowed
                if (audioRef.current && !isMuted) {
                    audioRef.current.play().catch(() => {
                        setIsAudioUnlocked(false)
                        toast('🔇 Autoplay blocked. Click anywhere to enable notification sound.', {
                            icon: <VolumeX className="text-red-500" />
                        })
                    })
                }
            }
        }
    }, [newOrder, isMuted])

    // Countdown timer
    useEffect(() => {
        let timer
        if (showNewOrderPopup && countdown > 0) {
            timer = setInterval(() => {
                setCountdown(prev => prev - 1)
            }, 1000)
        } else if (countdown === 0) {
            handleClosePopup()
        }
        return () => clearInterval(timer)
    }, [showNewOrderPopup, countdown])

    const handleClosePopup = () => {
        setShowNewOrderPopup(false)
        setPopupOrder(null)
        clearNewOrder()
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
        }
    }

    const handleViewOrder = () => {
        const order = popupOrder || newOrder
        if (order) {
            navigate(`/restaurant/orders/${order.orderMongoId || order.orderId}`)
        }
        handleClosePopup()
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Audio unlocker logic operates silently in background */}

            {/* Main App Content */}
            <div className="pb-16 lg:pb-0">
                <Outlet />
            </div>

            {/* New Order Overlay Popup */}
            <AnimatePresence>
                {showNewOrderPopup && (popupOrder || newOrder) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden border-4 border-blue-600/20"
                        >
                            <div className="relative p-8">
                                {/* Close Button */}
                                <button
                                    onClick={handleClosePopup}
                                    className="absolute top-6 right-6 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-400 transition-colors"
                                >
                                    <X size={20} />
                                </button>

                                {/* Header Section */}
                                <div className="text-center mb-8">
                                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 mb-4 animate-bounce">
                                        <Bell className="w-10 h-10 text-blue-600 fill-blue-600" />
                                    </div>
                                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">New Order!</h2>
                                    <p className="text-blue-600 font-bold mt-1 text-lg">#{(popupOrder || newOrder)?.orderId}</p>
                                </div>

                                {/* Details Card */}
                                <div className="bg-gray-50 rounded-3xl p-6 mb-8 border border-gray-100">
                                    <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-200">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Status</p>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                <span className="text-sm font-black text-gray-800 uppercase">Confirmed</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Total Amount</p>
                                            <p className="text-2xl font-black text-blue-600">₹{(popupOrder || newOrder)?.total}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="p-2 rounded-xl bg-white shadow-sm">
                                                <MapPin size={18} className="text-blue-500" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Delivery Address</p>
                                                <p className="text-sm text-gray-700 font-medium line-clamp-1">
                                                    {(popupOrder || newOrder)?.customerAddress?.street || (popupOrder || newOrder)?.customerAddress?.label || 'Direct Delivery'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4">
                                            <div className="p-2 rounded-xl bg-white shadow-sm">
                                                <ShoppingBag size={18} className="text-blue-500" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Items</p>
                                                <div className="space-y-1 mt-1">
                                                    {(popupOrder || newOrder)?.items?.slice(0, 3).map((item, idx) => (
                                                        <p key={idx} className="text-sm text-gray-700 font-bold flex justify-between">
                                                            <span>{item.quantity}x {item.name}</span>
                                                        </p>
                                                    ))}
                                                    {(popupOrder || newOrder)?.items?.length > 3 && (
                                                        <p className="text-xs text-blue-500 font-bold mt-1 link">+{(popupOrder || newOrder)?.items.length - 3} more items...</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={handleViewOrder}
                                        className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl text-xl font-black shadow-xl shadow-blue-200 transition-all transform active:scale-95 flex items-center justify-center gap-3"
                                    >
                                        Accept & View Order
                                        {/* Countdown badge */}
                                        <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold font-mono">
                                            {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                                        </span>
                                    </button>
                                    <button
                                        onClick={handleClosePopup}
                                        className="w-full py-4 text-gray-400 font-bold hover:text-gray-600 transition-colors"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mute Toggle Control (Floating) */}
            <div className="fixed bottom-24 right-6 z-[100] flex flex-col gap-3 items-end">
                <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`p-4 rounded-full shadow-2xl transition-all float-button ${isMuted ? 'bg-red-100 text-red-600' : 'bg-blue-600 text-white'}`}
                    title={isMuted ? 'Unmute notifications' : 'Mute notifications'}
                >
                    {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                </button>
            </div>
        </div>
    )
}

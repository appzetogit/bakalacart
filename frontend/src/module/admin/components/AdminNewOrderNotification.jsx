import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, ShoppingBag, MapPin, IndianRupee, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Admin New Order Notification Component
 */
export default function AdminNewOrderNotification({ order, onClose }) {
    const navigate = useNavigate();

    if (!order) return null;

    const handleViewOrder = () => {
        navigate(`/admin/orders/${order.orderMongoId || order.orderId}`);
        onClose();
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[9999] w-full max-w-sm"
        >
            <div className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-blue-100 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-white animate-bounce" />
                        <span className="text-white font-bold tracking-tight">New Order Dispatch!</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5">
                    <div className="space-y-4">
                        {/* Order/Restaurant Info */}
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                <Store className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">
                                    {order.restaurantName || 'Unknown Restaurant'}
                                </p>
                                <p className="text-xs text-blue-600 font-medium">#{order.orderId}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-gray-900">₹{order.total}</p>
                                <p className="text-[10px] text-gray-400 uppercase tracking-widest">{order.paymentMethod === 'cash' ? 'COD' : 'Paid'}</p>
                            </div>
                        </div>

                        {/* Items Summary (brief) */}
                        <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <ShoppingBag className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Order Items</span>
                            </div>
                            <div className="space-y-1">
                                {order.items?.slice(0, 2).map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-xs text-gray-600">
                                        <span>{item.quantity}x {item.name}</span>
                                    </div>
                                ))}
                                {order.items?.length > 2 && (
                                    <p className="text-[10px] text-blue-500 font-medium">+{order.items.length - 2} more items</p>
                                )}
                            </div>
                        </div>

                        {/* Customer Address */}
                        <div className="flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                            <p className="text-xs text-gray-600 line-clamp-1">
                                {order.customerAddress?.street || order.customerAddress?.label || 'Direct Delivery'}
                            </p>
                        </div>
                    </div>

                    {/* Action */}
                    <button
                        onClick={handleViewOrder}
                        className="w-full mt-5 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-bold transition-all transform active:scale-[0.98] shadow-lg shadow-gray-200"
                    >
                        View Full Order
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

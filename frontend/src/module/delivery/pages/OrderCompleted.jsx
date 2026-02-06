import { useNavigate, useLocation } from "react-router-dom"
import { CheckCircle2, IndianRupee, ArrowRight, Home, Package } from "lucide-react"
import { motion } from "framer-motion"

export default function OrderCompleted() {
  const navigate = useNavigate()
  const location = useLocation()
  const { earnings, orderId } = location.state || { earnings: 0, orderId: 'N/A' }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6"
      >
        <CheckCircle2 className="w-16 h-16 text-green-600" />
      </motion.div>

      <motion.h1 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-bold text-gray-900 mb-2 text-center"
      >
        Completed Your Order!
      </motion.h1>

      <motion.p 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-gray-500 mb-8 text-center"
      >
        Great job! You've successfully delivered the order #{orderId}.
      </motion.p>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-green-50 rounded-2xl p-6 w-full max-w-sm mb-8 border border-green-100"
      >
        <p className="text-green-800 text-sm font-medium mb-1 text-center">Your Earnings</p>
        <div className="flex items-center justify-center gap-1 text-3xl font-bold text-green-700">
          <IndianRupee className="w-7 h-7" />
          <span>{Number(earnings).toFixed(2)}</span>
        </div>
      </motion.div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex flex-col gap-3 w-full max-w-sm"
      >
        <button
          onClick={() => navigate('/delivery/orders')}
          className="w-full h-14 bg-green-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg hover:bg-green-700 transition-colors"
        >
          <Package className="w-5 h-5" />
          <span>Go to My Orders</span>
          <ArrowRight className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => navigate('/delivery')}
          className="w-full h-14 bg-white text-gray-700 border border-gray-200 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
        >
          <Home className="w-5 h-5" />
          <span>Back to Home</span>
        </button>
      </motion.div>
    </div>
  )
}

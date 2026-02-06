import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useNavigate, useParams } from "react-router-dom"
import Lenis from "lenis"
import { 
  ArrowLeft,
  Star,
  Image as ImageIcon
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import BottomNavbar from "../components/BottomNavbar"
// Mock data removed - using API data only

export default function UpdateReplyPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [replyText, setReplyText] = useState("")
  const [reviewData, setReviewData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [imageError, setImageError] = useState(false)

  // Fetch review data from API
  useEffect(() => {
    const fetchReviewData = async () => {
      if (!id) return
      
      try {
        setLoading(true)
        // TODO: Fetch review data from API
        // Example:
        // const response = await restaurantAPI.getReview(id)
        // const data = response.data
        // setReviewData(data)
        // setReplyText(data.currentReply || "")
      } catch (error) {
        console.error("Error fetching review data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchReviewData()
  }, [id])

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden pb-24 md:pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3">
        <button 
          onClick={() => navigate(-1)}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Update Reply</h1>
      </div>

      {/* Main Content */}
      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-600">Loading review...</p>
          </div>
        ) : reviewData ? (
          <>
            {/* Product Review Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-white shadow-sm border border-gray-100">
                <CardContent className="p-4 space-y-4">
                  {/* Product Details */}
                  <div className="flex items-start gap-3">
                    {/* Product Image */}
                    <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
                      {reviewData.productImage && !imageError ? (
                        <img
                          src={reviewData.productImage}
                          alt={reviewData.productName || "Product"}
                          className="w-full h-full object-cover"
                          onError={() => setImageError(true)}
                        />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-gray-400" />
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-gray-900 mb-2">
                        {reviewData.productName || "Product"}
                      </h3>
                      
                      {/* Rating Stars */}
                      {reviewData.rating && (
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < reviewData.rating
                                  ? "fill-[#ff8100] text-[#ff8100]"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reviewer Name */}
                  {reviewData.reviewerName && (
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {reviewData.reviewerName}
                      </p>
                    </div>
                  )}

                  {/* Review Text */}
                  {reviewData.reviewText && (
                    <div>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {reviewData.reviewText}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Reply Input Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Card className="bg-white shadow-sm border border-gray-100">
                <CardContent className="p-4">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write your reply..."
                    className="w-full min-h-[120px] bg-orange-50 border-orange-200 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#ff8100] focus:border-[#ff8100] resize-none"
                    rows={5}
                  />
                </CardContent>
              </Card>
            </motion.div>
          </>
        ) : (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-600">Review not found.</p>
          </div>
        )}
      </div>

      {/* Update Review Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 z-50 md:relative md:border-t-0 md:px-4 md:py-4 md:mt-6">
        <Button
          onClick={async () => {
            try {
              // TODO: Update reply via API
              // Example:
              // await restaurantAPI.updateReviewReply(id, replyText)
              // Navigate back to reviews list after update
              navigate("/restaurant/reviews")
            } catch (error) {
              console.error("Error updating reply:", error)
              alert("Failed to update reply. Please try again.")
            }
          }}
          disabled={!reviewData || loading}
          className="w-full bg-[#ff8100] hover:bg-[#e67300] text-white font-semibold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Update Review
        </Button>
      </div>

      {/* Bottom Navigation Bar - Hidden on this page to avoid overlap */}
      <div className="hidden md:block">
        <BottomNavbar />
      </div>
    </div>
  )
}


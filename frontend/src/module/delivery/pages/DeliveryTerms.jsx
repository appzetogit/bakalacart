import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2 } from "lucide-react"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"
import { toast } from "sonner"

export default function DeliveryTerms() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [terms, setTerms] = useState({
    title: 'Delivery Boy Terms & Conditions',
    content: ''
  })

  useEffect(() => {
    fetchTerms()
  }, [])

  const fetchTerms = async () => {
    try {
      setLoading(true)
      const endpoint = API_ENDPOINTS.ADMIN.DELIVERY_BOY_TERMS_PUBLIC
      console.log('Fetching delivery boy terms from:', endpoint)
      const response = await api.get(endpoint)
      console.log('Delivery boy terms response:', response?.data)
      if (response?.data?.success) {
        setTerms(response.data.data)
      } else {
        toast.error('Failed to load terms & conditions')
      }
    } catch (error) {
      console.error('Error fetching delivery boy terms:', error)
      console.error('Error response:', error.response?.data)
      toast.error('Failed to load terms & conditions')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center gap-4 px-4 py-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Terms and Conditions</h1>
          </div>
        </div>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-4 px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Terms and Conditions</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{terms.title}</h2>
            <div 
              className="prose prose-sm max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: terms.content || '<p>No terms & conditions content available.</p>' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2 } from "lucide-react"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"
import { toast } from "sonner"

export default function DeliveryAgreement() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [agreement, setAgreement] = useState({
    title: 'Delivery Boy Agreement',
    content: ''
  })

  useEffect(() => {
    fetchAgreement()
  }, [])

  const fetchAgreement = async () => {
    try {
      setLoading(true)
      const response = await api.get(API_ENDPOINTS.ADMIN.DELIVERY_BOY_AGREEMENT_PUBLIC)
      if (response?.data?.success) {
        setAgreement(response.data.data)
      } else {
        toast.error('Failed to load agreement')
      }
    } catch (error) {
      console.error('Error fetching agreement:', error)
      toast.error('Failed to load agreement')
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
            <h1 className="text-xl font-bold text-gray-900">Agreement</h1>
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
          <h1 className="text-xl font-bold text-gray-900">Agreement</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{agreement.title}</h2>
            <div 
              className="prose prose-sm max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: agreement.content || '<p>No agreement content available.</p>' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2 } from "lucide-react"
import api from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/api/config"

export default function TermsAndConditionsPublic() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [termsData, setTermsData] = useState({
    title: 'Terms and Conditions',
    content: '<p>Loading...</p>'
  })

  useEffect(() => {
    fetchTermsData()
  }, [])

  const fetchTermsData = async () => {
    try {
      setLoading(true)
      const response = await api.get(API_ENDPOINTS.ADMIN.TERMS_PUBLIC)
      if (response.data.success) {
        setTermsData(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching terms data:', error)
      setTermsData({
        title: 'Terms and Conditions',
        content: '<p>Unable to load terms and conditions at the moment. Please try again later.</p>'
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-4 sticky top-0 z-50">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Terms and Conditions</h1>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div
          className="prose prose-slate max-w-none
            prose-headings:text-gray-900
            prose-p:text-gray-700
            prose-strong:text-gray-900
            prose-ul:text-gray-700
            prose-ol:text-gray-700
            prose-li:text-gray-700
            prose-a:text-blue-600
            prose-a:no-underline hover:prose-a:underline
            leading-relaxed"
          dangerouslySetInnerHTML={{ __html: termsData.content }}
        />
      </div>
    </div>
  )
}

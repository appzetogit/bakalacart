import { useState } from "react"
import { Edit, Upload, Info, Image as ImageIcon } from "lucide-react"
// Mock data removed - using API data only

export default function PromotionalBanner() {
  const [title, setTitle] = useState("")
  const [bannerImage, setBannerImage] = useState("")
  const [imageError, setImageError] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log("Banner saved:", { title })
    alert("Promotional banner saved successfully!")
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Edit className="w-5 h-5 text-slate-600" />
            <h1 className="text-2xl font-bold text-slate-900">Promotional Banner</h1>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Title Input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter promotional banner title"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>

            {/* Upload Banner Section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-lg font-semibold text-slate-900">Upload Banner</h2>
                <Info className="w-4 h-4 text-slate-400" />
              </div>

              {/* Banner Preview */}
              {bannerImage && (
                <div className="border-2 border-slate-200 rounded-lg overflow-hidden mb-4">
                  <div className="relative w-full" style={{ aspectRatio: "5/1", minHeight: "200px" }}>
                    {bannerImage && !imageError ? (
                      <img
                        src={bannerImage}
                        alt="Banner preview"
                        className="w-full h-full object-cover"
                        onError={() => {
                          setImageError(true)
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
                        <ImageIcon className="w-12 h-12 text-slate-400" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Upload Instructions */}
              <div className="text-sm text-slate-600 space-y-1">
                <p>Min Size for Better Resolution 5:1</p>
                <p>Image format: jpeg, jpg, png, gif, webp | maximum size: 2 MB</p>
              </div>

              {/* Upload Button */}
              <div className="mt-4">
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer">
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-blue-600 mb-1">Click to upload</p>
                  <p className="text-xs text-slate-500">Or drag and drop</p>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

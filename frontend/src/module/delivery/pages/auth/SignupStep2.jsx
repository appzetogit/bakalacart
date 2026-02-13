import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Upload, X, Check, Camera, Plus } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { deliveryAPI } from "@/lib/api"
import apiClient from "@/lib/api/axios"
import { toast } from "sonner"
import { openCameraWithFallback, openGalleryWithFallback } from "@/lib/utils/flutterCamera"

export default function SignupStep2() {
  const navigate = useNavigate()

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  const [documents, setDocuments] = useState({
    profilePhoto: null,
    aadharPhoto: null,
    panPhoto: null,
    drivingLicensePhoto: null
  })
  const [uploadedDocs, setUploadedDocs] = useState({
    profilePhoto: null,
    aadharPhoto: null,
    panPhoto: null,
    drivingLicensePhoto: null
  })
  const [uploading, setUploading] = useState({
    profilePhoto: false,
    aadharPhoto: false,
    panPhoto: false,
    drivingLicensePhoto: false
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showImageSourceMenu, setShowImageSourceMenu] = useState(null) // docType or null
  const cameraInputRefs = useRef({})
  const galleryInputRefs = useRef({})

  const handleFileSelect = async (docType, file) => {
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB")
      return
    }

    setUploading(prev => ({ ...prev, [docType]: true }))

    try {
      // Create FormData for file upload
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'appzeto/delivery/documents')

      // Upload to Cloudinary via backend
      const response = await apiClient.post('/upload/media', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      if (response?.data?.success && response?.data?.data) {
        const { url, publicId } = response.data.data
        
        setDocuments(prev => ({
          ...prev,
          [docType]: file
        }))
        
        setUploadedDocs(prev => ({
          ...prev,
          [docType]: { url, publicId }
        }))

        toast.success(`${docType.replace(/([A-Z])/g, ' $1').trim()} uploaded successfully`)
      }
    } catch (error) {
      console.error(`Error uploading ${docType}:`, error)
      toast.error(`Failed to upload ${docType.replace(/([A-Z])/g, ' $1').trim()}`)
    } finally {
      setUploading(prev => ({ ...prev, [docType]: false }))
    }
  }

  const handleRemove = (docType) => {
    setDocuments(prev => ({
      ...prev,
      [docType]: null
    }))
    setUploadedDocs(prev => ({
      ...prev,
      [docType]: null
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Check if all required documents are uploaded
    if (!uploadedDocs.profilePhoto || !uploadedDocs.aadharPhoto || !uploadedDocs.panPhoto || !uploadedDocs.drivingLicensePhoto) {
      toast.error("Please upload all required documents")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await deliveryAPI.submitSignupDocuments({
        profilePhoto: uploadedDocs.profilePhoto,
        aadharPhoto: uploadedDocs.aadharPhoto,
        panPhoto: uploadedDocs.panPhoto,
        drivingLicensePhoto: uploadedDocs.drivingLicensePhoto
      })

      if (response?.data?.success) {
        toast.success("Signup completed successfully!")
        // Redirect to delivery home page
        setTimeout(() => {
          navigate("/delivery", { replace: true })
        }, 1000)
      }
    } catch (error) {
      console.error("Error submitting documents:", error)
      const message = error?.response?.data?.message || "Failed to submit documents. Please try again."
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const DocumentUpload = ({ docType, label, required = true }) => {
    const file = documents[docType]
    const uploaded = uploadedDocs[docType]
    const isUploading = uploading[docType]

    // Initialize refs if not exists
    if (!cameraInputRefs.current[docType]) {
      cameraInputRefs.current[docType] = { current: null }
    }
    if (!galleryInputRefs.current[docType]) {
      galleryInputRefs.current[docType] = { current: null }
    }

    return (
      <div className="bg-white rounded-lg p-3 border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        
        {uploaded ? (
          <div className="relative">
            <img
              src={uploaded.url}
              alt={label}
              className="w-full h-32 object-cover rounded-lg"
            />
            <button
              type="button"
              onClick={() => handleRemove(docType)}
              className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 left-2 bg-green-500 text-white px-3 py-1 rounded-full flex items-center gap-1 text-sm">
              <Check className="w-4 h-4" />
              <span>Uploaded</span>
            </div>
          </div>
        ) : (
          <>
            <input
              ref={cameraInputRefs.current[docType]}
              type="file"
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const selectedFile = e.target.files[0]
                if (selectedFile) {
                  handleFileSelect(docType, selectedFile)
                  e.target.value = ""
                }
              }}
              disabled={isUploading}
              id={`camera-${docType}`}
            />
            <input
              ref={galleryInputRefs.current[docType]}
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => {
                const selectedFile = e.target.files[0]
                if (selectedFile) {
                  handleFileSelect(docType, selectedFile)
                  e.target.value = ""
                }
              }}
              disabled={isUploading}
              id={`gallery-${docType}`}
            />
            <button
              type="button"
              onClick={async () => {
                // Try Flutter camera first
                const file = await openCameraWithFallback(
                  { source: 'camera', accept: 'image/*', multiple: false, quality: 0.8 },
                  () => {
                    // Fallback: show menu on mobile, direct on desktop
                    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                      setShowImageSourceMenu(docType)
                    } else {
                      galleryInputRefs.current[docType].current?.click()
                    }
                  }
                )
                
                // If Flutter camera returned a file, process it
                if (file) {
                  handleFileSelect(docType, file)
                }
              }}
              disabled={isUploading}
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-500 transition-colors disabled:opacity-50"
            >
              <div className="flex flex-col items-center justify-center pt-3 pb-3">
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mb-2"></div>
                    <p className="text-sm text-gray-500">Uploading...</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 mb-1">Click to upload</p>
                    <p className="text-xs text-gray-400">PNG, JPG up to 5MB</p>
                  </>
                )}
              </div>
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-4 border-b border-gray-200">
        <button
          onClick={() => navigate("/delivery/signup/details")}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-medium">Upload Documents</h1>
      </div>

      {/* Content */}
      <div className="px-4 pt-3 pb-6">
        <div className="mb-3">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Document Verification</h2>
          <p className="text-sm text-gray-600">Please upload clear photos of your documents</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <DocumentUpload docType="profilePhoto" label="Profile Photo" required={true} />
          <DocumentUpload docType="aadharPhoto" label="Aadhar Card Photo" required={true} />
          <DocumentUpload docType="panPhoto" label="PAN Card Photo" required={true} />
          <DocumentUpload docType="drivingLicensePhoto" label="Driving License Photo" required={true} />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !uploadedDocs.profilePhoto || !uploadedDocs.aadharPhoto || !uploadedDocs.panPhoto || !uploadedDocs.drivingLicensePhoto}
            className={`w-full py-4 rounded-lg font-bold text-white text-base transition-colors mt-6 ${
              isSubmitting || !uploadedDocs.profilePhoto || !uploadedDocs.aadharPhoto || !uploadedDocs.panPhoto || !uploadedDocs.drivingLicensePhoto
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#00B761] hover:bg-[#00A055]"
            }`}
          >
            {isSubmitting ? "Submitting..." : "Complete Signup"}
          </button>
        </form>
      </div>
      
      {/* Image Source Menu Modal - Mobile only */}
      <AnimatePresence>
        {showImageSourceMenu && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 z-[9999]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImageSourceMenu(null)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[10000] shadow-2xl"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="p-4">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                  Select Image Source
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={async () => {
                      const docType = showImageSourceMenu
                      setShowImageSourceMenu(null)
                      
                      // Try Flutter camera first
                      const file = await openCameraWithFallback(
                        { source: 'camera', accept: 'image/*', multiple: false, quality: 0.8 },
                        () => {
                          setTimeout(() => {
                            cameraInputRefs.current[docType]?.current?.click()
                          }, 300)
                        }
                      )
                      
                      // If Flutter camera returned a file, process it
                      if (file) {
                        handleFileSelect(docType, file)
                      }
                    }}
                    className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <Camera className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-900">Camera</p>
                      <p className="text-sm text-gray-500">Take a new photo</p>
                    </div>
                  </button>
                  <button
                    onClick={async () => {
                      const docType = showImageSourceMenu
                      setShowImageSourceMenu(null)
                      
                      // Try Flutter gallery first
                      const file = await openGalleryWithFallback(
                        { accept: 'image/*', multiple: false },
                        () => {
                          setTimeout(() => {
                            galleryInputRefs.current[docType]?.current?.click()
                          }, 300)
                        }
                      )
                      
                      // If Flutter gallery returned a file, process it
                      if (file) {
                        handleFileSelect(docType, file)
                      }
                    }}
                    className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Plus className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-900">Gallery</p>
                      <p className="text-sm text-gray-500">Choose from existing photos</p>
                    </div>
                  </button>
                </div>
                <button
                  onClick={() => setShowImageSourceMenu(null)}
                  className="w-full mt-4 py-3 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}


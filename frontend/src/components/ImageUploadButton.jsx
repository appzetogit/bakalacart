import { useRef, useState } from "react"
import { Camera, Image as ImageIcon, Upload, X } from "lucide-react"
import { openCameraWithFallback, openGalleryWithFallback, isFlutterAvailable } from "@/lib/utils/flutterCamera"
import { toast } from "sonner"

/**
 * Reusable Image Upload Button Component
 * Always shows Camera and Gallery options
 * Works on both mobile and desktop
 * 
 * @param {Object} props
 * @param {Function} props.onFileSelect - Callback when file is selected (receives File object)
 * @param {boolean} props.multiple - Allow multiple file selection (default: false)
 * @param {string} props.accept - File types to accept (default: 'image/*')
 * @param {number} props.maxSize - Max file size in bytes (default: 5MB)
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.disabled - Disable the button
 * @param {React.ReactNode} props.children - Custom button content
 * @param {string} props.label - Button label text
 */
export default function ImageUploadButton({
  onFileSelect,
  multiple = false,
  accept = 'image/*',
  maxSize = 5 * 1024 * 1024, // 5MB default
  className = '',
  disabled = false,
  children,
  label = 'Upload Image'
}) {
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const [showSourceMenu, setShowSourceMenu] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Validate and process file
  const processFile = async (file) => {
    if (!file) return null

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file')
      return null
    }

    // Validate file size
    if (file.size > maxSize) {
      toast.error(`Image size should be less than ${(maxSize / 1024 / 1024).toFixed(0)}MB`)
      return null
    }

    return file
  }

  // Handle file selection from input
  const handleFileInputChange = async (e, source) => {
    const files = e.target.files
    if (!files || files.length === 0) {
      e.target.value = '' // Reset input
      return
    }

    setIsProcessing(true)
    try {
      if (multiple) {
        // Process multiple files
        const fileArray = Array.from(files)
        const validFiles = []

        for (const file of fileArray) {
          const processed = await processFile(file)
          if (processed) {
            validFiles.push(processed)
          }
        }

        if (validFiles.length > 0) {
          onFileSelect(multiple ? validFiles : validFiles[0])
        }
      } else {
        // Process single file
        const processed = await processFile(files[0])
        if (processed) {
          onFileSelect(processed)
        }
      }
    } catch (error) {
      console.error('Error processing file:', error)
      toast.error('Failed to process image')
    } finally {
      setIsProcessing(false)
      e.target.value = '' // Reset input
    }
  }

  // Handle camera selection
  const handleCameraClick = async () => {
    setShowSourceMenu(false)

    // CRITICAL: When Flutter is not available, trigger file input synchronously
    // to preserve the user gesture (browsers block programmatic file input after async)
    if (!isFlutterAvailable()) {
      cameraInputRef.current?.click()
      return
    }

    try {
      setIsProcessing(true)

      const file = await openCameraWithFallback(
        { source: 'camera', accept, multiple, quality: 0.8 },
        () => {
          if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            setShowSourceMenu(true)
          } else {
            cameraInputRef.current?.click()
          }
        }
      )

      if (file) {
        const processed = await processFile(file)
        if (processed) {
          onFileSelect(processed)
        }
      } else if (cameraInputRef.current) {
        cameraInputRef.current.click()
      }
    } catch (error) {
      console.error('Error opening camera:', error)
      toast.error('Failed to open camera')
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle gallery selection
  const handleGalleryClick = async () => {
    setShowSourceMenu(false)

    // CRITICAL: When Flutter is not available, trigger file input synchronously
    // to preserve the user gesture (browsers block programmatic file input after async)
    if (!isFlutterAvailable()) {
      galleryInputRef.current?.click()
      return
    }

    try {
      setIsProcessing(true)

      const files = await openGalleryWithFallback(
        { accept, multiple, quality: 1.0 },
        () => galleryInputRef.current?.click()
      )

      if (files) {
        if (multiple && Array.isArray(files)) {
          const validFiles = []
          for (const file of files) {
            const processed = await processFile(file)
            if (processed) {
              validFiles.push(processed)
            }
          }
          if (validFiles.length > 0) {
            onFileSelect(validFiles)
          }
        } else {
          const processed = await processFile(files)
          if (processed) {
            onFileSelect(processed)
          }
        }
      } else if (galleryInputRef.current) {
        galleryInputRef.current.click()
      }
    } catch (error) {
      console.error('Error opening gallery:', error)
      toast.error('Failed to open gallery')
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle main button click - show menu on mobile, direct on desktop
  const handleMainClick = () => {
    if (disabled || isProcessing) return

    // On mobile, always show menu with camera and gallery options
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      setShowSourceMenu(true)
    } else {
      // On desktop, show menu as well for consistency
      setShowSourceMenu(true)
    }
  }

  return (
    <div className="relative">
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept={accept}
        capture="environment"
        multiple={multiple}
        onChange={(e) => handleFileInputChange(e, 'camera')}
        className="hidden"
        id="camera-upload-input"
        disabled={disabled || isProcessing}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => handleFileInputChange(e, 'gallery')}
        className="hidden"
        id="gallery-upload-input"
        disabled={disabled || isProcessing}
      />

      {/* Main upload button */}
      <button
        type="button"
        onClick={handleMainClick}
        disabled={disabled || isProcessing}
        className={`${className} ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {children || (
          <div className="flex items-center justify-center gap-2">
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>{label}</span>
              </>
            )}
          </div>
        )}
      </button>

      {/* Source selection menu */}
      {showSourceMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowSourceMenu(false)}
          />

          {/* Menu */}
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 p-4 animate-in slide-in-from-bottom">
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
              Select Image Source
            </h3>

            <div className="space-y-3">
              {/* Camera option */}
              <button
                type="button"
                onClick={handleCameraClick}
                disabled={disabled || isProcessing}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-gray-900">Take Photo</p>
                  <p className="text-sm text-gray-500">Use camera to capture image</p>
                </div>
              </button>

              {/* Gallery option */}
              <button
                type="button"
                onClick={handleGalleryClick}
                disabled={disabled || isProcessing}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-gray-900">Choose from Gallery</p>
                  <p className="text-sm text-gray-500">Select image from your gallery</p>
                </div>
              </button>

              {/* Cancel button */}
              <button
                type="button"
                onClick={() => setShowSourceMenu(false)}
                className="w-full p-4 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors mt-2"
              >
                <p className="font-semibold text-gray-900">Cancel</p>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

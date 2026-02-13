/**
 * Flutter Camera Integration Utility
 * 
 * This utility handles camera integration with Flutter InAppWebView.
 * It converts base64 images from Flutter to JavaScript File objects.
 * 
 * Flutter Handler Requirements:
 * - Handler name: 'openCamera'
 * - Expected response format:
 *   {
 *     success: true,
 *     base64: string,        // Base64 encoded image
 *     mimeType: string,       // MIME type (e.g., 'image/jpeg', 'image/png')
 *     fileName: string        // File name (e.g., 'image.jpg')
 *   }
 * 
 * If user cancels:
 *   { success: false } or null
 */

/**
 * Check if Flutter InAppWebView handler is available
 */
export const isFlutterAvailable = () => {
  return (
    typeof window !== 'undefined' &&
    window.flutter_inappwebview &&
    typeof window.flutter_inappwebview.callHandler === 'function'
  )
}

/**
 * Convert base64 string to File object
 * @param {string} base64 - Base64 encoded image string
 * @param {string} mimeType - MIME type (default: 'image/jpeg')
 * @param {string} fileName - File name (default: 'image.jpg')
 * @returns {File} - JavaScript File object
 */
export const base64ToFile = (base64, mimeType = 'image/jpeg', fileName = 'image.jpg') => {
  try {
    // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
    let base64Data = base64
    if (base64Data.includes(',')) {
      base64Data = base64Data.split(',')[1]
    }

    // Decode base64 to binary
    const byteCharacters = atob(base64Data)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)

    // Create Blob and File
    const blob = new Blob([byteArray], { type: mimeType })
    const file = new File([blob], fileName, { type: mimeType })

    return file
  } catch (error) {
    console.error('❌ Error converting base64 to File:', error)
    throw new Error('Failed to convert base64 image to file')
  }
}

/**
 * Open camera using Flutter handler
 * @param {Object} options - Camera options
 * @param {string} options.source - 'camera' for camera, 'gallery' for file picker
 * @param {string} options.accept - File types to accept (default: 'image/*')
 * @param {boolean} options.multiple - Allow multiple files (default: false)
 * @param {number} options.quality - Image quality 0.0 to 1.0 (default: 0.8)
 * @returns {Promise<File|null>} - File object or null if cancelled/failed
 */
export const openFlutterCamera = async (options = {}) => {
  const {
    source = 'camera',
    accept = 'image/*',
    multiple = false,
    quality = 0.8
  } = options

  try {
    // Check if Flutter handler is available
    if (!isFlutterAvailable()) {
      console.log('📸 Flutter handler not available')
      return null
    }

    console.log('📸 Using Flutter InAppWebView camera handler')

    // Call Flutter handler to open camera
    const result = await window.flutter_inappwebview.callHandler('openCamera', {
      source,
      accept,
      multiple,
      quality
    })

    console.log('📸 Flutter handler response:', result)

    if (!result || !result.success) {
      console.log('ℹ️ Camera cancelled by user or failed')
      return null
    }

    // Handle the result - convert base64 to File
    let file = null

    if (result.file) {
      // If Flutter returns a File object directly (preferred method)
      file = result.file
      console.log('✅ Received File object from Flutter')
    } else if (result.base64) {
      // If Flutter returns base64, convert to File
      console.log('📸 Converting base64 to File object')
      const mimeType = result.mimeType || 'image/jpeg'
      const fileName = result.fileName || `image-${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`
      file = base64ToFile(result.base64, mimeType, fileName)
      console.log('✅ Converted base64 to File:', { name: file.name, size: file.size, type: file.type })
    } else {
      console.error('❌ No file data in Flutter response:', result)
      return null
    }

    return file
  } catch (error) {
    console.error('❌ Error opening Flutter camera:', error)
    return null
  }
}

/**
 * Open gallery using Flutter handler
 * @param {Object} options - Gallery options
 * @param {string} options.accept - File types to accept (default: 'image/*')
 * @param {boolean} options.multiple - Allow multiple files (default: false)
 * @returns {Promise<File|File[]|null>} - File object(s) or null if cancelled/failed
 */
export const openFlutterGallery = async (options = {}) => {
  const {
    accept = 'image/*',
    multiple = false
  } = options

  try {
    // Check if Flutter handler is available
    if (!isFlutterAvailable()) {
      console.log('📸 Flutter handler not available for gallery')
      return null
    }

    console.log('📸 Using Flutter InAppWebView gallery handler')

    // Call Flutter handler to open gallery
    const result = await window.flutter_inappwebview.callHandler('openCamera', {
      source: 'gallery',
      accept,
      multiple,
      quality: 1.0 // Full quality for gallery images
    })

    console.log('📸 Flutter gallery handler response:', result)

    if (!result || !result.success) {
      console.log('ℹ️ Gallery selection cancelled by user or failed')
      return null
    }

    // Handle the result - convert base64 to File
    if (multiple && Array.isArray(result.files)) {
      // Multiple files
      const files = result.files.map((fileData, index) => {
        if (fileData.file) {
          return fileData.file
        } else if (fileData.base64) {
          const mimeType = fileData.mimeType || 'image/jpeg'
          const fileName = fileData.fileName || `image-${Date.now()}-${index}.${mimeType.split('/')[1] || 'jpg'}`
          return base64ToFile(fileData.base64, mimeType, fileName)
        }
        return null
      }).filter(Boolean)
      return files.length > 0 ? files : null
    } else {
      // Single file
      let file = null
      if (result.file) {
        file = result.file
        console.log('✅ Received File object from Flutter gallery')
      } else if (result.base64) {
        console.log('📸 Converting base64 to File object from gallery')
        const mimeType = result.mimeType || 'image/jpeg'
        const fileName = result.fileName || `image-${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`
        file = base64ToFile(result.base64, mimeType, fileName)
        console.log('✅ Converted base64 to File:', { name: file.name, size: file.size, type: file.type })
      } else {
        console.error('❌ No file data in Flutter gallery response:', result)
        return null
      }
      return file
    }
  } catch (error) {
    console.error('❌ Error opening Flutter gallery:', error)
    return null
  }
}

/**
 * Open camera with fallback to file input
 * @param {Object} options - Camera options
 * @param {Function} fallbackCallback - Callback to trigger file input click
 * @returns {Promise<File|null>} - File object or null if cancelled/failed
 */
export const openCameraWithFallback = async (options = {}, fallbackCallback = null) => {
  const file = await openFlutterCamera(options)

  if (file) {
    return file
  }

  // Fallback to standard file input if Flutter is not available or user cancelled
  if (fallbackCallback && typeof fallbackCallback === 'function') {
    console.log('📸 Falling back to standard file input')
    fallbackCallback()
  }

  return null
}

/**
 * Open gallery with fallback to file input
 * @param {Object} options - Gallery options
 * @param {Function} fallbackCallback - Callback to trigger file input click
 * @returns {Promise<File|File[]|null>} - File object(s) or null if cancelled/failed
 */
export const openGalleryWithFallback = async (options = {}, fallbackCallback = null) => {
  const file = await openFlutterGallery(options)

  if (file) {
    return file
  }

  // Fallback to standard file input if Flutter is not available or user cancelled
  if (fallbackCallback && typeof fallbackCallback === 'function') {
    console.log('📸 Falling back to standard file input for gallery')
    fallbackCallback()
  }

  return null
}

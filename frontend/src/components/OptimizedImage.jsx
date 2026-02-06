import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

/**
 * OptimizedImage Component
 * 
 * Features:
 * - Lazy loading with Intersection Observer
 * - Responsive srcset for different screen sizes
 * - WebP/AVIF format support with fallback
 * - Blur placeholder (LQIP) for smooth loading
 * - Preloading for critical images
 * - Proper decoding and fetchpriority
 * - Error handling with fallback
 */
const OptimizedImage = ({
  src,
  alt = '', // Default to empty string for decorative images
  className = '',
  priority = false, // For above-the-fold images
  sizes = '100vw',
  objectFit = 'cover',
  placeholder = 'blur',
  blurDataURL,
  onLoad,
  onError,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isInView, setIsInView] = useState(priority) // Start visible if priority
  const imgRef = useRef(null)
  const observerRef = useRef(null)

  // Check if image URL supports optimization (external URLs or Vite-processed imports)
  const supportsOptimization = (imageSrc) => {
    if (!imageSrc || typeof imageSrc !== 'string' || imageSrc === '') return false
    if (imageSrc.startsWith('data:')) return false
    // Vite-processed imports start with / and have hash, or are external URLs
    // Local images imported via Vite can be optimized if they're in the public folder
    if (imageSrc.startsWith('/src/assets/') || imageSrc.startsWith('/assets/')) {
      // These are Vite-processed imports, can use responsive images
      return true
    }
    // Check if it's an external URL (http/https)
    return /^https?:\/\//.test(imageSrc)
  }

  // Check if URL is Cloudinary
  const isCloudinary = (imageSrc) => {
    return imageSrc && imageSrc.includes('cloudinary.com')
  }

  // Optimize Cloudinary URL with proper transformations
  const optimizeCloudinaryUrl = (url, width, quality = 'auto') => {
    if (!isCloudinary(url)) return url
    
    try {
      // Check if URL already has transformations (contains /w_, /h_, /c_, etc.)
      // If it does, return as-is to avoid breaking existing transformations
      if (url.includes('/w_') || url.includes('/h_') || url.includes('/c_') || url.includes('/q_')) {
        // URL already has transformations, return as-is
        return url
      }
      
      // Parse Cloudinary URL structure: 
      // https://res.cloudinary.com/account/image/upload/v123/path.png?w=800&q=80
      // or: https://res.cloudinary.com/account/image/upload/v123/path.png
      
      const urlParts = url.split('/image/upload/')
      if (urlParts.length !== 2) return url
      
      const baseUrl = urlParts[0] + '/image/upload/'
      const afterUpload = urlParts[1]
      
      // Remove query params to get clean path
      const pathWithVersion = afterUpload.split('?')[0]
      
      // Split version and actual path
      // Format: v123/path/to/image.png or path/to/image.png
      const pathSegments = pathWithVersion.split('/')
      const hasVersion = pathSegments[0]?.startsWith('v')
      
      // Extract version if present
      const version = hasVersion ? pathSegments[0] : null
      const imagePath = hasVersion ? pathSegments.slice(1).join('/') : pathWithVersion
      
      // Build optimized URL with Cloudinary transformations
      // f_auto: auto format (WebP/AVIF when supported by browser)
      // q_auto: auto quality (Cloudinary optimizes based on image content)
      // w_*: width (responsive)
      // c_limit: limit dimensions to maintain aspect ratio
      // fl_progressive: progressive JPEG (for JPEGs, reduces perceived load time)
      const transformations = [
        `w_${width}`,
        `q_${quality}`,
        'f_auto',
        'c_limit',
        'fl_progressive'
      ].join(',')
      
      // Reconstruct URL: baseUrl + (version/) + transformations + / + imagePath
      if (version) {
        return `${baseUrl}${version}/${transformations}/${imagePath}`
      } else {
        return `${baseUrl}${transformations}/${imagePath}`
      }
    } catch (error) {
      // If parsing fails, return original URL
      console.warn('Failed to optimize Cloudinary URL:', error)
      return url
    }
  }

  // Generate responsive srcset with optimized URLs
  const generateSrcSet = (imageSrc) => {
    if (!supportsOptimization(imageSrc)) return undefined

    // For local images, use smaller sizes based on typical display dimensions
    // Local images are typically icons/small images, so use smaller breakpoints
    const localImageSizes = [80, 112, 150, 200]
    const cloudinarySizes = [320, 480, 640, 800, 1024, 1280, 1600]
    
    if (isCloudinary(imageSrc)) {
      // Use Cloudinary transformations for better optimization
      return cloudinarySizes
        .map(size => `${optimizeCloudinaryUrl(imageSrc, size, 'auto')} ${size}w`)
        .join(', ')
    }
    
    // For local images (Vite-processed), we can't transform them at runtime
    // But we can still provide srcset for responsive loading
    // Vite will handle the actual image optimization during build
    if (imageSrc.startsWith('/src/assets/') || imageSrc.startsWith('/assets/')) {
      // For local images, return undefined to use single src
      // The browser will still benefit from proper sizes attribute
      return undefined
    }
    
    // Fallback for other CDNs
    return cloudinarySizes
      .map(size => `${imageSrc}?w=${size}&q=75 ${size}w`)
      .join(', ')
  }

  // Generate WebP/AVIF srcset (Cloudinary handles this automatically with f_auto)
  const generateWebPSrcSet = (imageSrc) => {
    if (!supportsOptimization(imageSrc)) return undefined
    
    const sizes = [320, 480, 640, 800, 1024, 1280, 1600]
    
    if (isCloudinary(imageSrc)) {
      // Cloudinary f_auto already serves WebP/AVIF, so use same URLs
      return generateSrcSet(imageSrc)
    }
    
    // For non-Cloudinary URLs, try to add format parameter
    return sizes
      .map(size => `${imageSrc}?w=${size}&q=75&format=webp ${size}w`)
      .join(', ')
  }

  // Get optimized source URL
  const getOptimizedSrc = (imageSrc) => {
    if (isCloudinary(imageSrc)) {
      // For category images (small circular), use smaller width
      // Check if this is a category image based on sizes prop
      const isCategoryImage = sizes && (sizes.includes('56px') || sizes.includes('80px') || sizes.includes('96px') || sizes.includes('112px'))
      
      // For category images, use simpler optimization or return original if it already has transformations
      if (isCategoryImage) {
        // If URL already has transformations, return as-is
        if (imageSrc.includes('/w_') || imageSrc.includes('/h_') || imageSrc.includes('/c_') || imageSrc.includes('/q_')) {
          return imageSrc
        }
        // For category images, use smaller width (200px) with fill crop for circular images
        return optimizeCloudinaryUrl(imageSrc, 200, 'auto')
      }
      
      const width = 800
      return optimizeCloudinaryUrl(imageSrc, width, 'auto')
    }
    return imageSrc
  }

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || isInView) return

    if (!imgRef.current) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            if (observerRef.current && imgRef.current) {
              observerRef.current.unobserve(imgRef.current)
            }
          }
        })
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.01
      }
    )

    observerRef.current.observe(imgRef.current)

    return () => {
      if (observerRef.current && imgRef.current) {
        observerRef.current.unobserve(imgRef.current)
      }
    }
  }, [priority, isInView])

  // Preload critical images
  useEffect(() => {
    if (priority && src && !src.startsWith('data:')) {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = src
      link.fetchPriority = 'high'
      document.head.appendChild(link)

      return () => {
        document.head.removeChild(link)
      }
    }
  }, [priority, src])

  const handleLoad = (e) => {
    setIsLoaded(true)
    if (onLoad) onLoad(e)
  }

  const handleError = (e) => {
    // If the image failed to load and it's a Cloudinary URL that was optimized,
    // try loading the original URL without optimizations
    if (src && isCloudinary(src) && e.target.src !== src && !hasError) {
      // Try original URL without optimizations
      const originalUrl = src
      e.target.src = originalUrl
      // Reset error state to allow retry
      setHasError(false)
      return // Don't set error state yet, try original URL first
    }
    
    // If we've already tried the original URL or it's not Cloudinary, show error
    // Silently handle error - component already shows fallback UI
    setHasError(true)
    if (onError) onError(e)
  }

  // Default blur placeholder (tiny gray square)
  const defaultBlurDataURL = blurDataURL || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2U1ZTdlYiIvPjwvc3ZnPg=='

  // Don't render if src is empty or null
  // But allow 'https://via.placeholder.com/40' as it's a valid placeholder
  if (!src || (typeof src === 'string' && src.trim() === '')) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <span className="text-xs text-gray-400 dark:text-gray-600">Image unavailable</span>
        </div>
      </div>
    )
  }

  const imageSrc = hasError ? 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23e5e7eb" width="400" height="300"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle"%3EImage not found%3C/text%3E%3C/svg%3E' : src

  return (
    <div className={`relative overflow-hidden ${className}`} ref={imgRef}>
      {/* Blur Placeholder */}
      {placeholder === 'blur' && !isLoaded && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 1 }}
          animate={{ opacity: isLoaded ? 0 : 1 }}
          transition={{ duration: 0.3 }}
          style={{
            backgroundImage: `url(${defaultBlurDataURL})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
          }}
        />
      )}

      {/* Loading Skeleton */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-pulse" />
      )}

      {/* Actual Image */}
      {isInView && (
        <picture className="absolute inset-0 w-full h-full">
          {/* WebP source for modern browsers */}
          {generateWebPSrcSet(imageSrc) && (
            <source
              srcSet={generateWebPSrcSet(imageSrc)}
              sizes={sizes}
              type="image/webp"
            />
          )}
          
          {/* Fallback to original format */}
          <motion.img
            src={getOptimizedSrc(imageSrc)}
            srcSet={generateSrcSet(imageSrc)}
            sizes={supportsOptimization(imageSrc) ? sizes : undefined}
            alt={alt}
            className={`w-full h-full ${objectFit === 'cover' ? 'object-cover' : objectFit === 'contain' ? 'object-contain' : ''} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            onLoad={handleLoad}
            onError={handleError}
            crossOrigin="anonymous"
            width={objectFit === 'contain' && imageSrc.startsWith('/src/assets/') ? '112' : undefined}
            height={objectFit === 'contain' && imageSrc.startsWith('/src/assets/') ? '112' : undefined}
            {...props}
          />
        </picture>
      )}

      {/* Error State - Show fallback image instead of "Image unavailable" */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          {/* Try to show a fallback emoji or icon instead of text */}
          <div className="w-full h-full flex items-center justify-center text-4xl">
            🍽️
          </div>
        </div>
      )}
    </div>
  )
}

export default OptimizedImage


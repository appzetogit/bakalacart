import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Robust Image URL normalization and fixing
 * Handles absolute URLs, Cloudinary paths, and backend-relative paths
 */
export function getResilientImageUrl(url: string | null | undefined, apiBaseUrl?: string): string {
  if (!url || typeof url !== 'string') return "/bakalalogo.png"
  const trimmed = url.trim()
  if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return "/bakalalogo.png"

  // 1. If absolute URL, return as-is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('//')) {
    return trimmed
  }

  // 2. If it's a Cloudinary path but missing domain
  if (trimmed.includes('cloudinary.com')) {
    return trimmed.startsWith('http') ? trimmed : `https:${trimmed.startsWith('//') ? '' : '//'}${trimmed}`
  }

  // 3. Handle relative paths from backend
  if (trimmed.startsWith('/') || trimmed.startsWith('uploads/') || trimmed.startsWith('hero-banners/') || trimmed.startsWith('categories/')) {
    // DO NOT prepend backend URL for local Vite assets
    if (trimmed.startsWith('/src/') || trimmed.startsWith('/assets/') || trimmed.startsWith('/@fs/')) {
      return trimmed
    }

    // If apiBaseUrl is not provided, use a smart guess or placeholder
    const base = apiBaseUrl || (typeof window !== 'undefined' ? (window as any).VITE_API_BASE_URL : 'http://localhost:5000/api')
    const backendUrl = String(base).replace('/api', '')
    const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
    return `${backendUrl}${path}`
  }

  // 4. Fallback for Cloudinary relative paths (common in some DB setups)
  if (trimmed.length > 10 && !trimmed.includes('.') && !trimmed.includes('/')) {
    return "/bakalalogo.png"
  }

  return trimmed
}

/**
 * Optimize Cloudinary URL for responsive delivery (WebP/AVIF, proper dimensions)
 * Use for hero banners, restaurant images, etc. to reduce payload and improve LCP
 */
export function optimizeCloudinaryUrl(url: string | null | undefined, width: number, quality: string = 'auto'): string {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return url || ''
  try {
    if (url.includes('/w_') || url.includes('/h_') || url.includes('/c_') || url.includes('/q_')) return url
    const urlParts = url.split('/image/upload/')
    if (urlParts.length !== 2) return url
    const baseUrl = urlParts[0] + '/image/upload/'
    const afterUpload = urlParts[1]
    const pathWithVersion = afterUpload.split('?')[0]
    const pathSegments = pathWithVersion.split('/')
    const hasVersion = pathSegments[0]?.startsWith('v')
    const version = hasVersion ? pathSegments[0] : null
    const imagePath = hasVersion ? pathSegments.slice(1).join('/') : pathWithVersion
    const transformations = [`w_${width}`, `q_${quality}`, 'f_auto', 'c_limit', 'fl_progressive'].join(',')
    return version ? `${baseUrl}${transformations}/${version}/${imagePath}` : `${baseUrl}${transformations}/${imagePath}`
  } catch {
    return url
  }
}

/**
 * Filter and normalize images array
 */
export function normalizeImages(imgArray: any[] | any, apiBaseUrl?: string): string[] {
  if (!imgArray) return []
  const rawArray = Array.isArray(imgArray) ? imgArray : [imgArray]

  const result = rawArray
    .map(img => {
      if (typeof img === 'string') return getResilientImageUrl(img, apiBaseUrl)
      if (img && typeof img === 'object') {
        const url = img.url || img.secure_url || img.imageUrl || img.image || img.src
        return getResilientImageUrl(url, apiBaseUrl)
      }
      return null
    })
    .filter((u): u is string => !!u && u !== "/bakalalogo.png")

  return result.length > 0 ? result : ["https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop"]
}

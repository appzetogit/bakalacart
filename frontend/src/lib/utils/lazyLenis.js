/**
 * Lazy load Lenis smooth scroll library
 * Only loads when actually needed to reduce initial bundle size
 * This module should never be imported at the top level - only via dynamic import()
 */

let lenisInstance = null
let lenisPromise = null
let rafId = null

export async function initLenis(options = {}) {
  // If already initialized, return existing instance
  if (lenisInstance) {
    return lenisInstance
  }

  // If already loading, return the promise
  if (lenisPromise) {
    return lenisPromise
  }

  // Lazy load Lenis - only import when this function is called
  lenisPromise = import('lenis').then((LenisModule) => {
    // Handle both default and named exports
    const Lenis = LenisModule.default || LenisModule
    
    const defaultOptions = {
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      smoothTouch: true,
      ...options,
    }

    lenisInstance = new Lenis(defaultOptions)

    // Setup RAF loop
    function raf(time) {
      if (lenisInstance) {
        lenisInstance.raf(time)
        rafId = requestAnimationFrame(raf)
      }
    }
    rafId = requestAnimationFrame(raf)

    return lenisInstance
  }).catch((error) => {
    // Reset promise on error so it can be retried
    lenisPromise = null
    console.warn('Failed to load Lenis:', error)
    throw error
  })

  return lenisPromise
}

export function destroyLenis() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  if (lenisInstance) {
    lenisInstance.destroy()
    lenisInstance = null
    lenisPromise = null
  }
}

export function getLenis() {
  return lenisInstance
}

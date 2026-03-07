// CSS-only AnimatedPage - no GSAP dependency
// CRITICAL: No animation on initial render to prevent any blink
import { useRef } from "react"

export default function AnimatedPage({ children, className = "" }) {
  const containerRef = useRef(null)

  // CRITICAL: No useEffect, no animation, no opacity changes
  // This ensures zero blink on initial render
  // Component renders immediately with full opacity

  return (
    <div ref={containerRef} className={`${className}  md:pb-0`} style={{ opacity: 1, transform: 'translateY(0)' }}>
      {children}
    </div>
  )
}

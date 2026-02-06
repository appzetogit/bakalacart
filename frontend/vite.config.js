import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      // CRITICAL FIX: Ensure React is properly transformed and initialized
      jsxRuntime: 'automatic',
      // Ensure React is imported correctly to prevent initialization errors
      jsxImportSource: 'react',
      // Fast refresh for development
      fastRefresh: true,
    }), 
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Provide browser-compatible implementations for Node.js modules used by axios
      'stream': 'stream-browserify',
      'util': 'util',
      'buffer': 'buffer',
      'process': 'process/browser',
      'events': 'events', // Required for axios EventEmitter
    },
    dedupe: ['react', 'react-dom'],
    // Better module resolution to prevent initialization issues
    preserveSymlinks: false,
    // Ensure consistent module resolution
    mainFields: ['module', 'jsnext:main', 'jsnext', 'main'],
  },
  // Define Node.js globals for browser compatibility
  define: {
    'process.env': {},
    'process': '{}',
    'global': 'globalThis',
  },
  optimizeDeps: {
    include: [
      '@emotion/react', 
      '@emotion/styled', 
      '@mui/material', 
      '@mui/x-date-pickers', 
      'mapbox-gl', 
      'react-map-gl',
      // CRITICAL: Pre-bundle React to ensure proper initialization order
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'react-is',
      'scheduler',
    ],
    // Exclude problematic dependencies from pre-bundling if needed
    exclude: [],
    // Force re-optimization when dependencies change
    force: false,
    // Ensure React is properly optimized
    esbuildOptions: {
      target: 'es2020',
    },
  },
  build: {
    // Use esbuild for faster builds, with aggressive minification
    minify: 'esbuild',
    // Remove console.log in production
    esbuild: {
      drop: ['console', 'debugger'],
      legalComments: 'none', // Remove all comments
      minifyIdentifiers: true,
      minifySyntax: true,
      minifyWhitespace: true,
      treeShaking: true,
      // More aggressive minification
      target: 'es2020', // Updated to es2020 for better compatibility
      format: 'esm',
      // Remove unused code more aggressively
      pure: ['console.log', 'console.info', 'console.debug', 'console.warn'],
      // Ensure proper hoisting to prevent initialization issues
      keepNames: false,
    },
    // Better compression
    reportCompressedSize: false, // Faster builds
    // CSS minification
    cssMinify: 'lightningcss',
    // Code splitting configuration - CRITICAL FIX for React initialization errors
    rollupOptions: {
      output: {
        // CRITICAL FIX: Explicitly bundle React in a single chunk that loads first
        // This prevents "Cannot access 'React' before initialization" errors
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // CRITICAL: Bundle ALL React-related packages together in a single chunk
            // This ensures proper initialization order and prevents TDZ errors
            const isReactCore = (
              id.includes('node_modules/react/') || 
              id.includes('node_modules/react-dom/') || 
              id.includes('node_modules/react-router/') ||
              id.includes('node_modules/react-router-dom/') ||
              id.includes('node_modules/react-is/') ||
              id.includes('node_modules/scheduler/') ||
              id.includes('node_modules/object-assign/') ||
              id === 'react' || 
              id === 'react-dom' || 
              id === 'react-router-dom'
            )
            
            // CRITICAL: Put React in a dedicated chunk that loads FIRST
            // This ensures React is fully initialized before any other code uses it
            if (isReactCore) {
              return 'react-vendor' // Single chunk for all React dependencies
            }
            
            // Only split non-React dependencies
            // Radix UI (large, used in many places)
            if (id.includes('@radix-ui')) {
              return 'radix-ui-vendor'
            }
            // MUI (large library, separate chunk)
            if (id.includes('@mui')) {
              return 'mui-vendor'
            }
            // Icon libraries (can be large)
            if (id.includes('lucide-react') || id.includes('@heroicons') || id.includes('@tabler/icons') || id.includes('react-icons')) {
              return 'icons-vendor'
            }
            // Maps libraries (heavy, load on demand)
            if (id.includes('mapbox') || id.includes('google-maps') || id.includes('leaflet') || id.includes('@turf') || id.includes('react-map-gl')) {
              return 'maps-vendor'
            }
            // Animation libraries (can be large)
            if (id.includes('framer-motion') || id.includes('motion')) {
              return 'framer-motion-vendor'
            }
            if (id.includes('gsap')) {
              return 'gsap-vendor'
            }
            if (id.includes('lenis')) {
              return 'lenis-vendor'
            }
            // Chart libraries (only used in admin/reports)
            if (id.includes('recharts')) {
              return 'charts-vendor'
            }
            // PDF/Canvas libraries (only used when generating PDFs)
            if (id.includes('jspdf') || id.includes('html2canvas')) {
              return 'pdf-vendor'
            }
            // Firebase (large, separate chunk)
            if (id.includes('firebase')) {
              return 'firebase-vendor'
            }
            // Socket.io (separate chunk)
            if (id.includes('socket.io')) {
              return 'socket-vendor'
            }
            // Date libraries
            if (id.includes('date-fns') || id.includes('dayjs')) {
              return 'date-vendor'
            }
            // Large utility libraries
            if (id.includes('axios')) {
              return 'axios-vendor'
            }
            // Everything else goes to vendor
            return 'vendor'
          }
          // Split large app modules for better code splitting
          if (id.includes('/module/admin/')) {
            return 'admin-module'
          }
          if (id.includes('/module/restaurant/')) {
            return 'restaurant-module'
          }
          if (id.includes('/module/delivery/')) {
            return 'delivery-module'
          }
          // Return undefined for everything else to use Vite's default chunking
          return undefined
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`
          }
          if (/woff2?|eot|ttf|otf/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`
          }
          return `assets/[name]-[hash][extname]`
        },
        // Ensure proper module format to avoid initialization issues
        format: 'es',
        // Preserve module structure
        preserveModules: false,
        // Better handling of circular dependencies
        interop: 'compat',
        // CRITICAL FIX: Ensure proper chunk ordering - React must load first
        // This ensures dependencies are loaded in the correct order
        generatedCode: {
          constBindings: false, // Use let/var instead of const to avoid TDZ issues
          objectShorthand: true,
        },
        // CRITICAL FIX: Enable hoisting for React to ensure proper initialization order
        hoistTransitiveImports: true, // Hoist React imports to prevent initialization errors
      },
      // External dependencies that should not be bundled (if any)
      external: [],
      // Better handling of circular dependencies
      onwarn(warning, warn) {
        // Suppress circular dependency warnings for known safe cases
        if (warning.code === 'CIRCULAR_DEPENDENCY') {
          // Only warn for critical circular dependencies
          if (warning.message.includes('node_modules')) {
            return
          }
        }
        // Suppress module resolution warnings for React (handled by dedupe)
        if (warning.code === 'UNRESOLVED_IMPORT' && warning.source && warning.source.includes('react')) {
          return
        }
        // Suppress warnings about Node.js modules being externalized (expected for browser build)
        if (warning.code === 'UNRESOLVED_IMPORT' && warning.source && 
            ['http', 'https', 'stream', 'events', 'util', 'fs', 'path', 'crypto', 'zlib', 'url', 'assert', 'os', 'tty', 'child_process'].some(m => warning.source.includes(m))) {
          return
        }
        // Use default warning handler for other warnings
        warn(warning)
      },
      // Plugin to ensure axios uses browser adapter only
      plugins: [
        {
          name: 'axios-browser-only',
          resolveId(id) {
            // Prevent axios from loading Node.js http adapter
            // This forces axios to use the xhr adapter (browser adapter)
            if (id.includes('axios/lib/adapters/http.js')) {
              // Return null to prevent loading, axios will use default xhr adapter
              return false
            }
            return null
          },
        },
      ],
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Enable source maps for production debugging (optional - can disable for smaller builds)
    sourcemap: false,
    // CSS code splitting
    cssCodeSplit: true,
    // Target modern browsers for smaller output
    target: 'es2020', // Updated to es2020 for better compatibility
    // Enable aggressive tree shaking but with safer defaults
    treeshake: {
      moduleSideEffects: (id) => {
        // Preserve side effects for certain modules
        if (id.includes('node_modules')) {
          // CRITICAL: React and React-DOM MUST have side effects preserved
          // This prevents initialization order issues
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router') || id.includes('react-is') || id.includes('scheduler')) {
            return true
          }
          // Some libraries need side effects preserved
          if (id.includes('@radix-ui') || id.includes('@mui') || id.includes('firebase')) {
            return true
          }
        }
        return false
      },
      propertyReadSideEffects: false,
      tryCatchDeoptimization: false,
    },
    // CommonJS options for better compatibility
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
      // Ensure React is properly transformed
      requireReturnsDefault: 'auto',
    },
    // Ensure proper module format
    modulePreload: {
      polyfill: true,
    },
  },
  server: {
    host: '0.0.0.0', // Allow access from network
    port: 5173, // Default Vite port
  },
})

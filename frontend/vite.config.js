import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    nodePolyfills({
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
    // Better module resolution to prevent initialization issues
    preserveSymlinks: false,
    // Ensure consistent module resolution
    mainFields: ['module', 'jsnext:main', 'jsnext', 'main'],
  },
  // Define empty objects for Node.js modules that axios might reference
  define: {
    'process.env': {},
  },
  optimizeDeps: {
    include: [
      '@emotion/react', 
      '@emotion/styled', 
      '@mui/material', 
      '@mui/x-date-pickers', 
      'mapbox-gl', 
      'react-map-gl',
      'react',
      'react-dom',
      'react-router-dom',
    ],
    // Exclude problematic dependencies from pre-bundling if needed
    exclude: [],
    // Force re-optimization when dependencies change
    force: false,
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
    // Code splitting configuration - simplified to avoid circular dependencies
    rollupOptions: {
      output: {
        // Simplified manual chunk splitting to avoid initialization order issues
        manualChunks: (id) => {
          // CRITICAL: Don't split React core - let it be bundled with vendor
          // Splitting React causes initialization order issues
          if (id.includes('node_modules')) {
            // DO NOT split React core packages - they must load together
            // This prevents "can't access lexical declaration before initialization" errors
            const isReactCore = (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router/') || id === 'react' || id === 'react-dom' || id === 'react-router-dom' || id.includes('react-is'))
            
            // If it's React core, put it in vendor (no splitting)
            if (isReactCore) {
              return 'vendor'
            }
            
            // Only split non-React-core dependencies
            // Radix UI (large, used in many places)
            if (id.includes('@radix-ui')) {
              return 'radix-ui-vendor'
            }
            // MUI (large library, separate chunk)
            if (id.includes('@mui')) {
              return 'mui-vendor'
            }
            // Icon libraries (can be large) - these use React but aren't React core
            if (id.includes('lucide-react') || id.includes('@heroicons') || id.includes('@tabler/icons') || id.includes('react-icons')) {
              return 'icons-vendor'
            }
            // Maps libraries (heavy, load on demand)
            if (id.includes('mapbox') || id.includes('google-maps') || id.includes('leaflet') || id.includes('@turf') || id.includes('react-map-gl')) {
              return 'maps-vendor'
            }
            // Animation libraries (can be large) - split further
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
            // Everything else (including React-related packages that aren't core) goes to vendor
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
        // Ensure proper chunk ordering - React must load first
        // This ensures dependencies are loaded in the correct order
        generatedCode: {
          constBindings: true,
          objectShorthand: true,
        },
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
        // Use default warning handler for other warnings
        warn(warning)
      },
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
    },
  },
  server: {
    host: '0.0.0.0', // Allow access from network
    port: 5173, // Default Vite port
  },
})

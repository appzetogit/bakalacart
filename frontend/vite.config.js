import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: [
      '@emotion/react', 
      '@emotion/styled', 
      '@mui/material', 
      '@mui/x-date-pickers', 
      'mapbox-gl', 
      'react-map-gl',
    ],
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
      target: 'es2015',
      format: 'esm',
      // Remove unused code more aggressively
      pure: ['console.log', 'console.info', 'console.debug', 'console.warn'],
    },
    // Reduce chunk size warnings
    chunkSizeWarningLimit: 500,
    // Better compression
    reportCompressedSize: false, // Faster builds
    // CSS minification
    cssMinify: 'lightningcss',
    // Code splitting configuration
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching and tree shaking
        manualChunks: (id) => {
          // Vendor chunks - more granular splitting
          if (id.includes('node_modules')) {
            // React core (smallest, most frequently used)
            if (id.includes('react') && !id.includes('react-dom') && !id.includes('react-router')) {
              return 'react-core'
            }
            // React DOM (separate from React core)
            if (id.includes('react-dom')) {
              return 'react-dom-vendor'
            }
            // React Router (separate chunk)
            if (id.includes('react-router')) {
              return 'react-router-vendor'
            }
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
            // Everything else from node_modules
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
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Enable source maps for production debugging (optional - can disable for smaller builds)
    sourcemap: false,
    // CSS code splitting
    cssCodeSplit: true,
    // Target modern browsers for smaller output
    target: 'es2015',
    // Enable aggressive tree shaking
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      tryCatchDeoptimization: false,
    },
  },
  server: {
    host: '0.0.0.0', // Allow access from network
    port: 5173, // Default Vite port
  },
})

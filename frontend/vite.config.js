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
    include: ['@emotion/react', '@emotion/styled', '@mui/material', '@mui/x-date-pickers', 'mapbox-gl', 'react-map-gl'],
    entries: ['src/module/delivery/components/DeliveryRouter.jsx'],
  },
  build: {
    minify: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Keep React, framer-motion, and @radix-ui in same chunk so UI libs
            // always have React in scope (avoids "createContext of undefined")
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router') ||
                id.includes('framer-motion') || id.includes('@radix-ui')) {
              return 'react-vendor';
            }
          }
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    chunkSizeWarningLimit: 600,
    cssCodeSplit: true,
    sourcemap: false,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})

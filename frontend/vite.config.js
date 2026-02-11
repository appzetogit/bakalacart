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
    // Force pre-bundling of DeliveryRouter to avoid dynamic import issues
    entries: [
      'src/module/delivery/components/DeliveryRouter.jsx'
    ],
  },
  server: {
    host: '0.0.0.0', // Allow access from network
    port: 5173, // Default Vite port
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Put Stripe.js in its own chunk - only loads when SubscriptionManagementModal is used
          if (id.includes('@stripe/stripe-js')) {
            return 'stripe-vendor'
          }
          // Put Stripe-related components in their own chunk
          if (id.includes('SubscriptionManagementModal') || id.includes('SubscriptionPlans')) {
            return 'stripe-components'
          }
          // Other manual chunks
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor'
            }
            if (id.includes('leaflet') || id.includes('leaflet.markercluster')) {
              return 'leaflet-vendor'
            }
            if (id.includes('framer-motion')) {
              return 'framer-motion'
            }
          }
        }
      }
    }
  },
  publicDir: 'public'
})
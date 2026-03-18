import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'vite.svg', 'lavc-logo.png'],
      manifest: {
        name: 'LAVC Banana Tracker',
        short_name: 'LAVC Tracker',
        description: 'LAVC ERP system for Banana Export Operations',
        theme_color: '#166534',
        background_color: '#f0f4f1',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}']
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        // Letting Vite handle chunks naturally to avoid resolution/circularity issues
      }
    },
    chunkSizeWarningLimit: 1000,
  }
})

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'AstaLive - Asta Fantacalcio 2026/27',
        short_name: 'AstaLive',
        description: 'Tool da tavolo per asta fantacalcio, offline-first',
        theme_color: '#0b0c10',
        background_color: '#0b0c10',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    globals: true,
  },
})

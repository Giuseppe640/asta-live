import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
// Deploy su GitHub Pages come project site: https://<user>.github.io/asta-live/
const BASE = '/asta-live/'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registrazione manuale in src/registerSW.ts: lo script auto-iniettato di default si limita
      // a registrare il service worker, senza ricaricare la pagina quando ne arriva uno nuovo — un
      // deploy poteva restare invisibile finché l'utente non ricaricava due volte di sua iniziativa.
      injectRegister: null,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'AstaLive - Asta Fantacalcio 2026/27',
        short_name: 'AstaLive',
        description: 'Tool da tavolo per asta fantacalcio, offline-first',
        theme_color: '#0a0a0f',
        background_color: '#0a0a0f',
        display: 'standalone',
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
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

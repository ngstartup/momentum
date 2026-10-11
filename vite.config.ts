/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const buildId = (process.env.BUILD_ID ?? 'dev').slice(0, 7)
const buildDate = new Date().toISOString().slice(0, 10)

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(`${buildDate} · ${buildId}`) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // l'APK est un téléchargement, pas une page : le service worker ne doit pas le remplacer par index.html
      workbox: { navigateFallbackDenylist: [/\.apk$/] },
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Momentum',
        short_name: 'Momentum',
        description: 'Deviens constant. Construis ta meilleure version.',
        lang: 'fr',
        theme_color: '#0D1117',
        background_color: '#0D1117',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    pool: 'threads',
    setupFiles: ['src/test/setup.ts'],
    globals: true,
    css: false,
  },
})

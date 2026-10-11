/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
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

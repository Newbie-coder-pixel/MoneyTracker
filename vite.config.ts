/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Own service worker (src/sw/sw.ts) for push + notification clicks (FR-8).
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      // New versions wait for the "Muat ulang" banner instead of reloading mid-entry (FR-10.6).
      registerType: 'prompt',
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png', 'badge-96x96.png'],
      manifest: {
        name: 'Money Tracker',
        short_name: 'Money Tracker',
        description: 'Catat pemasukan dan pengeluaran harian, tanpa login.',
        lang: 'id',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#f6f3ec',
        background_color: '#f6f3ec',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [{ name: 'Catat pengeluaran', short_name: 'Catat', url: '/?add=expense', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] }],
      },
    }),
  ],
  define: {
    // Shown in Lainnya; PRD §9 says the version comes from package.json.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
  },
})

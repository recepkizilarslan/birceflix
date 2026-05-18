import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        name: 'Birceflix',
        short_name: 'Birceflix',
        description: 'Film & dizi keşfet, filtrele, izlediklerini takip et.',
        lang: 'tr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0b0b10',
        theme_color: '#E50914',
        orientation: 'portrait-primary',
        icons: [
          { src: '/icon.svg', sizes: '192x192 512x512', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: '/favicon.svg', sizes: '48x48', type: 'image/svg+xml', purpose: 'any' },
        ],
        categories: ['entertainment', 'lifestyle'],
      },
      workbox: {
        // Precache all build outputs except very large maps
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // Never let the SW intercept the backend API
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // TMDB poster + backdrop images — long-lived, cache aggressively
            urlPattern: ({ url }) => url.hostname === 'image.tmdb.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'tmdb-images',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts (stylesheet)
            urlPattern: ({ url }) => url.hostname === 'fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            // Google Fonts files
            urlPattern: ({ url }) => url.hostname === 'fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // In dev we don't want the SW to interfere with HMR
      devOptions: { enabled: false },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})

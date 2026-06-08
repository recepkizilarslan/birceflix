import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // The PWA service worker was removed: precaching the app shell
    // (index.html + hashed assets) left users stranded on whichever build
    // their SW had cached, so the site "looked different for everyone"
    // until a hard refresh. Caching is now governed entirely by Caddy
    // (immutable hashed assets, no-store index.html; see the Caddyfile).
    //
    // `selfDestroying` still emits a service worker, but one that
    // unregisters itself and purges every Cache Storage entry on
    // activation. Keeping it (plus the registration in
    // ServiceWorkerCleanup) is how already-affected clients pick up the
    // cleanup. Once visitors have all loaded a post-removal build, this
    // plugin and that component can be deleted outright.
    VitePWA({
      selfDestroying: true,
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

import { useEffect } from 'react'
import { registerSW } from 'virtual:pwa-register'

/**
 * Transitional service-worker cleanup.
 *
 * Birceflix used to ship a PWA service worker that precached the app
 * shell (index.html + hashed assets). Because the SW served whatever
 * build it had cached, users were stranded on mismatched builds and the
 * site "looked different for everyone" until a hard refresh. Caching is
 * now governed entirely by Caddy (immutable hashed assets, no-store
 * index.html; see the Caddyfile), so the SW is gone.
 *
 * vite-plugin-pwa's `selfDestroying` build (see vite.config.ts) still
 * emits a service worker, but that worker unregisters itself and purges
 * every Cache Storage entry on activation. Registering it here is how
 * already-affected clients pick up the cleanup. Once enough time has
 * passed that visitors have all loaded a post-removal build, this
 * component and the VitePWA plugin can be deleted outright.
 */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    registerSW({ immediate: true })
  }, [])
  return null
}

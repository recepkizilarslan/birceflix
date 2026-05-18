import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Bottom-right toast that pops when the service worker has new content
 * waiting. registerType is 'autoUpdate' in vite.config.ts so the SW
 * activates automatically on next nav — this toast just nudges the user
 * to refresh now if they want the fresh code immediately.
 */
export function PWAUpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl) {
      // eslint-disable-next-line no-console
      console.debug('[pwa] sw registered at', swUrl)
    },
    onRegisterError(err) {
      // eslint-disable-next-line no-console
      console.warn('[pwa] sw register failed', err)
    },
  })

  if (!needRefresh && !offlineReady) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl p-4">
      <div className="text-sm">
        {needRefresh
          ? 'Yeni sürüm hazır. Şimdi yenilemek ister misin?'
          : 'Çevrimdışı kullanıma hazır.'}
      </div>
      <div className="flex gap-2 mt-3">
        {needRefresh && (
          <button
            onClick={() => updateServiceWorker(true)}
            className="text-xs px-3 py-1 rounded-lg bg-[var(--color-accent)] text-black font-medium hover:opacity-90"
          >
            Yenile
          </button>
        )}
        <button
          onClick={() => { setNeedRefresh(false); setOfflineReady(false) }}
          className="text-xs px-3 py-1 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)]"
        >
          Kapat
        </button>
      </div>
    </div>
  )
}

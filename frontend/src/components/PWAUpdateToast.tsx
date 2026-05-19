import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'

const SW_UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * Service-worker lifecycle surface.
 *
 * When a new build is detected we activate the waiting SW and reload
 * immediately instead of showing a "refresh now?" toast. The toast
 * stranded users on stale assets: the old SW's cached index.html would
 * override window.location.href reloads on login/logout, so the user
 * kept seeing the previous build's shell until they manually hit
 * refresh. Auto-activating means every navigation lands on the freshest
 * code without the user having to know a deploy happened.
 *
 * The offline-ready confirmation still surfaces once as a toast.
 */
export function PWAUpdateToast() {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // eslint-disable-next-line no-console
      console.debug('[pwa] sw registered at', swUrl)
      // A tab left open across a deploy won't see the new SW unless we
      // poll — useRegisterSW only checks on initial load.
      if (registration) {
        setInterval(() => { registration.update() }, SW_UPDATE_CHECK_INTERVAL_MS)
      }
    },
    onRegisterError(err) {
      // eslint-disable-next-line no-console
      console.warn('[pwa] sw register failed', err)
    },
  })

  useEffect(() => {
    if (needRefresh) updateServiceWorker(true)
  }, [needRefresh, updateServiceWorker])

  if (!offlineReady) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl p-4">
      <div className="text-sm">{t('pwa.offlineReady')}</div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setOfflineReady(false)}
          className="text-xs px-3 py-1 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)]"
        >
          {t('pwa.dismiss')}
        </button>
      </div>
    </div>
  )
}

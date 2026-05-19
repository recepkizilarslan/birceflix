import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'

const SW_UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000

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
 * To minimise the gap between a deploy and the user seeing it, we also
 * call registration.update() whenever the tab becomes visible, regains
 * focus, or reconnects. Those are the moments a user is about to
 * interact with stale code, so checking right then catches the deploy
 * without waiting for the periodic poll. The 5-minute interval is the
 * fallback for tabs that stay focused for long stretches.
 *
 * The offline-ready confirmation still surfaces once as a toast.
 */
export function PWAUpdateToast() {
  const { t } = useTranslation()
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // eslint-disable-next-line no-console
      console.debug('[pwa] sw registered at', swUrl)
      if (registration) {
        registrationRef.current = registration
        setInterval(() => { registration.update() }, SW_UPDATE_CHECK_INTERVAL_MS)
      }
    },
    onRegisterError(err) {
      // eslint-disable-next-line no-console
      console.warn('[pwa] sw register failed', err)
    },
  })

  useEffect(() => {
    const check = () => {
      const reg = registrationRef.current
      // Gate on visibility so visibilitychange->hidden and background
      // focus events don't fire an unnecessary network request.
      if (!reg || document.visibilityState !== 'visible') return
      reg.update().catch(() => { /* network blip; next event retries */ })
    }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    window.addEventListener('online', check)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
      window.removeEventListener('online', check)
    }
  }, [])

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

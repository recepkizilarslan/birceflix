import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'

/**
 * Route-level auth gate. Unauthenticated visitors are bounced to
 * /login?next=<requested-path> so they can come back to where they
 * meant to go after signing in. The loading splash is rendered here
 * (rather than inside Layout) so we never show authed chrome before
 * the session probe has resolved.
 *
 * Sits between Layout's <Outlet context={ctx}> and the leaf pages, so
 * we must forward the parent outlet context — otherwise our own <Outlet />
 * shadows it with `undefined` and every page that reads
 * useOutletContext<LayoutContext>() blows up at render.
 */
export function RequireAuth() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const location = useLocation()
  const parentContext = useOutletContext()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--color-text-dim)] text-sm">
        {t('common.loading')}
      </div>
    )
  }

  if (!user) {
    const next = location.pathname + location.search + location.hash
    const qs = next && next !== '/' ? `?next=${encodeURIComponent(next)}` : ''
    return <Navigate to={`/login${qs}`} replace />
  }

  return <Outlet context={parentContext} />
}

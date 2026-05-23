import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Floating "↑" button that smooth-scrolls back to the top of the page.
 * Appears once the user has scrolled roughly one viewport down and fades
 * out near the top. Position respects iOS / Android safe-area insets so the
 * button doesn't get clipped by the bottom gesture bar on phones.
 *
 * Pass `hidden` to suppress the button while a modal / bottom sheet is open
 * so it doesn't poke through the overlay.
 */
export function BackToTop({ hidden = false }: { hidden?: boolean }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.8)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const show = visible && !hidden

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t('common.backToTop')}
      title={t('common.backToTop')}
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      className={`fixed right-4 z-30 h-12 w-12 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] shadow-xl flex items-center justify-center text-xl transition-all duration-200 hover:border-[var(--color-accent)] active:scale-95 ${
        show ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}
    >
      <span aria-hidden="true">↑</span>
    </button>
  )
}

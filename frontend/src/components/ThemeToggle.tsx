import { useTranslation } from 'react-i18next'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../lib/preferences'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const [theme, setTheme] = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? t('theme.switchToLight') : t('theme.switchToDark')

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className={`h-10 w-10 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-text-dim)] inline-flex items-center justify-center text-[var(--color-text)] transition-all duration-200 ${className}`}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}

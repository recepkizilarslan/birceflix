import { useTranslation } from 'react-i18next'
import type { MediaType } from './FilterPanel'
import { useProviders } from '../lib/useProviders'

interface Props {
  mediaType: MediaType
  region: string
  selected: number[]
  onToggle: (providerId: number) => void
}

/**
 * Horizontal quick-filter strip on top of Discover. Renders every watch
 * provider TMDB exposes for the active region, sorted by display_priority,
 * so platforms outside the sidebar's old top-20 cap (TOD, Exxen, smaller
 * locals) are reachable in one tap. Tapping a tile toggles the provider
 * in the URL filter state — same mechanism the sidebar uses.
 */
export function ProviderStrip({ mediaType, region, selected, onToggle }: Props) {
  const { t } = useTranslation()
  const { providers, loading } = useProviders(mediaType, region)

  if (loading) {
    return (
      <div className="-mx-3 sm:-mx-4 px-3 sm:px-4 py-1 text-xs text-[var(--color-text-dim)]">
        {t('filters.platformLoading')}
      </div>
    )
  }
  if (providers.length === 0) return null

  return (
    <div className="-mx-3 sm:-mx-4 px-3 sm:px-4 overflow-x-auto provider-scroll pb-2">
      <div className="flex gap-2 pb-1">
        {providers.map((p) => {
          const active = selected.includes(p.provider_id)
          return (
            <button
              key={p.provider_id}
              onClick={() => onToggle(p.provider_id)}
              title={p.provider_name}
              aria-pressed={active}
              className={`shrink-0 flex flex-col items-center gap-1.5 w-[72px] sm:w-[84px] rounded-xl p-2 transition ${
                active
                  ? 'bg-[var(--color-surface-2)] ring-2 ring-[var(--color-accent)]'
                  : 'hover:bg-[var(--color-surface-2)]/60 active:scale-[0.97]'
              }`}
            >
              {p.logo_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                  alt=""
                  className="w-12 h-12 sm:w-[52px] sm:h-[52px] rounded-md bg-[var(--color-surface-2)] shadow-sm"
                  loading="lazy"
                />
              ) : (
                <div className="w-12 h-12 sm:w-[52px] sm:h-[52px] rounded-md bg-[var(--color-surface-2)] shadow-sm" />
              )}
              <span className="text-[11px] sm:text-[12px] font-medium leading-tight w-full text-center truncate text-[var(--color-text-dim)]">
                {p.provider_name}
              </span>
            </button>
          )
        })}
      </div>
      <style>{`
        .provider-scroll::-webkit-scrollbar { height: 4px; }
        .provider-scroll::-webkit-scrollbar-track { background: transparent; }
        .provider-scroll::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 4px; }
        .provider-scroll:hover::-webkit-scrollbar-thumb { background: var(--color-text-dim); }
        .provider-scroll { scrollbar-width: thin; scrollbar-color: var(--color-border) transparent; }
      `}</style>
    </div>
  )
}

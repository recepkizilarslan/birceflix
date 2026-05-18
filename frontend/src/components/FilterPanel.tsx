import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listGenres, listProviders, type Genre, type ProviderListItem } from '../lib/api'
import { listTvGenres, listTvProviders } from '../lib/tv'
import { COUNTRIES, LANGUAGES, SORT_OPTIONS, TV_SORT_OPTIONS } from '../lib/constants'
import { getRegion } from '../lib/preferences'
import { countryName, languageName } from '../lib/intl'

/**
 * UI-level media category. Maps to a TMDB endpoint + forced params at the
 * call site:
 *   movie → /discover/movie
 *   tv    → /discover/tv
 *   doc   → /discover/movie with_genres=99 (Documentary, forced)
 */
export type MediaType = 'movie' | 'tv' | 'doc'

/** True when the category uses /discover/tv under the hood (TV genres, TV providers, TV sort, season/episode filters). */
// eslint-disable-next-line react-refresh/only-export-components
export function isTvMedia(t: MediaType): boolean {
  return t === 'tv'
}

export interface FilterState {
  min_rating: number
  original_language: string
  origin_country: string
  with_genres: number[]
  year_from: number | ''
  year_to: number | ''
  with_watch_providers: number[]
  watch_region: string
  runtime_from: number | ''
  runtime_to: number | ''
  /** TV-only: total seasons range. Ignored for movies. */
  seasons_from: number | ''
  seasons_to: number | ''
  /** TV-only: total episodes range. Ignored for movies. */
  episodes_from: number | ''
  episodes_to: number | ''
  sort_by: string
}

// eslint-disable-next-line react-refresh/only-export-components
export const DEFAULT_FILTERS: FilterState = {
  min_rating: 0,
  original_language: '',
  origin_country: '',
  with_genres: [],
  year_from: '',
  year_to: '',
  with_watch_providers: [],
  watch_region: getRegion(),
  runtime_from: '',
  runtime_to: '',
  seasons_from: '',
  seasons_to: '',
  episodes_from: '',
  episodes_to: '',
  sort_by: 'popularity.desc',
}

interface Props {
  value: FilterState
  onChange: (next: FilterState) => void
  onReset: () => void
  activeCount: number
  /** Drives which genres / providers / sort options the panel loads. Defaults to movies. */
  mediaType?: MediaType
  /** When provided, the panel renders a media-type selector section at the top. */
  onMediaTypeChange?: (m: MediaType) => void
}

export function FilterPanel({ value, onChange, onReset, activeCount, mediaType = 'movie', onMediaTypeChange }: Props) {
  const { t } = useTranslation()
  const [genres, setGenres] = useState<Genre[]>([])
  const [providers, setProviders] = useState<ProviderListItem[]>([])

  const tvMode = isTvMedia(mediaType)

  useEffect(() => {
    const loader = tvMode ? listTvGenres : listGenres
    loader().then(setGenres).catch(() => {})
  }, [tvMode])

  useEffect(() => {
    const loader = tvMode ? listTvProviders : listProviders
    loader(value.watch_region).then((p) => {
      const top = [...p].sort((a, b) => a.display_priority - b.display_priority).slice(0, 20)
      setProviders(top)
    }).catch(() => setProviders([]))
  }, [tvMode, value.watch_region])

  const sortOptions = tvMode ? TV_SORT_OPTIONS : SORT_OPTIONS

  const toggle = (arr: number[], id: number) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]

  // Resolve a label for a code-or-empty entry — empty means "All".
  const countryLabel = (code: string) => code ? countryName(code) : t('filters.all')
  const languageLabel = (code: string) => code ? languageName(code) : t('filters.all')

  return (
    <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{t('filters.title')}</span>
          {activeCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--color-accent)] text-black font-medium">{activeCount}</span>
          )}
        </div>
        {activeCount > 0 && (
          <button onClick={onReset} className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-accent)]">
            {t('filters.clear')}
          </button>
        )}
      </div>

      {onMediaTypeChange && (
        <Section title={t('filters.mediaType')} defaultOpen>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => onMediaTypeChange('movie')} className={chipCls(mediaType === 'movie')}>
              🎬 {t('filters.mediaTypes.movie')}
            </button>
            <button onClick={() => onMediaTypeChange('tv')} className={chipCls(mediaType === 'tv')}>
              📺 {t('filters.mediaTypes.tv')}
            </button>
            <button onClick={() => onMediaTypeChange('doc')} className={chipCls(mediaType === 'doc')}>
              🎥 {t('filters.mediaTypes.doc')}
            </button>
          </div>
        </Section>
      )}

      <Section title={`${t('filters.platforms')} ${value.with_watch_providers.length > 0 ? `(${value.with_watch_providers.length})` : ''}`} defaultOpen>
        <div className="mb-2">
          <Select value={value.watch_region} onChange={(v) => onChange({ ...value, watch_region: v, with_watch_providers: [] })}>
            {COUNTRIES.filter((c) => c.code).map((c) => <option key={c.code} value={c.code}>{countryLabel(c.code)}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto">
          {providers.length === 0 && <div className="text-xs text-[var(--color-text-dim)] col-span-2">{t('filters.platformLoading')}</div>}
          {providers.map((p) => {
            const active = value.with_watch_providers.includes(p.provider_id)
            return (
              <button
                key={p.provider_id}
                onClick={() => onChange({ ...value, with_watch_providers: toggle(value.with_watch_providers, p.provider_id) })}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-left transition ${
                  active
                    ? 'bg-[var(--color-accent)] text-black border-[var(--color-accent)]'
                    : 'bg-[var(--color-surface-2)] border-[var(--color-border)] hover:border-[var(--color-accent)]'
                }`}
                title={p.provider_name}
              >
                {p.logo_path && <img src={`https://image.tmdb.org/t/p/w45${p.logo_path}`} alt="" className="h-5 w-5 rounded shrink-0" />}
                <span className="text-[11px] truncate">{p.provider_name}</span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section title={t('filters.sort')} defaultOpen>
        <Select value={value.sort_by} onChange={(v) => onChange({ ...value, sort_by: v })}>
          {sortOptions.map((s) => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
        </Select>
      </Section>

      <Section title={`${t('filters.minRating')} ${value.min_rating > 0 ? `(${value.min_rating.toFixed(1)})` : ''}`} defaultOpen>
        <input
          type="range" min={0} max={10} step={0.5}
          value={value.min_rating}
          onChange={(e) => onChange({ ...value, min_rating: Number(e.target.value) })}
          className="w-full accent-[var(--color-accent)]"
        />
        <div className="flex justify-between text-[10px] text-[var(--color-text-dim)] mt-1">
          <span>0</span><span>5</span><span>10</span>
        </div>
        <div className="text-[10px] text-[var(--color-text-dim)] mt-1.5 leading-tight">
          {t('filters.minRatingHint')}
        </div>
      </Section>

      {/* Documentary mode forces with_genres=99 at the call site, so the
          genre chip section here would be misleading — hide it. */}
      {mediaType !== 'doc' && (
        <Section title={`${t('filters.genres')} ${value.with_genres.length > 0 ? `(${value.with_genres.length})` : ''}`} defaultOpen>
          <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto">
            {genres.map((g) => {
              const active = value.with_genres.includes(g.id)
              return (
                <button
                  key={g.id}
                  onClick={() => onChange({ ...value, with_genres: toggle(value.with_genres, g.id) })}
                  className={chipCls(active)}
                >
                  {g.name}
                </button>
              )
            })}
          </div>
        </Section>
      )}

      <Section title={`${t('filters.language')} ${value.original_language ? '•' : ''}`}>
        <Select value={value.original_language} onChange={(v) => onChange({ ...value, original_language: v })}>
          {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{languageLabel(l.code)}</option>)}
        </Select>
      </Section>

      <Section title={`${t('filters.originCountry')} ${value.origin_country ? '•' : ''}`}>
        <Select value={value.origin_country} onChange={(v) => onChange({ ...value, origin_country: v })}>
          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{countryLabel(c.code)}</option>)}
        </Select>
      </Section>

      <Section title={`${t('filters.year')} ${value.year_from || value.year_to ? '•' : ''}`}>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number" min={1900} max={2100} placeholder={t('filters.yearFrom')}
            value={value.year_from}
            onChange={(e) => onChange({ ...value, year_from: e.target.value ? Number(e.target.value) : '' })}
            className={inputCls}
          />
          <input
            type="number" min={1900} max={2100} placeholder={t('filters.yearTo')}
            value={value.year_to}
            onChange={(e) => onChange({ ...value, year_to: e.target.value ? Number(e.target.value) : '' })}
            className={inputCls}
          />
        </div>
      </Section>

      <Section title={`${t('filters.runtime')} ${value.runtime_from || value.runtime_to ? '•' : ''}`} last={!tvMode}>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {RUNTIME_PRESETS.map((preset) => {
            const active = value.runtime_from === preset.from && value.runtime_to === preset.to
            return (
              <button
                key={preset.labelKey}
                onClick={() => onChange({ ...value, runtime_from: preset.from, runtime_to: preset.to })}
                className={chipCls(active)}
              >
                {t(preset.labelKey)}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number" min={0} max={600} placeholder={t('filters.runtimeFromPlaceholder')}
            value={value.runtime_from}
            onChange={(e) => onChange({ ...value, runtime_from: e.target.value ? Number(e.target.value) : '' })}
            className={inputCls}
          />
          <input
            type="number" min={0} max={600} placeholder={t('filters.runtimeToPlaceholder')}
            value={value.runtime_to}
            onChange={(e) => onChange({ ...value, runtime_to: e.target.value ? Number(e.target.value) : '' })}
            className={inputCls}
          />
        </div>
      </Section>

      {tvMode && (
        <Section title={`${t('filters.seasons')} ${value.seasons_from || value.seasons_to ? '•' : ''}`}>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {SEASONS_PRESETS.map((preset) => {
              const active = value.seasons_from === preset.from && value.seasons_to === preset.to
              return (
                <button
                  key={preset.labelKey}
                  onClick={() => onChange({ ...value, seasons_from: preset.from, seasons_to: preset.to })}
                  className={chipCls(active)}
                >
                  {t(preset.labelKey)}
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number" min={0} max={100} placeholder={t('filters.seasonsFromPlaceholder')}
              value={value.seasons_from}
              onChange={(e) => onChange({ ...value, seasons_from: e.target.value ? Number(e.target.value) : '' })}
              className={inputCls}
            />
            <input
              type="number" min={0} max={100} placeholder={t('filters.seasonsToPlaceholder')}
              value={value.seasons_to}
              onChange={(e) => onChange({ ...value, seasons_to: e.target.value ? Number(e.target.value) : '' })}
              className={inputCls}
            />
          </div>
        </Section>
      )}

      {tvMode && (
        <Section title={`${t('filters.episodes')} ${value.episodes_from || value.episodes_to ? '•' : ''}`} last>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {EPISODES_PRESETS.map((preset) => {
              const active = value.episodes_from === preset.from && value.episodes_to === preset.to
              return (
                <button
                  key={preset.labelKey}
                  onClick={() => onChange({ ...value, episodes_from: preset.from, episodes_to: preset.to })}
                  className={chipCls(active)}
                >
                  {t(preset.labelKey)}
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number" min={0} max={5000} placeholder={t('filters.episodesFromPlaceholder')}
              value={value.episodes_from}
              onChange={(e) => onChange({ ...value, episodes_from: e.target.value ? Number(e.target.value) : '' })}
              className={inputCls}
            />
            <input
              type="number" min={0} max={5000} placeholder={t('filters.episodesToPlaceholder')}
              value={value.episodes_to}
              onChange={(e) => onChange({ ...value, episodes_to: e.target.value ? Number(e.target.value) : '' })}
              className={inputCls}
            />
          </div>
        </Section>
      )}
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function countActiveFilters(f: FilterState): number {
  let n = 0
  if (f.min_rating > 0) n++
  if (f.original_language) n++
  if (f.origin_country) n++
  if (f.with_genres.length) n++
  if (f.year_from !== '') n++
  if (f.year_to !== '') n++
  if (f.with_watch_providers.length) n++
  if (f.runtime_from !== '') n++
  if (f.runtime_to !== '') n++
  if (f.seasons_from !== '') n++
  if (f.seasons_to !== '') n++
  if (f.episodes_from !== '') n++
  if (f.episodes_to !== '') n++
  if (f.sort_by !== DEFAULT_FILTERS.sort_by) n++
  return n
}

const RUNTIME_PRESETS: { labelKey: string; from: number | ''; to: number | '' }[] = [
  { labelKey: 'filters.runtimePresets.short',     from: '',  to: 90 },
  { labelKey: 'filters.runtimePresets.medium',    from: 90,  to: 120 },
  { labelKey: 'filters.runtimePresets.long',      from: 120, to: 150 },
  { labelKey: 'filters.runtimePresets.veryLong',  from: 150, to: '' },
]

const SEASONS_PRESETS: { labelKey: string; from: number | ''; to: number | '' }[] = [
  { labelKey: 'filters.seasonsPresets.limited', from: 1, to: 1 },
  { labelKey: 'filters.seasonsPresets.short',   from: 2, to: 5 },
  { labelKey: 'filters.seasonsPresets.long',    from: 6, to: '' },
]

const EPISODES_PRESETS: { labelKey: string; from: number | ''; to: number | '' }[] = [
  { labelKey: 'filters.episodesPresets.few',    from: '',  to: 20 },
  { labelKey: 'filters.episodesPresets.medium', from: 20,  to: 100 },
  { labelKey: 'filters.episodesPresets.many',   from: 100, to: '' },
]

function Section({ title, children, defaultOpen, last }: { title: string; children: React.ReactNode; defaultOpen?: boolean; last?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className={last ? '' : 'border-b border-[var(--color-border)]'}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--color-surface-2)]/40 transition text-left"
      >
        <span className="text-sm font-medium">{title}</span>
        <span className={`text-xs text-[var(--color-text-dim)] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {children}
    </select>
  )
}

const inputCls = 'w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[var(--color-accent)]'
const chipCls = (active: boolean) =>
  `px-2.5 py-1 rounded-full text-xs border transition ${active ? 'bg-[var(--color-accent)] text-black border-[var(--color-accent)]' : 'bg-[var(--color-surface-2)] border-[var(--color-border)] hover:border-[var(--color-accent)]'}`

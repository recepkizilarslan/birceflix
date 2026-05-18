import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listGenres, listProviders, type Genre, type ProviderListItem } from '../lib/api'
import { COUNTRIES, LANGUAGES, SORT_OPTIONS } from '../lib/constants'
import { getRegion } from '../lib/preferences'
import { countryName, languageName } from '../lib/intl'

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
  sort_by: 'popularity.desc',
}

interface Props {
  value: FilterState
  onChange: (next: FilterState) => void
  onReset: () => void
  activeCount: number
}

export function FilterPanel({ value, onChange, onReset, activeCount }: Props) {
  const { t } = useTranslation()
  const [genres, setGenres] = useState<Genre[]>([])
  const [providers, setProviders] = useState<ProviderListItem[]>([])

  useEffect(() => {
    listGenres().then(setGenres).catch(() => {})
  }, [])

  useEffect(() => {
    listProviders(value.watch_region).then((p) => {
      const top = [...p].sort((a, b) => a.display_priority - b.display_priority).slice(0, 20)
      setProviders(top)
    }).catch(() => setProviders([]))
  }, [value.watch_region])

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
          {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
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

      <Section title={`${t('filters.runtime')} ${value.runtime_from || value.runtime_to ? '•' : ''}`} last>
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
  if (f.sort_by !== DEFAULT_FILTERS.sort_by) n++
  return n
}

const RUNTIME_PRESETS: { labelKey: string; from: number | ''; to: number | '' }[] = [
  { labelKey: 'filters.runtimePresets.short',     from: '',  to: 90 },
  { labelKey: 'filters.runtimePresets.medium',    from: 90,  to: 120 },
  { labelKey: 'filters.runtimePresets.long',      from: 120, to: 150 },
  { labelKey: 'filters.runtimePresets.veryLong',  from: 150, to: '' },
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

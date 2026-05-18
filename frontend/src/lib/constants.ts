export const LANGUAGES: { code: string; label: string }[] = [
  { code: '', label: 'Tümü' },
  { code: 'en', label: 'İngilizce' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'es', label: 'İspanyolca' },
  { code: 'fr', label: 'Fransızca' },
  { code: 'de', label: 'Almanca' },
  { code: 'it', label: 'İtalyanca' },
  { code: 'ja', label: 'Japonca' },
  { code: 'ko', label: 'Korece' },
  { code: 'zh', label: 'Çince' },
  { code: 'hi', label: 'Hintçe' },
  { code: 'ru', label: 'Rusça' },
  { code: 'pt', label: 'Portekizce' },
  { code: 'ar', label: 'Arapça' },
]

export const COUNTRIES: { code: string; label: string }[] = [
  { code: '', label: 'Tümü' },
  { code: 'US', label: 'ABD' },
  { code: 'TR', label: 'Türkiye' },
  { code: 'GB', label: 'İngiltere' },
  { code: 'FR', label: 'Fransa' },
  { code: 'DE', label: 'Almanya' },
  { code: 'IT', label: 'İtalya' },
  { code: 'ES', label: 'İspanya' },
  { code: 'JP', label: 'Japonya' },
  { code: 'KR', label: 'Güney Kore' },
  { code: 'IN', label: 'Hindistan' },
  { code: 'CN', label: 'Çin' },
  { code: 'RU', label: 'Rusya' },
]

/** Sort options for TMDB Discover. `labelKey` resolves via i18n. */
export const SORT_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'popularity.desc',           labelKey: 'filters.sortOptions.popularity' },
  { value: 'vote_average.desc',         labelKey: 'filters.sortOptions.ratingHigh' },
  { value: 'primary_release_date.desc', labelKey: 'filters.sortOptions.newest' },
  { value: 'primary_release_date.asc',  labelKey: 'filters.sortOptions.oldest' },
  { value: 'revenue.desc',              labelKey: 'filters.sortOptions.revenue' },
]

export const DEFAULT_WATCH_REGION = (import.meta.env.VITE_DEFAULT_WATCH_REGION as string) || 'TR'

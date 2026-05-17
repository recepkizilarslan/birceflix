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

export const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'popularity.desc', label: 'Popülerlik' },
  { value: 'vote_average.desc', label: 'Puan (yüksek)' },
  { value: 'primary_release_date.desc', label: 'Yeni çıkanlar' },
  { value: 'primary_release_date.asc', label: 'Eski → yeni' },
  { value: 'revenue.desc', label: 'Hasılat' },
]

export const DEFAULT_WATCH_REGION = (import.meta.env.VITE_DEFAULT_WATCH_REGION as string) || 'TR'

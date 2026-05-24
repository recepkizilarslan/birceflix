import { useEffect, useState } from 'react'
import i18n from '../i18n'

const REGION_KEY = 'birceflix.region'
const FALLBACK_REGION = (import.meta.env.VITE_DEFAULT_WATCH_REGION as string | undefined) ?? 'TR'

let cachedRegion: string | null = null

function readRegion(): string {
  if (cachedRegion) return cachedRegion
  try {
    const v = window.localStorage.getItem(REGION_KEY)
    if (v && /^[A-Z]{2}$/.test(v)) {
      cachedRegion = v
      return v
    }
  } catch {
    // ignore (SSR / privacy modes)
  }
  cachedRegion = FALLBACK_REGION
  return FALLBACK_REGION
}

/** Subscribers across the app — change one, re-render all. */
const subscribers = new Set<() => void>()

export function setRegion(next: string) {
  if (!/^[A-Z]{2}$/.test(next)) return
  cachedRegion = next
  try { window.localStorage.setItem(REGION_KEY, next) } catch { /* noop */ }
  subscribers.forEach((fn) => fn())
}

export function getRegion(): string {
  return readRegion()
}

export function useRegion(): [string, (next: string) => void] {
  const [value, setValue] = useState<string>(readRegion)
  useEffect(() => {
    const fn = () => setValue(readRegion())
    subscribers.add(fn)
    return () => { subscribers.delete(fn) }
  }, [])
  return [value, setRegion]
}

export type Lang = 'tr' | 'en' | 'de' | 'it' | 'pl'

/** Single source of truth for what the UI ships translations for. The
 *  order here matches the toggle order in PreferencesMenu, with TR first
 *  because Turkish is the project's primary locale. */
export const SUPPORTED_LANGS: readonly Lang[] = ['tr', 'en', 'de', 'it', 'pl'] as const

/** Resolve i18n's possibly-regional code (en-US, de-AT, ...) down to one of
 *  our supported short codes. Anything that doesn't match falls back to
 *  Turkish, matching the i18n init's `fallbackLng`. */
export function normalizeLang(raw: string | undefined): Lang {
  const lower = (raw || '').toLowerCase()
  for (const code of SUPPORTED_LANGS) {
    if (lower.startsWith(code)) return code
  }
  return 'tr'
}

export function setLanguage(next: Lang) {
  void i18n.changeLanguage(next)
}

/** A stable hook into the current i18n language for non-translation use cases. */
export function useLanguage(): [Lang, (next: Lang) => void] {
  const [value, setValue] = useState<Lang>(() => normalizeLang(i18n.language))
  useEffect(() => {
    const handler = (lng: string) => setValue(normalizeLang(lng))
    i18n.on('languageChanged', handler)
    return () => { i18n.off('languageChanged', handler) }
  }, [])
  return [value, setLanguage]
}

export type Theme = 'dark' | 'light'

const THEME_KEY = 'birceflix.theme'
const themeSubscribers = new Set<() => void>()
let cachedTheme: Theme | null = null

function readTheme(): Theme {
  if (cachedTheme) return cachedTheme
  try {
    const v = window.localStorage.getItem(THEME_KEY)
    if (v === 'light' || v === 'dark') {
      cachedTheme = v
      return v
    }
  } catch {
    // ignore (SSR / privacy modes)
  }
  cachedTheme = 'dark'
  return 'dark'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.style.colorScheme = theme
}

/** Applies the persisted theme to <html>. Call once on boot to avoid FOUC. */
export function initTheme() {
  applyTheme(readTheme())
}

export function setTheme(next: Theme) {
  cachedTheme = next
  try { window.localStorage.setItem(THEME_KEY, next) } catch { /* noop */ }
  applyTheme(next)
  themeSubscribers.forEach((fn) => fn())
}

export function useTheme(): [Theme, (next: Theme) => void] {
  const [value, setValue] = useState<Theme>(readTheme)
  useEffect(() => {
    const fn = () => setValue(readTheme())
    themeSubscribers.add(fn)
    return () => { themeSubscribers.delete(fn) }
  }, [])
  return [value, setTheme]
}

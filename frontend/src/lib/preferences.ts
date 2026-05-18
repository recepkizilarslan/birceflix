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

export type Lang = 'tr' | 'en'

export function setLanguage(next: Lang) {
  void i18n.changeLanguage(next)
}

/** A stable hook into the current i18n language for non-translation use cases. */
export function useLanguage(): [Lang, (next: Lang) => void] {
  const [value, setValue] = useState<Lang>(() => ((i18n.language || 'tr').startsWith('en') ? 'en' : 'tr'))
  useEffect(() => {
    const handler = (lng: string) => {
      setValue(lng.startsWith('en') ? 'en' : 'tr')
    }
    i18n.on('languageChanged', handler)
    return () => { i18n.off('languageChanged', handler) }
  }, [])
  return [value, setLanguage]
}

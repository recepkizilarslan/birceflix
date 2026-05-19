import { useEffect, useState } from 'react'
import { isTvMedia, type MediaType } from '../components/FilterPanel'
import { listProviders, type ProviderListItem } from './api'
import { listTvProviders } from './tv'

// Module-level cache so the Discover page's provider strip and its filter
// panel (which both render at the same time) share a single network fetch
// per (mediaType, region) pair instead of duplicating requests.
const cache = new Map<string, ProviderListItem[]>()

function cacheKey(mediaType: MediaType, region: string) {
  return `${isTvMedia(mediaType) ? 'tv' : 'movie'}:${region}`
}

export function useProviders(mediaType: MediaType, region: string) {
  const key = cacheKey(mediaType, region)
  const [providers, setProviders] = useState<ProviderListItem[]>(() => cache.get(key) ?? [])
  const [loading, setLoading] = useState<boolean>(() => !cache.has(key))

  useEffect(() => {
    const cached = cache.get(key)
    if (cached) {
      setProviders(cached)
      setLoading(false)
      return
    }
    let cancelled = false
    setProviders([])
    setLoading(true)
    const fetcher = isTvMedia(mediaType) ? listTvProviders : listProviders
    fetcher(region)
      .then((rows) => {
        const sorted = [...rows].sort((a, b) => a.display_priority - b.display_priority)
        cache.set(key, sorted)
        if (!cancelled) setProviders(sorted)
      })
      .catch(() => { if (!cancelled) setProviders([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [key, mediaType, region])

  return { providers, loading }
}

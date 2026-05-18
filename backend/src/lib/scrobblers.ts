/**
 * Plex / Jellyfin scrobble payload normalisation.
 *
 * The webhook endpoint accepts either provider's payload format and
 * returns a single ScrobbleEvent shape (or null when the payload is
 * something we deliberately ignore — pause / progress / rate / etc.).
 *
 * Source IDs are validated cheaply; richer enrichment (TMDB lookups)
 * happens at the call site so the parser stays pure.
 */

export interface ScrobbleMovie {
  kind: 'movie'
  tmdbId: number
  imdbId: string | null
  title: string
  watchedAt: Date
  source: 'plex' | 'jellyfin'
}

export interface ScrobbleEpisode {
  kind: 'episode'
  /** TMDB tv show id. */
  showId: number
  showName: string
  showPosterPath: string | null
  seasonNumber: number
  episodeNumber: number
  episodeName: string | null
  watchedAt: Date
  source: 'plex' | 'jellyfin'
}

export type ScrobbleEvent = ScrobbleMovie | ScrobbleEpisode

// ---------------------------------------------------------------------------
// Plex
// ---------------------------------------------------------------------------

interface PlexGuid { id?: string }
interface PlexPayload {
  event?: string
  Metadata?: {
    type?: string
    title?: string
    grandparentTitle?: string
    grandparentGuid?: string
    parentIndex?: number
    index?: number
    year?: number
    Guid?: PlexGuid[]
  }
}

/** Extract `tmdb://NNN` / `imdb://ttNNN` from the Plex Guid array or a single guid string. */
function extractIds(guids: PlexGuid[] | undefined, fallbackGuid?: string) {
  let tmdb: number | null = null
  let imdb: string | null = null
  const all: string[] = []
  if (guids) for (const g of guids) if (g.id) all.push(g.id)
  if (fallbackGuid) all.push(fallbackGuid)
  for (const g of all) {
    if (g.startsWith('tmdb://')) {
      const n = parseInt(g.slice('tmdb://'.length), 10)
      if (Number.isFinite(n)) tmdb = n
    } else if (g.startsWith('imdb://')) {
      imdb = g.slice('imdb://'.length)
    }
  }
  return { tmdb, imdb }
}

export function parsePlex(payload: unknown): ScrobbleEvent | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as PlexPayload

  // Only act on media.scrobble — Plex sends play/pause/resume/stop/rate too.
  if (p.event !== 'media.scrobble') return null

  const m = p.Metadata
  if (!m) return null

  const watchedAt = new Date()

  if (m.type === 'movie') {
    const { tmdb, imdb } = extractIds(m.Guid)
    if (!tmdb) return null
    return {
      kind: 'movie',
      tmdbId: tmdb,
      imdbId: imdb,
      title: m.title ?? '?',
      watchedAt,
      source: 'plex',
    }
  }

  if (m.type === 'episode') {
    const { tmdb: showId } = extractIds(undefined, m.grandparentGuid)
    if (!showId) return null
    if (m.parentIndex == null || m.index == null) return null
    return {
      kind: 'episode',
      showId,
      showName: m.grandparentTitle ?? '?',
      showPosterPath: null,
      seasonNumber: m.parentIndex,
      episodeNumber: m.index,
      episodeName: m.title ?? null,
      watchedAt,
      source: 'plex',
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Jellyfin (Webhook plugin, default JSON template)
// ---------------------------------------------------------------------------

interface JellyfinPayload {
  NotificationType?: string
  ItemType?: string
  Name?: string
  SeriesName?: string
  SeasonNumber?: number
  EpisodeNumber?: number
  Provider_tmdb?: string
  Provider_imdb?: string
  SeriesProvider_tmdb?: string
  /** Some plugin versions key it as 'SeriesProviderIds.Tmdb' etc; we accept both. */
  ProviderIds?: { Tmdb?: string; Imdb?: string }
  SeriesProviderIds?: { Tmdb?: string }
  UtcTimestamp?: string
  Timestamp?: string
}

/** Treat these as "user finished watching it". */
const JELLYFIN_WATCHED_EVENTS = new Set([
  'PlaybackStop',     // typical; the plugin only fires this past the threshold if configured
  'UserDataSaved',    // Jellyfin event for "played" toggles
  'MarkPlayed',
])

function toInt(v: string | number | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

export function parseJellyfin(payload: unknown): ScrobbleEvent | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as JellyfinPayload

  if (p.NotificationType && !JELLYFIN_WATCHED_EVENTS.has(p.NotificationType)) {
    return null
  }

  const watchedAt = p.UtcTimestamp ? new Date(p.UtcTimestamp) : p.Timestamp ? new Date(p.Timestamp) : new Date()

  if (p.ItemType === 'Movie') {
    const tmdb = toInt(p.Provider_tmdb ?? p.ProviderIds?.Tmdb)
    if (!tmdb) return null
    return {
      kind: 'movie',
      tmdbId: tmdb,
      imdbId: p.Provider_imdb ?? p.ProviderIds?.Imdb ?? null,
      title: p.Name ?? '?',
      watchedAt,
      source: 'jellyfin',
    }
  }

  if (p.ItemType === 'Episode') {
    const showId = toInt(p.SeriesProvider_tmdb ?? p.SeriesProviderIds?.Tmdb)
    if (!showId) return null
    if (p.SeasonNumber == null || p.EpisodeNumber == null) return null
    return {
      kind: 'episode',
      showId,
      showName: p.SeriesName ?? '?',
      showPosterPath: null,
      seasonNumber: p.SeasonNumber,
      episodeNumber: p.EpisodeNumber,
      episodeName: p.Name ?? null,
      watchedAt,
      source: 'jellyfin',
    }
  }

  return null
}

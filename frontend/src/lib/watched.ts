export type MediaType = 'movie' | 'tv'

export interface WatchedRow {
  id: string
  user_id: string
  tmdb_id: number
  media_type: MediaType
  imdb_id: string | null
  title: string
  poster_path: string | null
  watched_at: string
  my_rating: number | null
  notes: string | null
}

/** Stable key for Set<string> lookups: "movie:550" vs "tv:550" are distinct. */
export function mediaKey(media_type: MediaType, tmdb_id: number): string {
  return `${media_type}:${tmdb_id}`
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.url} -> ${res.status}`)
  return res.json() as Promise<T>
}

/** GET /api/watched returns a paginated envelope (`{items, page, limit}`).
 *  The UI doesn't paginate yet, so we ask for the backend's max page size
 *  and unwrap items. If the user crosses that ceiling we'll need to loop
 *  pages here. */
export async function listWatched(): Promise<WatchedRow[]> {
  const body = await json<{ items: WatchedRow[]; page: number; limit: number }>(
    await fetch('/api/watched?limit=100', { credentials: 'include' }),
  )
  return body.items
}

export interface MarkWatchedInput {
  id: number
  media_type: MediaType
  title: string
  poster_path: string | null
  imdb_id?: string | null
}

export async function markWatched(m: MarkWatchedInput) {
  await json<{ ok: true }>(await fetch('/api/watched', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tmdb_id: m.id,
      media_type: m.media_type,
      imdb_id: m.imdb_id ?? null,
      title: m.title,
      poster_path: m.poster_path,
    }),
  }))
}

export async function unmarkWatched(tmdb_id: number, media_type: MediaType) {
  await json<{ ok: true }>(await fetch(`/api/watched/${tmdb_id}?media_type=${media_type}`, {
    method: 'DELETE',
    credentials: 'include',
  }))
}

export async function getWatched(tmdb_id: number, media_type: MediaType = 'movie'): Promise<WatchedRow | null> {
  const res = await fetch(`/api/watched/${tmdb_id}?media_type=${media_type}`, { credentials: 'include' })
  if (res.status === 404) return null
  return json<WatchedRow>(res)
}

export async function updateWatchedMeta(
  tmdb_id: number,
  patch: { my_rating?: number | null; notes?: string | null },
  media_type: MediaType = 'movie',
) {
  await json<{ ok: true }>(await fetch(`/api/watched/${tmdb_id}?media_type=${media_type}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  }))
}

/** Keyed by mediaKey() so movie/tv rows with the same TMDB id don't collide. */
export async function getWatchedKeySet(): Promise<Set<string>> {
  try {
    const rows = await listWatched()
    return new Set(rows.map((r) => mediaKey(r.media_type, r.tmdb_id)))
  } catch {
    return new Set()
  }
}

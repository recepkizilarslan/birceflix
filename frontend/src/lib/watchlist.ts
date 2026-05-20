import { mediaKey, type MediaType } from './watched'

export interface WatchlistRow {
  user_id: string
  tmdb_id: number
  media_type: MediaType
  title: string
  poster_path: string | null
  added_at: string
  priority: number
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.url} -> ${res.status}`)
  return res.json() as Promise<T>
}

/** GET /api/watchlist returns a paginated envelope (`{items, page, limit}`).
 *  The UI doesn't paginate yet, so we ask for the backend's max page size
 *  and unwrap items. If the user crosses that ceiling we'll need to loop
 *  pages here. */
export async function listWatchlist(): Promise<WatchlistRow[]> {
  const body = await json<{ items: WatchlistRow[]; page: number; limit: number }>(
    await fetch('/api/watchlist?limit=100', { credentials: 'include' }),
  )
  return body.items
}

export interface AddWatchlistInput {
  id: number
  media_type: MediaType
  title: string
  poster_path: string | null
}

export async function addToWatchlist(m: AddWatchlistInput) {
  await json<{ ok: true }>(await fetch('/api/watchlist', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tmdb_id: m.id,
      media_type: m.media_type,
      title: m.title,
      poster_path: m.poster_path,
    }),
  }))
}

export async function removeFromWatchlist(tmdb_id: number, media_type: MediaType) {
  await json<{ ok: true }>(await fetch(`/api/watchlist/${tmdb_id}?media_type=${media_type}`, {
    method: 'DELETE',
    credentials: 'include',
  }))
}

export async function getWatchlistKeySet(): Promise<Set<string>> {
  try {
    const rows = await listWatchlist()
    return new Set(rows.map((r) => mediaKey(r.media_type, r.tmdb_id)))
  } catch {
    return new Set()
  }
}

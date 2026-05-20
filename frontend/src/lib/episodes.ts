export interface WatchedEpisodeRow {
  id: string
  show_id: number
  show_name: string
  show_poster_path: string | null
  season_number: number
  episode_number: number
  episode_name: string | null
  watched_at: string
  my_rating: number | null
  notes: string | null
}

export interface WatchedShowSummary {
  show_id: number
  show_name: string
  show_poster_path: string | null
  episode_count: number
  last_watched_at: string
}

export interface MarkEpisodeInput {
  show_id: number
  show_name: string
  show_poster_path?: string | null
  season_number: number
  episode_number: number
  episode_name?: string | null
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.url} -> ${res.status}`)
  return res.json() as Promise<T>
}

/** GET /api/watched-episodes returns a paginated envelope
 *  (`{items, page, limit}`). The UI doesn't paginate yet, so we ask for
 *  the backend's max page size and unwrap items. */
export async function listWatchedShows(): Promise<WatchedShowSummary[]> {
  const body = await json<{ items: WatchedShowSummary[]; page: number; limit: number }>(
    await fetch('/api/watched-episodes?limit=100', { credentials: 'include' }),
  )
  return body.items
}

export async function listWatchedEpisodes(showId: number): Promise<WatchedEpisodeRow[]> {
  return json(await fetch(`/api/watched-episodes/${showId}`, { credentials: 'include' }))
}

export async function markEpisode(input: MarkEpisodeInput): Promise<void> {
  await json<{ ok: true }>(await fetch('/api/watched-episodes', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))
}

export async function unmarkEpisode(showId: number, season: number, episode: number): Promise<void> {
  await json<{ ok: true }>(await fetch(`/api/watched-episodes/${showId}/${season}/${episode}`, {
    method: 'DELETE',
    credentials: 'include',
  }))
}

export async function markSeason(
  show: { show_id: number; show_name: string; show_poster_path?: string | null },
  season: number,
  episodes: { number: number; name?: string | null }[],
): Promise<void> {
  await json<{ ok: true; count: number }>(await fetch('/api/watched-episodes/bulk', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      show_id: show.show_id,
      show_name: show.show_name,
      show_poster_path: show.show_poster_path ?? null,
      season_number: season,
      episodes,
    }),
  }))
}

export async function unmarkSeason(showId: number, season: number): Promise<void> {
  await json<{ ok: true }>(await fetch(`/api/watched-episodes/${showId}/${season}`, {
    method: 'DELETE',
    credentials: 'include',
  }))
}

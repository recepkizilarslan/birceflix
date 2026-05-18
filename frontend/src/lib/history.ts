export interface WatchHistoryEntry {
  id: string
  user_id: string
  tmdb_id: number
  watched_at: string
  my_rating: number | null
  notes: string | null
}

export interface AddHistoryInput {
  tmdb_id: number
  watched_at?: string
  my_rating?: number | null
  notes?: string | null
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.url} -> ${res.status}`)
  return res.json() as Promise<T>
}

export async function listHistory(tmdbId: number): Promise<WatchHistoryEntry[]> {
  return json(await fetch(`/api/history/${tmdbId}`, { credentials: 'include' }))
}

export async function addHistory(input: AddHistoryInput): Promise<WatchHistoryEntry> {
  return json(await fetch('/api/history', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))
}

export async function deleteHistory(id: string): Promise<void> {
  await json<{ ok: true }>(await fetch(`/api/history/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  }))
}

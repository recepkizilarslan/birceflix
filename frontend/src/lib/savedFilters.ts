import type { FilterState, MediaType } from '../components/FilterPanel'

export interface SavedFilter {
  id: string
  user_id: string
  name: string
  description: string | null
  media_type: MediaType
  filters: FilterState
  created_at: string
  updated_at: string
}

export interface CreateSavedFilterInput {
  name: string
  description?: string | null
  media_type: MediaType
  filters: FilterState
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.url} -> ${res.status}`)
  return res.json() as Promise<T>
}

export async function listSavedFilters(): Promise<SavedFilter[]> {
  return json(await fetch('/api/saved-filters', { credentials: 'include' }))
}

export async function createSavedFilter(input: CreateSavedFilterInput): Promise<SavedFilter> {
  return json(await fetch('/api/saved-filters', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))
}

export async function deleteSavedFilter(id: string): Promise<void> {
  await json<{ ok: true }>(await fetch(`/api/saved-filters/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  }))
}

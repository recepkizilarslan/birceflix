import { DEFAULT_FILTERS, type FilterState, type MediaType } from '../components/FilterPanel'

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

/**
 * Backfill any keys missing from a stored snapshot with the current
 * DEFAULT_FILTERS values. The backend persists `filters` as opaque jsonb
 * (no schema_version yet), so a snapshot saved before, say, watched_filter
 * was introduced will load with that key undefined. Spreading defaults
 * first then the saved payload keeps the user's explicit choices while
 * filling in fields the older FilterState shape didn't know about.
 *
 * Centralised here so any future FilterState evolution only needs to add
 * a default to DEFAULT_FILTERS to get free backward compatibility.
 */
export function normalizeSavedFilters(raw: unknown): FilterState {
  // We trust the structure to be an object (zod on the backend enforces
  // record-shape) but every individual field could be missing or wrong-typed.
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<FilterState>
  return { ...DEFAULT_FILTERS, ...r }
}

export async function listSavedFilters(): Promise<SavedFilter[]> {
  const rows = await json<SavedFilter[]>(await fetch('/api/saved-filters', { credentials: 'include' }))
  return rows.map((r) => ({ ...r, filters: normalizeSavedFilters(r.filters) }))
}

export async function createSavedFilter(input: CreateSavedFilterInput): Promise<SavedFilter> {
  const created = await json<SavedFilter>(await fetch('/api/saved-filters', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))
  return { ...created, filters: normalizeSavedFilters(created.filters) }
}

export async function deleteSavedFilter(id: string): Promise<void> {
  await json<{ ok: true }>(await fetch(`/api/saved-filters/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  }))
}

export interface ListSummary {
  id: string
  user_id: string
  name: string
  description: string | null
  is_public: boolean
  public_slug: string | null
  created_at: string
  updated_at: string
  item_count?: number
}

export interface ListItem {
  list_id: string
  tmdb_id: number
  /** 'movie' | 'tv'. Drives detail-page routing — without this a TV-show
   * tmdb_id would silently navigate to /movie/<same id>, which is a
   * completely different work in TMDB's namespace. */
  media_type: 'movie' | 'tv'
  title: string
  poster_path: string | null
  position: number
  added_at: string
}

export interface ListWithItems extends ListSummary {
  items: ListItem[]
  owner_name?: string
}

export interface CreateListInput {
  name: string
  description?: string | null
  is_public?: boolean
}

export interface UpdateListInput {
  name?: string
  description?: string | null
  is_public?: boolean
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.url} -> ${res.status}`)
  return res.json() as Promise<T>
}

export async function listLists(): Promise<ListSummary[]> {
  return json(await fetch('/api/lists', { credentials: 'include' }))
}

export async function createList(input: CreateListInput): Promise<ListSummary> {
  return json(await fetch('/api/lists', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))
}

export async function getList(id: string): Promise<ListWithItems> {
  return json(await fetch(`/api/lists/${id}`, { credentials: 'include' }))
}

export async function updateList(id: string, patch: UpdateListInput): Promise<ListSummary> {
  return json(await fetch(`/api/lists/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  }))
}

export async function deleteList(id: string): Promise<void> {
  await json<{ ok: true }>(await fetch(`/api/lists/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  }))
}

export async function addToList(
  listId: string,
  item: {
    tmdb_id: number
    media_type: 'movie' | 'tv'
    title: string
    poster_path?: string | null
  },
): Promise<void> {
  await json<{ ok: true }>(await fetch(`/api/lists/${listId}/items`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(item),
  }))
}

export async function removeFromList(
  listId: string,
  tmdbId: number,
  mediaType: 'movie' | 'tv',
): Promise<void> {
  // media_type goes in the query string so the URL stays clean; the backend
  // needs it because (list_id, tmdb_id, media_type) is the composite key.
  const qs = new URLSearchParams({ media_type: mediaType })
  await json<{ ok: true }>(await fetch(`/api/lists/${listId}/items/${tmdbId}?${qs}`, {
    method: 'DELETE',
    credentials: 'include',
  }))
}

export async function getPublicList(slug: string): Promise<ListWithItems> {
  return json(await fetch(`/api/public/lists/${slug}`))
}

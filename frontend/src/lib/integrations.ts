export interface TraktStatus {
  configured: boolean
  connected: boolean
  last_sync_at: string | null
}

export interface TraktImportResult {
  imported: number
  skipped_no_tmdb: number
  pages_read: number
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.url} -> ${res.status}`)
  return res.json() as Promise<T>
}

export async function getTraktStatus(): Promise<TraktStatus> {
  return json(await fetch('/api/integrations/trakt/status', { credentials: 'include' }))
}

export function startTraktConnect() {
  window.location.href = '/api/integrations/trakt/connect'
}

export async function disconnectTrakt(): Promise<void> {
  await json<{ ok: true }>(await fetch('/api/integrations/trakt/disconnect', {
    method: 'POST',
    credentials: 'include',
  }))
}

export async function importTraktHistory(): Promise<TraktImportResult> {
  return json(await fetch('/api/integrations/trakt/import-history', {
    method: 'POST',
    credentials: 'include',
  }))
}

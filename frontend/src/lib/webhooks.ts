export interface WebhookTokenRow {
  id: string
  label: string
  /** Only set on creation responses; null on subsequent list reads. */
  token: string | null
  token_suffix: string
  last_used_at: string | null
  created_at: string
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.url} -> ${res.status}`)
  return res.json() as Promise<T>
}

export async function listWebhookTokens(): Promise<WebhookTokenRow[]> {
  return json(await fetch('/api/webhooks', { credentials: 'include' }))
}

export async function createWebhookToken(label: string): Promise<WebhookTokenRow> {
  return json(await fetch('/api/webhooks', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ label }),
  }))
}

export async function deleteWebhookToken(id: string): Promise<void> {
  await json<{ ok: true }>(await fetch(`/api/webhooks/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  }))
}

export function scrobbleUrl(token: string): string {
  return `${window.location.origin}/api/webhooks/scrobble/${token}`
}

/**
 * Trakt.tv API client + OAuth helpers.
 *
 * Docs: https://trakt.docs.apiary.io/
 *
 * Trakt is optional — only available when TRAKT_CLIENT_ID, TRAKT_CLIENT_SECRET
 * and TRAKT_REDIRECT_URI are all set. Routes guard with `traktConfigured()`.
 */
import { env } from '../env.js'

const API = 'https://api.trakt.tv'
const AUTH = 'https://trakt.tv/oauth/authorize'

export function traktConfigured(): boolean {
  return !!(env.TRAKT_CLIENT_ID && env.TRAKT_CLIENT_SECRET && env.TRAKT_REDIRECT_URI)
}

export function authorizationUrl(state: string): string {
  if (!traktConfigured()) throw new Error('trakt not configured')
  const u = new URL(AUTH)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', env.TRAKT_CLIENT_ID!)
  u.searchParams.set('redirect_uri', env.TRAKT_REDIRECT_URI!)
  u.searchParams.set('state', state)
  return u.toString()
}

export interface TraktTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  created_at: number
  token_type: 'bearer'
  scope: string
}

export async function exchangeCode(code: string): Promise<TraktTokens> {
  return postToken({
    code,
    client_id: env.TRAKT_CLIENT_ID!,
    client_secret: env.TRAKT_CLIENT_SECRET!,
    redirect_uri: env.TRAKT_REDIRECT_URI!,
    grant_type: 'authorization_code',
  })
}

export async function refreshAccessToken(refresh_token: string): Promise<TraktTokens> {
  return postToken({
    refresh_token,
    client_id: env.TRAKT_CLIENT_ID!,
    client_secret: env.TRAKT_CLIENT_SECRET!,
    redirect_uri: env.TRAKT_REDIRECT_URI!,
    grant_type: 'refresh_token',
  })
}

async function postToken(body: Record<string, string>): Promise<TraktTokens> {
  const res = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`trakt token endpoint -> ${res.status} ${await res.text().catch(() => '')}`)
  return (await res.json()) as TraktTokens
}

export interface TraktHistoryItem {
  id: number
  watched_at: string
  action: 'scrobble' | 'checkin' | 'watch'
  type: 'movie' | 'episode'
  movie?: {
    title: string
    year: number | null
    ids: { trakt: number; slug: string; imdb?: string; tmdb?: number }
  }
}

/**
 * Fetch one page of movie history. Trakt returns total count via
 * `x-pagination-page-count` and `x-pagination-item-count` headers.
 */
export async function getHistoryPage(
  accessToken: string,
  page: number,
  limit = 100,
): Promise<{ items: TraktHistoryItem[]; totalPages: number }> {
  const u = new URL(`${API}/sync/history/movies`)
  u.searchParams.set('page', String(page))
  u.searchParams.set('limit', String(limit))
  const res = await fetch(u, {
    headers: {
      'content-type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': env.TRAKT_CLIENT_ID!,
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (!res.ok) throw new Error(`trakt /sync/history -> ${res.status}`)
  const items = (await res.json()) as TraktHistoryItem[]
  const totalPages = parseInt(res.headers.get('x-pagination-page-count') ?? '1', 10)
  return { items, totalPages }
}

/**
 * The token is valid if expires_at is at least 60s in the future.
 * Returns a refreshed token if we had to refresh.
 */
export function tokenIsFresh(expiresAt: Date | null): boolean {
  if (!expiresAt) return false
  return expiresAt.getTime() > Date.now() + 60_000
}

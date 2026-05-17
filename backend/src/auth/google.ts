import { Google, generateState, generateCodeVerifier } from 'arctic'
import { env } from '../env.js'

export const google = new Google(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI,
)

export { generateState, generateCodeVerifier }

export interface GoogleUserInfo {
  sub: string
  email: string
  email_verified: boolean
  name?: string
  picture?: string
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`google userinfo -> ${res.status}`)
  return (await res.json()) as GoogleUserInfo
}

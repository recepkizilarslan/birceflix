import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto'
import { eq, lt } from 'drizzle-orm'
import { db } from '../db/client.js'
import { sessions, users } from '../db/schema.js'
import { env } from '../env.js'

const TTL_MS = env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000

function newSessionId(): string {
  return randomBytes(32).toString('base64url')
}

function sign(id: string): string {
  return createHmac('sha256', env.SESSION_SECRET).update(id).digest('base64url')
}

/** Encode for the cookie: `<id>.<sig>` */
export function cookieValue(id: string): string {
  return `${id}.${sign(id)}`
}

/** Verify the cookie HMAC and return the raw session id, or null on tampering. */
export function parseCookie(raw: string): string | null {
  const dot = raw.lastIndexOf('.')
  if (dot < 1) return null
  const id = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  const expected = sign(id)
  if (sig.length !== expected.length) return null
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null
  }
  return id
}

export async function createSession(userId: string) {
  const id = newSessionId()
  const expiresAt = new Date(Date.now() + TTL_MS)
  await db.insert(sessions).values({ id, userId, expiresAt })
  return { id, expiresAt }
}

export async function readSession(id: string) {
  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id))
    .limit(1)

  if (!row) return null
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, id))
    return null
  }
  return row
}

export async function deleteSession(id: string) {
  await db.delete(sessions).where(eq(sessions.id, id))
}

/** Optional cleanup job — call from a cron or on boot. */
export async function purgeExpired() {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
}

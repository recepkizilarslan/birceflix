/**
 * scrypt-based password hashing using Node's built-in crypto. No external
 * dep — bcrypt/argon2 are nicer in production but each adds a native
 * compile step we don't need for a single-tenant app.
 *
 * Stored format: "<hex-salt>:<hex-derived>". Constant-time verification.
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>

const KEY_LEN = 64
const SALT_LEN = 16

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LEN)
  const derived = await scryptAsync(plain, salt, KEY_LEN)
  return `${salt.toString('hex')}:${derived.toString('hex')}`
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [saltHex, derivedHex] = stored.split(':')
  if (!saltHex || !derivedHex) return false
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(derivedHex, 'hex')
  const candidate = await scryptAsync(plain, salt, expected.length)
  // Length check guards timingSafeEqual which throws if the lengths differ.
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}

/**
 * Server-side password policy. Enforced on /api/auth/register and on any
 * future "change password" endpoint. The client mirrors the rules in
 * SignInScreen for instant feedback but the server is the source of
 * truth — never trust the browser.
 *
 * Rules:
 *  - 10-200 chars
 *  - Must contain at least 3 of: lowercase, uppercase, digit, symbol
 *  - Must not equal the user's email or the local-part of it
 *  - Must not be in the small built-in common-password list below
 */

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword',
  'qwerty', 'qwerty123', 'qwertyuiop', 'azerty', 'asdfghjkl',
  '123456', '1234567', '12345678', '123456789', '1234567890', '12345',
  '111111', '000000', '654321', 'abc123', 'abcd1234', '1q2w3e4r', '1qaz2wsx',
  'letmein', 'welcome', 'welcome1', 'admin', 'admin123', 'administrator',
  'root', 'toor', 'login', 'master', 'superman', 'batman', 'dragon',
  'iloveyou', 'monkey', 'sunshine', 'princess', 'football', 'baseball',
  'starwars', 'hello123', 'changeme', 'trustno1', 'birceflix', 'netflix',
])

export type PasswordPolicyError =
  | 'too_short'
  | 'too_long'
  | 'too_simple'
  | 'too_common'
  | 'matches_email'

export function checkPasswordPolicy(password: string, email: string): PasswordPolicyError | null {
  if (password.length < 10) return 'too_short'
  if (password.length > 200) return 'too_long'

  const lower = password.toLowerCase()
  if (COMMON_PASSWORDS.has(lower)) return 'too_common'

  const emailLower = email.toLowerCase()
  const localPart = emailLower.split('@')[0] ?? ''
  if (lower === emailLower || (localPart.length >= 4 && lower === localPart)) {
    return 'matches_email'
  }

  const classes =
    (/[a-z]/.test(password) ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[0-9]/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0)
  if (classes < 3) return 'too_simple'

  return null
}

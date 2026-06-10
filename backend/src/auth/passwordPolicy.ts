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
 */

export type PasswordPolicyError =
  | 'too_short'
  | 'too_long'
  | 'too_simple'
  | 'matches_email'

export function checkPasswordPolicy(password: string, email: string): PasswordPolicyError | null {
  if (password.length < 10) return 'too_short'
  if (password.length > 200) return 'too_long'

  const lower = password.toLowerCase()

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

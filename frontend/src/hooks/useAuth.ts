import { useEffect, useState } from 'react'
import { getMe, type User } from '../lib/auth'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    getMe()
      .then((u) => { if (mounted) setUser(u) })
      .catch(() => { if (mounted) setUser(null) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const signInWithGoogle = (next?: string) => {
    // Backend Google OAuth start endpoint — it 302s to Google then back to us.
    // `next` is preserved across the round-trip via an httpOnly cookie set by
    // the backend; we forward it through the query string here. Same-origin
    // validation happens on both ends.
    const qs = next ? `?next=${encodeURIComponent(next)}` : ''
    window.location.href = `/api/auth/google${qs}`
    return Promise.resolve()
  }

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    // Hard reload to '/'. Each useAuth() call has its own state, so
    // setUser(null) here only clears one instance — Layout would still
    // think the user is signed in until its own /me probe re-fires.
    // The reload kicks everything (including the gate in Layout) into
    // a clean unauth state.
    window.location.href = '/'
  }

  return { user, loading, signInWithGoogle, signOut }
}

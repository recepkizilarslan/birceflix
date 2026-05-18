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

  const signInWithGoogle = () => {
    // Backend Google OAuth start endpoint — it 302s to Google then back to us
    window.location.href = '/api/auth/google'
    return Promise.resolve()
  }

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
  }

  return { user, loading, signInWithGoogle, signOut }
}

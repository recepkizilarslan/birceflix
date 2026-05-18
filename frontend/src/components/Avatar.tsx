import { useState } from 'react'
import { initials, type User } from '../lib/auth'

interface Props {
  user: Pick<User, 'first_name' | 'last_name' | 'name' | 'email' | 'avatar_url'>
  /** Tailwind size class — defaults to w-8 h-8. */
  size?: string
  className?: string
}

/**
 * Circular user avatar. Falls back to initials over an accent background
 * if there's no avatar_url or the image fails to load.
 */
export function Avatar({ user, size = 'w-8 h-8', className = '' }: Props) {
  const [broken, setBroken] = useState(false)
  const src = user.avatar_url && !broken ? user.avatar_url : null

  return (
    <div
      className={`${size} ${className} rounded-full bg-[var(--color-accent)]/20 border border-[var(--color-border)] overflow-hidden flex items-center justify-center text-[10px] font-semibold text-[var(--color-accent)] shrink-0`}
      aria-hidden="true"
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{initials(user)}</span>
      )}
    </div>
  )
}

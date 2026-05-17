import { useState } from 'react'

interface Props {
  onSearch: (q: string) => void
  onClear: () => void
}

export function SearchBar({ onSearch, onClear }: Props) {
  const [q, setQ] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const v = q.trim()
        if (v) onSearch(v)
        else onClear()
      }}
      className="flex gap-2"
    >
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Film ara… (Inception, Yüzüklerin Efendisi…)"
        className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 focus:outline-none focus:border-[var(--color-accent)]"
      />
      <button type="submit" className="px-5 py-2.5 rounded-lg bg-[var(--color-accent)] text-black font-medium hover:opacity-90">
        Ara
      </button>
      {q && (
        <button
          type="button"
          onClick={() => { setQ(''); onClear() }}
          className="px-3 py-2.5 rounded-lg bg-[var(--color-surface-2)] hover:bg-[var(--color-border)]"
        >
          Temizle
        </button>
      )}
    </form>
  )
}

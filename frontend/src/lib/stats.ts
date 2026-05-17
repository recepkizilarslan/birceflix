export interface Stats {
  total_watched: number
  total_viewings: number
  rating_distribution: number[]
  viewings_by_month: { month: string; count: number }[]
  viewings_by_year: { year: number; count: number }[]
  top_locations: { location: string; count: number }[]
  watched_by_year: { year: number; count: number }[]
}

export async function getStats(): Promise<Stats> {
  const res = await fetch('/api/stats', { credentials: 'include' })
  if (!res.ok) throw new Error(`stats -> ${res.status}`)
  return res.json() as Promise<Stats>
}

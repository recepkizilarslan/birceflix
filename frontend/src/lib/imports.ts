export interface ImportReport {
  total: number
  matched: number
  unmatched: { name: string; year: number | null; reason: string }[]
}

async function postCsv(url: string, file: File): Promise<ImportReport> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(url, { method: 'POST', credentials: 'include', body: fd })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return res.json() as Promise<ImportReport>
}

export const importLetterboxdWatched = (file: File) =>
  postCsv('/api/import/letterboxd/watched', file)

export const importLetterboxdDiary = (file: File) =>
  postCsv('/api/import/letterboxd/diary', file)

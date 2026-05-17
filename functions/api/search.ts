import { tmdb, json, err, type Env } from './_shared'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const u = new URL(request.url)
  const q = u.searchParams.get('q')
  if (!q) return err('q required', 400)
  try {
    const data = await tmdb(env, '/search/movie', {
      query: q,
      language: u.searchParams.get('ui_language') ?? 'en-US',
      page: u.searchParams.get('page') ?? '1',
      include_adult: 'false',
    })
    return json(data)
  } catch (e: any) {
    return err(e.message ?? 'search failed')
  }
}

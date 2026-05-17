import { tmdb, json, err, type Env } from './_shared'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const u = new URL(request.url)
  try {
    const data = await tmdb(env, '/genre/movie/list', {
      language: u.searchParams.get('ui_language') ?? 'en-US',
    }) as any
    return json(data.genres ?? [])
  } catch (e: any) {
    return err(e.message ?? 'genres failed')
  }
}

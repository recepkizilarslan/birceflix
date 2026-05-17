import { tmdb, json, err, type Env } from './_shared'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const u = new URL(request.url)
  const region = u.searchParams.get('region') ?? 'TR'
  try {
    const data = await tmdb(env, '/watch/providers/movie', {
      language: u.searchParams.get('ui_language') ?? 'en-US',
      watch_region: region,
    }) as any
    return json(data.results ?? [])
  } catch (e: any) {
    return err(e.message ?? 'providers failed')
  }
}

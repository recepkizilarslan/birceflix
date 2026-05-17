import { tmdb, omdb, json, err, type Env } from '../_shared'

export const onRequestGet: PagesFunction<Env> = async ({ params, request, env }) => {
  const id = params.id as string
  const u = new URL(request.url)
  const region = u.searchParams.get('region') ?? 'TR'
  const uiLang = u.searchParams.get('ui_language') ?? 'en-US'

  try {
    const detail = await tmdb(env, `/movie/${id}`, {
      language: uiLang,
      append_to_response: 'watch/providers,reviews,credits,videos',
    }) as any

    let omdbData: any = null
    if (detail.imdb_id) {
      try {
        omdbData = await omdb(env, { i: detail.imdb_id, plot: 'short' })
      } catch {}
    }

    const watchProviders = detail['watch/providers']?.results?.[region] ?? null

    return json({
      ...detail,
      omdb: omdbData,
      awards: omdbData?.Awards && omdbData.Awards !== 'N/A' ? omdbData.Awards : null,
      imdb_rating: omdbData?.imdbRating && omdbData.imdbRating !== 'N/A' ? omdbData.imdbRating : null,
      watch_providers: watchProviders,
    })
  } catch (e: any) {
    return err(e.message ?? 'movie detail failed')
  }
}

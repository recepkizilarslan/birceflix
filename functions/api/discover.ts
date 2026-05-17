import { tmdb, json, err, type Env } from './_shared'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const u = new URL(request.url)
  const p = u.searchParams
  const sortBy = p.get('sort_by') ?? 'popularity.desc'
  // Only apply a vote_count floor when sorting by rating — otherwise high-rated
  // films with only a handful of votes dominate. For other sorts we don't filter
  // by vote count, so smaller markets (Hindi, Turkish, etc.) aren't cut off.
  const defaultMinVotes = sortBy.startsWith('vote_average') ? '200' : undefined
  try {
    const data = await tmdb(env, '/discover/movie', {
      language: p.get('ui_language') ?? 'en-US',
      sort_by: sortBy,
      page: p.get('page') ?? '1',
      'vote_average.gte': p.get('min_rating') ?? undefined,
      'vote_count.gte': p.get('min_votes') ?? defaultMinVotes,
      with_original_language: p.get('original_language') ?? undefined,
      with_origin_country: p.get('origin_country') ?? undefined,
      with_genres: p.get('with_genres') ?? undefined,
      'primary_release_date.gte': p.get('year_from') ? `${p.get('year_from')}-01-01` : undefined,
      'primary_release_date.lte': p.get('year_to') ? `${p.get('year_to')}-12-31` : undefined,
      with_watch_providers: p.get('with_watch_providers') ?? undefined,
      watch_region: p.get('watch_region') ?? undefined,
      'with_runtime.gte': p.get('runtime_from') ?? undefined,
      'with_runtime.lte': p.get('runtime_to') ?? undefined,
      include_adult: 'false',
    })
    return json(data)
  } catch (e: any) {
    return err(e.message ?? 'discover failed')
  }
}

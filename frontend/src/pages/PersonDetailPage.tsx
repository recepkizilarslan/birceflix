import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  getPerson,
  poster,
  type PersonDetail,
  type PersonMovieCrewCredit,
  type PersonTvCrewCredit,
} from '../lib/api'
import { fmtDate } from '../lib/intl'
import { safeExternalUrl } from '../lib/url'

const PROFILE_BASE = 'https://image.tmdb.org/t/p/h632'

/**
 * Profile page for a TMDB person. Backed by a single /api/person/:id
 * round-trip which uses append_to_response to pull movie_credits +
 * tv_credits + external_ids together, so opening the page costs exactly
 * one TMDB call regardless of how prolific the actor is.
 *
 * Filmography is split into four buckets (movie cast / movie crew / TV
 * cast / TV crew). Crew jobs are grouped so a director who also wrote and
 * produced shows up under one consolidated heading per title rather than
 * three separate rows.
 */
export function PersonDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [p, setP] = useState<PersonDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [bioOpen, setBioOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    setP(null)
    setErr(null)
    setBioOpen(false)
    getPerson(Number(id))
      .then(setP)
      .catch((e: Error) => setErr(e.message))
  }, [id, i18n.language])

  // Sort buckets by release date desc so the most recent work is on top.
  // Empty / future dates sink to the bottom rather than sort to "0000".
  const movieCast = useMemo(() => sortMoviesNewest(p?.movie_cast ?? []), [p?.movie_cast])
  const movieCrew = useMemo(() => groupCrewByMovie(p?.movie_crew ?? []), [p?.movie_crew])
  const tvCast = useMemo(() => sortTvNewest(p?.tv_cast ?? []), [p?.tv_cast])
  const tvCrew = useMemo(() => groupCrewByTv(p?.tv_crew ?? []), [p?.tv_crew])

  if (err) return <div className="text-red-400">{err}</div>
  if (!p) return <div className="py-16 text-center text-[var(--color-text-dim)]">{t('common.loading')}</div>

  const profileSrc = p.profile_path ? `${PROFILE_BASE}${p.profile_path}` : null

  return (
    <div>
      <button
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/discover'))}
        className="mb-4 text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
      >
        {t('common.back')}
      </button>

      <div className="flex flex-col sm:flex-row gap-5 sm:gap-7 mb-6 sm:mb-8">
        <div className="w-40 sm:w-56 mx-auto sm:mx-0 shrink-0">
          {profileSrc ? (
            <img src={profileSrc} alt="" className="w-full rounded-xl shadow-2xl object-cover" />
          ) : (
            <div className="w-full aspect-[2/3] rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center text-xs text-[var(--color-text-dim)]">
              {t('person.noPhoto')}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3 min-w-0">
          <div>
            <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight leading-tight break-words">{p.name}</h1>
            {p.known_for_department && (
              <div className="text-sm text-[var(--color-text-dim)] mt-1">{p.known_for_department}</div>
            )}
          </div>

          <div className="text-sm space-y-1 text-[var(--color-text-dim)]">
            {p.birthday && (
              <div>
                <span>{t('person.born')}: </span>
                <span className="text-[var(--color-text)]">{fmtDate(p.birthday)}</span>
                {p.place_of_birth && <span className="text-[var(--color-text)]"> {`(${p.place_of_birth})`}</span>}
              </div>
            )}
            {p.deathday && (
              <div>
                <span>{t('person.died')}: </span>
                <span className="text-[var(--color-text)]">{fmtDate(p.deathday)}</span>
              </div>
            )}
            {p.also_known_as.length > 0 && (
              <div className="text-xs">
                <span>{t('person.alsoKnownAs')}: </span>
                <span className="text-[var(--color-text)]">{p.also_known_as.slice(0, 4).join(', ')}</span>
              </div>
            )}
          </div>

          {/* Cross-links: pin into the People filter on Discover, IMDB,
              personal homepage. Linking back to discover with this person
              pre-selected is the highest-value action - it turns the
              profile into a launchpad for "more from this person". */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link
              to={`/discover?pe=${p.id}`}
              className="h-9 px-3 inline-flex items-center text-sm rounded-lg bg-[var(--color-accent)] text-black font-medium hover:opacity-90"
            >
              {t('person.filterDiscover')}
            </Link>
            {p.imdb_id && (
              <a
                href={`https://www.imdb.com/name/${p.imdb_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-3 inline-flex items-center text-sm text-[var(--color-accent)] hover:underline"
              >
                {t('person.imdbProfile')}
              </a>
            )}
            {safeExternalUrl(p.homepage) && (
              <a
                href={safeExternalUrl(p.homepage)}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-3 inline-flex items-center text-sm text-[var(--color-accent)] hover:underline"
              >
                {t('person.homepage')}
              </a>
            )}
          </div>
        </div>
      </div>

      {p.biography && (
        <Section title={t('person.biography')}>
          <div className={`text-sm leading-relaxed whitespace-pre-line ${bioOpen ? '' : 'line-clamp-6'}`}>
            {p.biography}
          </div>
          {p.biography.length > 480 && (
            <button
              onClick={() => setBioOpen((v) => !v)}
              className="mt-2 text-xs text-[var(--color-accent)] hover:underline"
            >
              {bioOpen ? t('person.bioCollapse') : t('person.bioExpand')}
            </button>
          )}
        </Section>
      )}

      {movieCast.length > 0 && (
        <Section title={t('person.actingMovies', { count: movieCast.length })}>
          <CreditGrid items={movieCast.map((c) => ({
            id: c.id,
            href: `/movie/${c.id}`,
            title: c.title,
            poster_path: c.poster_path,
            year: c.release_date?.slice(0, 4) ?? '',
            subtitle: c.character ?? '',
          }))} />
        </Section>
      )}

      {tvCast.length > 0 && (
        <Section title={t('person.actingTv', { count: tvCast.length })}>
          <CreditGrid items={tvCast.map((c) => ({
            id: c.id,
            href: `/tv/${c.id}`,
            title: c.name,
            poster_path: c.poster_path,
            year: c.first_air_date?.slice(0, 4) ?? '',
            subtitle: [c.character, c.episode_count ? t('person.episodesShort', { count: c.episode_count }) : null].filter(Boolean).join(' · '),
          }))} />
        </Section>
      )}

      {movieCrew.length > 0 && (
        <Section title={t('person.crewMovies', { count: movieCrew.length })}>
          <CreditGrid items={movieCrew.map((c) => ({
            id: c.id,
            href: `/movie/${c.id}`,
            title: c.title,
            poster_path: c.poster_path,
            year: c.release_date?.slice(0, 4) ?? '',
            subtitle: c.jobs.join(', '),
          }))} />
        </Section>
      )}

      {tvCrew.length > 0 && (
        <Section title={t('person.crewTv', { count: tvCrew.length })}>
          <CreditGrid items={tvCrew.map((c) => ({
            id: c.id,
            href: `/tv/${c.id}`,
            title: c.name,
            poster_path: c.poster_path,
            year: c.first_air_date?.slice(0, 4) ?? '',
            subtitle: c.jobs.join(', '),
          }))} />
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xs uppercase tracking-wider text-[var(--color-text-dim)] mb-3">{title}</h2>
      {children}
    </section>
  )
}

interface CreditCard {
  id: number
  href: string
  title: string
  poster_path: string | null
  year: string
  subtitle: string
}

/** Compact poster grid for filmography sections. Year + role line keeps the
 *  cards self-explanatory at small sizes; no hover affordance because each
 *  card is the whole link target. */
function CreditGrid({ items }: { items: CreditCard[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3">
      {items.map((it) => (
        <Link
          key={`${it.href}-${it.id}`}
          to={it.href}
          className="group rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition flex flex-col"
        >
          <div className="relative aspect-[2/3] bg-[var(--color-surface-2)]">
            {poster(it.poster_path, 'w342') ? (
              <img src={poster(it.poster_path, 'w342')!} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-[var(--color-text-dim)] p-2 text-center">
                {it.title}
              </div>
            )}
          </div>
          <div className="p-2.5 flex-1 flex flex-col">
            <div className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-[var(--color-accent)] transition">
              {it.title}
            </div>
            <div className="mt-1 text-xs text-[var(--color-text-dim)] line-clamp-2">
              {[it.year, it.subtitle].filter(Boolean).join(' · ')}
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

function sortMoviesNewest<T extends { release_date: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''))
}

function sortTvNewest<T extends { first_air_date: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (b.first_air_date ?? '').localeCompare(a.first_air_date ?? ''))
}

interface GroupedMovieCrew extends Omit<PersonMovieCrewCredit, 'job' | 'department'> {
  jobs: string[]
}

/** Collapse multiple crew rows for the same movie ("Director" + "Writer"
 *  for the same title) into one entry with a comma-joined jobs list. */
function groupCrewByMovie(rows: PersonMovieCrewCredit[]): GroupedMovieCrew[] {
  const map = new Map<number, GroupedMovieCrew>()
  for (const r of rows) {
    const existing = map.get(r.id)
    const job = r.job ?? ''
    if (existing) {
      if (job && !existing.jobs.includes(job)) existing.jobs.push(job)
      continue
    }
    map.set(r.id, {
      id: r.id,
      title: r.title,
      poster_path: r.poster_path,
      release_date: r.release_date,
      vote_average: r.vote_average,
      jobs: job ? [job] : [],
    })
  }
  return sortMoviesNewest([...map.values()])
}

interface GroupedTvCrew extends Omit<PersonTvCrewCredit, 'job' | 'department'> {
  jobs: string[]
}

function groupCrewByTv(rows: PersonTvCrewCredit[]): GroupedTvCrew[] {
  const map = new Map<number, GroupedTvCrew>()
  for (const r of rows) {
    const existing = map.get(r.id)
    const job = r.job ?? ''
    if (existing) {
      if (job && !existing.jobs.includes(job)) existing.jobs.push(job)
      continue
    }
    map.set(r.id, {
      id: r.id,
      name: r.name,
      poster_path: r.poster_path,
      first_air_date: r.first_air_date,
      vote_average: r.vote_average,
      episode_count: r.episode_count,
      jobs: job ? [job] : [],
    })
  }
  return sortTvNewest([...map.values()])
}

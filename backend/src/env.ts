import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().url(),

  // Session
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 chars'),
  SESSION_COOKIE_NAME: z.string().default('birceflix_session'),
  SESSION_TTL_DAYS: z.coerce.number().default(30),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url(),

  // Third-party APIs (server-side only)
  TMDB_API_KEY: z.string().min(1),
  OMDB_API_KEY: z.string().min(1),

  // Trakt — optional. Set all three (or none) to enable Trakt import.
  TRAKT_CLIENT_ID: z.string().optional(),
  TRAKT_CLIENT_SECRET: z.string().optional(),
  TRAKT_REDIRECT_URI: z.string().url().or(z.literal('')).optional(),

  // Frontend origin (for CORS in dev; in prod the reverse proxy makes this same-origin)
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),

  // Defaults
  DEFAULT_WATCH_REGION: z.string().length(2).default('TR'),

  // Top-movies page. Sourced from TMDB's `/movie/top_rated` (paginated,
  // 20 results per page). 200 movies = 10 pages; 500 is the hard cap from
  // TMDB anyway.
  IMDB_TOP_LIMIT: z.coerce.number().int().positive().max(500).default(200),
})

export type Env = z.infer<typeof schema>

export const env: Env = schema.parse(process.env)

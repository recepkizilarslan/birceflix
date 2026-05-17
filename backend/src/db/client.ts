import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { env } from '../env.js'
import * as schema from './schema.js'

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
})

export const db = drizzle(pool, { schema })
export type DB = typeof db

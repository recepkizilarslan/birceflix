/**
 * Lightweight SQL migration runner.
 *
 * - Reads every `*.sql` file in ./migrations (lexical order = filename order).
 * - Splits on `--> statement-breakpoint` (compatible with drizzle-kit output).
 * - Tracks applied filenames in a `_migrations` table.
 * - Wraps each migration in a single transaction.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { env } from '../env.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, 'migrations')

async function run() {
  const client = new pg.Client({ connectionString: env.DATABASE_URL })
  await client.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    const { rows: applied } = await client.query<{ name: string }>('SELECT name FROM _migrations')
    const appliedSet = new Set(applied.map((r) => r.name))

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`✓ already applied: ${file}`)
        continue
      }
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
      const statements = sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean)

      console.log(`→ applying ${file} (${statements.length} statements)`)
      await client.query('BEGIN')
      try {
        for (const stmt of statements) {
          await client.query(stmt)
        }
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
        console.log(`  ✔ ${file}`)
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      }
    }
  } finally {
    await client.end()
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

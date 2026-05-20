import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { savedFilters } from '../db/schema.js'

const idParam = z.object({ id: z.string().uuid() })

const mediaTypeEnum = z.enum(['movie', 'tv', 'doc'])

// The `filters` payload is opaque to the backend — the frontend owns the
// FilterState shape. We just require it to be a JSON object (not array /
// scalar) so it round-trips cleanly through jsonb.
const createBody = z.object({
  name: z.string().min(1).max(120).trim(),
  description: z.string().max(500).nullable().optional(),
  media_type: mediaTypeEnum,
  filters: z.record(z.string(), z.unknown()).refine(
    (v) => JSON.stringify(v).length <= 10_000,
    'filter payload too large'
  ),
})

function serialise(row: typeof savedFilters.$inferSelect) {
  return {
    id: row.id,
    user_id: row.userId,
    name: row.name,
    description: row.description,
    media_type: row.mediaType,
    filters: row.filters,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}

export async function savedFiltersRoutes(app: FastifyInstance) {
  app.get('/api/saved-filters', async (req) => {
    const userId = await app.requireAuth(req)
    const rows = await db
      .select()
      .from(savedFilters)
      .where(eq(savedFilters.userId, userId))
      .orderBy(desc(savedFilters.createdAt))
    return rows.map(serialise)
  })

  app.post('/api/saved-filters', async (req) => {
    const userId = await app.requireAuth(req)
    const body = createBody.parse(req.body)
    const [row] = await db
      .insert(savedFilters)
      .values({
        userId,
        name: body.name,
        description: body.description ?? null,
        mediaType: body.media_type,
        filters: body.filters,
      })
      .returning()
    return serialise(row!)
  })

  app.delete('/api/saved-filters/:id', async (req, reply) => {
    const userId = await app.requireAuth(req)
    const { id } = idParam.parse(req.params)
    const result = await db
      .delete(savedFilters)
      .where(and(eq(savedFilters.id, id), eq(savedFilters.userId, userId)))
      .returning({ id: savedFilters.id })
    if (result.length === 0) return reply.code(404).send({ error: 'not found' })
    return { ok: true }
  })
}

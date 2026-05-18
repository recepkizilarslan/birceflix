import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { listItems, lists, users } from '../db/schema.js'

const idParam = z.object({ id: z.string().uuid() })
const slugParam = z.object({ slug: z.string().min(8).max(64) })
const itemParam = z.object({
  id: z.string().uuid(),
  tmdbId: z.coerce.number().int().positive(),
})

const createBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  is_public: z.boolean().optional(),
})

const updateBody = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  is_public: z.boolean().optional(),
})

const addItemBody = z.object({
  tmdb_id: z.number().int().positive(),
  title: z.string().min(1).max(500),
  poster_path: z.string().nullable().optional(),
  position: z.number().int().min(-32768).max(32767).optional(),
})

function newSlug(): string {
  return randomBytes(12).toString('base64url')
}

function serialiseList(l: typeof lists.$inferSelect, itemCount?: number) {
  return {
    id: l.id,
    user_id: l.userId,
    name: l.name,
    description: l.description,
    is_public: l.isPublic,
    public_slug: l.publicSlug,
    created_at: l.createdAt.toISOString(),
    updated_at: l.updatedAt.toISOString(),
    ...(itemCount !== undefined && { item_count: itemCount }),
  }
}

function serialiseItem(i: typeof listItems.$inferSelect) {
  return {
    list_id: i.listId,
    tmdb_id: i.tmdbId,
    title: i.title,
    poster_path: i.posterPath,
    position: i.position,
    added_at: i.addedAt.toISOString(),
  }
}

export async function listsRoutes(app: FastifyInstance) {
  // -------- Own lists ----------------------------------------------------
  app.get('/api/lists', async (req) => {
    const userId = await app.requireAuth(req)
    const rows = await db
      .select({
        list: lists,
        itemCount: sql<number>`(
          SELECT count(*)::int FROM ${listItems} WHERE ${listItems.listId} = ${lists.id}
        )`.as('item_count'),
      })
      .from(lists)
      .where(eq(lists.userId, userId))
      .orderBy(desc(lists.updatedAt))
    return rows.map((r) => serialiseList(r.list, r.itemCount))
  })

  // -------- Create -------------------------------------------------------
  app.post('/api/lists', async (req) => {
    const userId = await app.requireAuth(req)
    const body = createBody.parse(req.body)
    const [row] = await db
      .insert(lists)
      .values({
        userId,
        name: body.name,
        description: body.description ?? null,
        isPublic: body.is_public ?? false,
        publicSlug: body.is_public ? newSlug() : null,
      })
      .returning()
    return serialiseList(row!, 0)
  })

  // -------- Detail (own list with items) ---------------------------------
  app.get('/api/lists/:id', async (req, reply) => {
    const userId = await app.requireAuth(req)
    const { id } = idParam.parse(req.params)
    const [row] = await db
      .select()
      .from(lists)
      .where(and(eq(lists.id, id), eq(lists.userId, userId)))
      .limit(1)
    if (!row) return reply.code(404).send({ error: 'not found' })

    const items = await db
      .select()
      .from(listItems)
      .where(eq(listItems.listId, id))
      .orderBy(asc(listItems.position), asc(listItems.addedAt))

    return { ...serialiseList(row), items: items.map(serialiseItem) }
  })

  // -------- Update -------------------------------------------------------
  app.patch('/api/lists/:id', async (req, reply) => {
    const userId = await app.requireAuth(req)
    const { id } = idParam.parse(req.params)
    const body = updateBody.parse(req.body)

    if (body.name === undefined && body.description === undefined && body.is_public === undefined) {
      return reply.code(400).send({ error: 'nothing to update' })
    }

    // Read current to know how to flip the slug when is_public toggles
    const [existing] = await db
      .select()
      .from(lists)
      .where(and(eq(lists.id, id), eq(lists.userId, userId)))
      .limit(1)
    if (!existing) return reply.code(404).send({ error: 'not found' })

    const update: Partial<typeof lists.$inferInsert> = { updatedAt: new Date() }
    if (body.name !== undefined) update.name = body.name
    if (body.description !== undefined) update.description = body.description ?? null
    if (body.is_public !== undefined) {
      update.isPublic = body.is_public
      // Going public: mint a slug if we don't have one. Going private: clear.
      if (body.is_public && !existing.publicSlug) update.publicSlug = newSlug()
      if (!body.is_public) update.publicSlug = null
    }

    const [row] = await db
      .update(lists)
      .set(update)
      .where(and(eq(lists.id, id), eq(lists.userId, userId)))
      .returning()
    return serialiseList(row!)
  })

  // -------- Delete -------------------------------------------------------
  app.delete('/api/lists/:id', async (req, reply) => {
    const userId = await app.requireAuth(req)
    const { id } = idParam.parse(req.params)
    const result = await db
      .delete(lists)
      .where(and(eq(lists.id, id), eq(lists.userId, userId)))
      .returning({ id: lists.id })
    if (result.length === 0) return reply.code(404).send({ error: 'not found' })
    return { ok: true }
  })

  // -------- Items: add ---------------------------------------------------
  app.post('/api/lists/:id/items', async (req, reply) => {
    const userId = await app.requireAuth(req)
    const { id } = idParam.parse(req.params)
    const body = addItemBody.parse(req.body)

    // Verify ownership
    const [existing] = await db
      .select({ id: lists.id })
      .from(lists)
      .where(and(eq(lists.id, id), eq(lists.userId, userId)))
      .limit(1)
    if (!existing) return reply.code(404).send({ error: 'not found' })

    await db
      .insert(listItems)
      .values({
        listId: id,
        tmdbId: body.tmdb_id,
        title: body.title,
        posterPath: body.poster_path ?? null,
        position: body.position ?? 0,
      })
      .onConflictDoUpdate({
        target: [listItems.listId, listItems.tmdbId],
        set: {
          title: body.title,
          posterPath: body.poster_path ?? null,
          ...(body.position !== undefined && { position: body.position }),
        },
      })
    // Bump list updated_at
    await db.update(lists).set({ updatedAt: new Date() }).where(eq(lists.id, id))
    return { ok: true }
  })

  // -------- Items: remove -----------------------------------------------
  app.delete('/api/lists/:id/items/:tmdbId', async (req, reply) => {
    const userId = await app.requireAuth(req)
    const { id, tmdbId } = itemParam.parse(req.params)

    // Verify ownership
    const [existing] = await db
      .select({ id: lists.id })
      .from(lists)
      .where(and(eq(lists.id, id), eq(lists.userId, userId)))
      .limit(1)
    if (!existing) return reply.code(404).send({ error: 'not found' })

    await db
      .delete(listItems)
      .where(and(eq(listItems.listId, id), eq(listItems.tmdbId, tmdbId)))
    await db.update(lists).set({ updatedAt: new Date() }).where(eq(lists.id, id))
    return { ok: true }
  })

  // -------- Public read-only --------------------------------------------
  app.get('/api/public/lists/:slug', async (req, reply) => {
    const { slug } = slugParam.parse(req.params)
    const [row] = await db
      .select({
        list: lists,
        owner: { name: users.name },
      })
      .from(lists)
      .innerJoin(users, eq(users.id, lists.userId))
      .where(and(eq(lists.publicSlug, slug), eq(lists.isPublic, true)))
      .limit(1)
    if (!row) return reply.code(404).send({ error: 'not found' })

    const items = await db
      .select()
      .from(listItems)
      .where(eq(listItems.listId, row.list.id))
      .orderBy(asc(listItems.position), asc(listItems.addedAt))

    return {
      ...serialiseList(row.list),
      owner_name: row.owner.name,
      items: items.map(serialiseItem),
    }
  })
}

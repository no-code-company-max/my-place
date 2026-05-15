import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closePool,
  insertTestLibraryCategory,
  insertTestLibraryItem,
  insertTestLibraryReadScope,
  insertTestLibraryWriteScope,
  insertTestPost,
  resolveE2EUserIds,
  withUser,
} from './harness'
import { E2E_PLACES, type E2ERole } from '../fixtures/e2e-data'

const palermoId = E2E_PLACES.palermo.id
const belgranoId = E2E_PLACES.belgrano.id

/**
 * RLS: LibraryItem (R.7.5).
 *
 * **2026-05-15 — modelo nuevo**: `ContributionPolicy` (ADMIN_ONLY /
 * DESIGNATED / MEMBERS_OPEN) + `LibraryCategoryContributor` fueron
 * eliminados (`20260513000000`) y reemplazados por `writeAccessKind`
 * (OWNER_ONLY / GROUPS / TIERS / USERS) + tablas write-scope. Los casos
 * INSERT se reescribieron a ese modelo (paridad con la policy
 * `LibraryItem_insert_with_write_access`, migración `20260513000000`).
 *
 * El bloque SELECT read-scope valida la policy de la migración
 * `20260515000000_library_read_scope_rls` (Plan A S4): helper
 * `is_in_category_read_scope` = `canReadCategory || canWriteCategory`.
 * GROUPS/TIERS de read-scope ya están cubiertos a nivel lógica por el
 * unit test `src/features/library/access/__tests__/assert-readable.test.ts`;
 * acá se cubre la integración SQL con USERS/PUBLIC/owner/
 * write-implica-read/blind-write (sin depender de fixtures de grupos/
 * tiers).
 *
 * Policies cubiertas:
 *   - SELECT: member ve no archivadas + en read-scope; admin audita;
 *     author ve su archivada (blind-write).
 *   - INSERT: `writeAccessKind` + `authorUserId = auth.uid()`.
 *   - UPDATE: admin del place o author directo.
 *   - DELETE: bloqueado para authenticated.
 */
describe('RLS: LibraryItem (R.7.5)', () => {
  let userIds: Record<E2ERole, string>

  beforeAll(async () => {
    userIds = await resolveE2EUserIds()
  })

  afterAll(async () => {
    await closePool()
  })

  // ── SELECT (categoría PUBLIC: comportamiento base) ───────────────────

  it('1. SELECT: memberA ve items no archivados del place', async () => {
    await withUser(
      userIds.memberA,
      async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `SELECT id FROM "LibraryItem" WHERE "placeId" = $1`,
          [palermoId],
        )
        expect(rows.length).toBeGreaterThan(0)
      },
      {
        setup: async (client) => {
          const categoryId = await insertTestLibraryCategory(client, { placeId: palermoId })
          const postId = await insertTestPost(client, {
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
          await insertTestLibraryItem(client, {
            placeId: palermoId,
            categoryId,
            postId,
            authorUserId: userIds.memberA,
          })
        },
      },
    )
  })

  it('2. SELECT: nonMember NO ve items de places ajenos', async () => {
    await withUser(
      userIds.nonMember,
      async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `SELECT id FROM "LibraryItem" WHERE "placeId" IN ($1, $2)`,
          [palermoId, belgranoId],
        )
        expect(rows).toHaveLength(0)
      },
      {
        setup: async (client) => {
          const categoryId = await insertTestLibraryCategory(client, { placeId: palermoId })
          const postId = await insertTestPost(client, {
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
          await insertTestLibraryItem(client, {
            placeId: palermoId,
            categoryId,
            postId,
            authorUserId: userIds.memberA,
          })
        },
      },
    )
  })

  it('3. SELECT: archivada visible para author + admin, oculta para otros members', async () => {
    let archivedId: string

    await withUser(
      userIds.memberB,
      async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `SELECT id FROM "LibraryItem" WHERE id = $1`,
          [archivedId],
        )
        expect(rows).toHaveLength(0)
      },
      {
        setup: async (client) => {
          const categoryId = await insertTestLibraryCategory(client, { placeId: palermoId })
          const postId = await insertTestPost(client, {
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
          archivedId = await insertTestLibraryItem(client, {
            placeId: palermoId,
            categoryId,
            postId,
            authorUserId: userIds.memberA,
            archivedAt: new Date(Date.now() - 60_000),
          })
        },
      },
    )

    await withUser(
      userIds.memberA,
      async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `SELECT id FROM "LibraryItem" WHERE id = $1`,
          [archivedId],
        )
        expect(rows).toHaveLength(1)
      },
      {
        setup: async (client) => {
          const categoryId = await insertTestLibraryCategory(client, { placeId: palermoId })
          const postId = await insertTestPost(client, {
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
          archivedId = await insertTestLibraryItem(client, {
            placeId: palermoId,
            categoryId,
            postId,
            authorUserId: userIds.memberA,
            archivedAt: new Date(Date.now() - 60_000),
          })
        },
      },
    )

    await withUser(
      userIds.admin,
      async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `SELECT id FROM "LibraryItem" WHERE id = $1`,
          [archivedId],
        )
        expect(rows).toHaveLength(1)
      },
      {
        setup: async (client) => {
          const categoryId = await insertTestLibraryCategory(client, { placeId: palermoId })
          const postId = await insertTestPost(client, {
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
          archivedId = await insertTestLibraryItem(client, {
            placeId: palermoId,
            categoryId,
            postId,
            authorUserId: userIds.memberA,
            archivedAt: new Date(Date.now() - 60_000),
          })
        },
      },
    )
  })

  // ── SELECT read-scope (policy 20260515000000_library_read_scope_rls) ──

  it('4. READ-SCOPE: categoría USERS — member EN el read-scope ve el item', async () => {
    let itemId: string
    await withUser(
      userIds.memberA,
      async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `SELECT id FROM "LibraryItem" WHERE id = $1`,
          [itemId],
        )
        expect(rows).toHaveLength(1)
      },
      {
        setup: async (client) => {
          const categoryId = await insertTestLibraryCategory(client, {
            placeId: palermoId,
            readAccessKind: 'USERS',
          })
          await insertTestLibraryReadScope(client, { categoryId, userId: userIds.memberA })
          const postId = await insertTestPost(client, {
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
          itemId = await insertTestLibraryItem(client, {
            placeId: palermoId,
            categoryId,
            postId,
            authorUserId: userIds.memberA,
          })
        },
      },
    )
  })

  it('5. READ-SCOPE: categoría USERS — member FUERA del read-scope NO ve el item', async () => {
    let itemId: string
    await withUser(
      userIds.memberB,
      async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `SELECT id FROM "LibraryItem" WHERE id = $1`,
          [itemId],
        )
        expect(rows).toHaveLength(0)
      },
      {
        setup: async (client) => {
          const categoryId = await insertTestLibraryCategory(client, {
            placeId: palermoId,
            readAccessKind: 'USERS',
          })
          await insertTestLibraryReadScope(client, { categoryId, userId: userIds.memberA })
          const postId = await insertTestPost(client, {
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
          itemId = await insertTestLibraryItem(client, {
            placeId: palermoId,
            categoryId,
            postId,
            authorUserId: userIds.memberA,
          })
        },
      },
    )
  })

  it('6. READ-SCOPE: owner del place SIEMPRE ve, aunque esté fuera del read-scope', async () => {
    let itemId: string
    await withUser(
      userIds.owner,
      async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `SELECT id FROM "LibraryItem" WHERE id = $1`,
          [itemId],
        )
        expect(rows).toHaveLength(1)
      },
      {
        setup: async (client) => {
          const categoryId = await insertTestLibraryCategory(client, {
            placeId: palermoId,
            readAccessKind: 'USERS',
          })
          await insertTestLibraryReadScope(client, { categoryId, userId: userIds.memberA })
          const postId = await insertTestPost(client, {
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
          itemId = await insertTestLibraryItem(client, {
            placeId: palermoId,
            categoryId,
            postId,
            authorUserId: userIds.memberA,
          })
        },
      },
    )
  })

  it('7. READ-SCOPE: write implica read — member en WRITE-scope (no en read-scope) ve', async () => {
    let itemId: string
    await withUser(
      userIds.memberB,
      async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `SELECT id FROM "LibraryItem" WHERE id = $1`,
          [itemId],
        )
        expect(rows).toHaveLength(1)
      },
      {
        setup: async (client) => {
          // read=USERS con memberA; write=USERS con memberB. memberB NO
          // está en read-scope pero SÍ en write-scope → write implica read.
          const categoryId = await insertTestLibraryCategory(client, {
            placeId: palermoId,
            readAccessKind: 'USERS',
            writeAccessKind: 'USERS',
          })
          await insertTestLibraryReadScope(client, { categoryId, userId: userIds.memberA })
          await insertTestLibraryWriteScope(client, { categoryId, userId: userIds.memberB })
          const postId = await insertTestPost(client, {
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
          itemId = await insertTestLibraryItem(client, {
            placeId: palermoId,
            categoryId,
            postId,
            authorUserId: userIds.memberA,
          })
        },
      },
    )
  })

  // ── INSERT (writeAccessKind + authorUserId = auth.uid()) ─────────────

  it('8. INSERT: owner crea en categoría OWNER_ONLY OK', async () => {
    let categoryId: string
    let postId: string
    await withUser(
      userIds.owner,
      async (client) => {
        const r = await client.query(
          `INSERT INTO "LibraryItem"
            (id, "placeId", "categoryId", "postId", "authorUserId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           RETURNING id`,
          ['libitem_owner', palermoId, categoryId, postId, userIds.owner],
        )
        expect(r.rows).toHaveLength(1)
      },
      {
        setup: async (client) => {
          categoryId = await insertTestLibraryCategory(client, {
            placeId: palermoId,
            writeAccessKind: 'OWNER_ONLY',
          })
          postId = await insertTestPost(client, {
            placeId: palermoId,
            authorUserId: userIds.owner,
          })
        },
      },
    )
  })

  it('9. INSERT: memberA NO crea en categoría OWNER_ONLY', async () => {
    let categoryId: string
    let postId: string
    await withUser(
      userIds.memberA,
      async (client) => {
        await expect(
          client.query(
            `INSERT INTO "LibraryItem"
              (id, "placeId", "categoryId", "postId", "authorUserId", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            ['libitem_member_blocked', palermoId, categoryId, postId, userIds.memberA],
          ),
        ).rejects.toThrow(/row-level security/i)
      },
      {
        setup: async (client) => {
          categoryId = await insertTestLibraryCategory(client, {
            placeId: palermoId,
            writeAccessKind: 'OWNER_ONLY',
          })
          postId = await insertTestPost(client, {
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
        },
      },
    )
  })

  it('10. INSERT: member EN write-scope USERS crea OK; otro miembro bloqueado', async () => {
    let categoryId: string
    let postIdA: string
    let postIdB: string

    await withUser(
      userIds.memberA,
      async (client) => {
        const r = await client.query(
          `INSERT INTO "LibraryItem"
            (id, "placeId", "categoryId", "postId", "authorUserId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           RETURNING id`,
          ['libitem_ws_a', palermoId, categoryId, postIdA, userIds.memberA],
        )
        expect(r.rows).toHaveLength(1)
      },
      {
        setup: async (client) => {
          categoryId = await insertTestLibraryCategory(client, {
            placeId: palermoId,
            writeAccessKind: 'USERS',
          })
          await insertTestLibraryWriteScope(client, { categoryId, userId: userIds.memberA })
          postIdA = await insertTestPost(client, {
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
        },
      },
    )

    await withUser(
      userIds.memberB,
      async (client) => {
        await expect(
          client.query(
            `INSERT INTO "LibraryItem"
              (id, "placeId", "categoryId", "postId", "authorUserId", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            ['libitem_ws_b_blocked', palermoId, categoryId, postIdB, userIds.memberB],
          ),
        ).rejects.toThrow(/row-level security/i)
      },
      {
        setup: async (client) => {
          categoryId = await insertTestLibraryCategory(client, {
            placeId: palermoId,
            writeAccessKind: 'USERS',
          })
          await insertTestLibraryWriteScope(client, { categoryId, userId: userIds.memberA })
          postIdB = await insertTestPost(client, {
            placeId: palermoId,
            authorUserId: userIds.memberB,
          })
        },
      },
    )
  })

  it('11. INSERT: write-scope USERS con authorUserId de otro user → bloqueado', async () => {
    let categoryId: string
    let postId: string
    await withUser(
      userIds.memberA,
      async (client) => {
        await expect(
          client.query(
            `INSERT INTO "LibraryItem"
              (id, "placeId", "categoryId", "postId", "authorUserId", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            ['libitem_steal', palermoId, categoryId, postId, userIds.memberB],
          ),
        ).rejects.toThrow(/row-level security/i)
      },
      {
        setup: async (client) => {
          categoryId = await insertTestLibraryCategory(client, {
            placeId: palermoId,
            writeAccessKind: 'USERS',
          })
          await insertTestLibraryWriteScope(client, { categoryId, userId: userIds.memberA })
          postId = await insertTestPost(client, {
            placeId: palermoId,
            authorUserId: userIds.memberB,
          })
        },
      },
    )
  })

  // ── UPDATE ────────────────────────────────────────────────────────────

  it('12. UPDATE: author puede archivar su item', async () => {
    let itemId: string
    await withUser(
      userIds.memberA,
      async (client) => {
        const r = await client.query(
          `UPDATE "LibraryItem" SET "archivedAt" = NOW() WHERE id = $1`,
          [itemId],
        )
        expect(r.rowCount).toBe(1)
      },
      {
        setup: async (client) => {
          const categoryId = await insertTestLibraryCategory(client, { placeId: palermoId })
          const postId = await insertTestPost(client, {
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
          itemId = await insertTestLibraryItem(client, {
            placeId: palermoId,
            categoryId,
            postId,
            authorUserId: userIds.memberA,
          })
        },
      },
    )
  })

  it('13. UPDATE: admin actualiza item de otro author OK', async () => {
    let itemId: string
    await withUser(
      userIds.admin,
      async (client) => {
        const r = await client.query(
          `UPDATE "LibraryItem" SET "archivedAt" = NOW() WHERE id = $1`,
          [itemId],
        )
        expect(r.rowCount).toBe(1)
      },
      {
        setup: async (client) => {
          const categoryId = await insertTestLibraryCategory(client, { placeId: palermoId })
          const postId = await insertTestPost(client, {
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
          itemId = await insertTestLibraryItem(client, {
            placeId: palermoId,
            categoryId,
            postId,
            authorUserId: userIds.memberA,
          })
        },
      },
    )
  })

  it('14. UPDATE: memberB (no author, no admin) NO puede modificar', async () => {
    let itemId: string
    await withUser(
      userIds.memberB,
      async (client) => {
        const r = await client.query(
          `UPDATE "LibraryItem" SET "archivedAt" = NOW() WHERE id = $1`,
          [itemId],
        )
        expect(r.rowCount).toBe(0)
      },
      {
        setup: async (client) => {
          const categoryId = await insertTestLibraryCategory(client, { placeId: palermoId })
          const postId = await insertTestPost(client, {
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
          itemId = await insertTestLibraryItem(client, {
            placeId: palermoId,
            categoryId,
            postId,
            authorUserId: userIds.memberA,
          })
        },
      },
    )
  })

  // ── DELETE ────────────────────────────────────────────────────────────

  it('15. DELETE: admin NO puede DELETE físico (no policy DELETE)', async () => {
    let itemId: string
    await withUser(
      userIds.admin,
      async (client) => {
        const r = await client.query(`DELETE FROM "LibraryItem" WHERE id = $1`, [itemId])
        expect(r.rowCount).toBe(0)
      },
      {
        setup: async (client) => {
          const categoryId = await insertTestLibraryCategory(client, { placeId: palermoId })
          const postId = await insertTestPost(client, {
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
          itemId = await insertTestLibraryItem(client, {
            placeId: palermoId,
            categoryId,
            postId,
            authorUserId: userIds.memberA,
          })
        },
      },
    )
  })
})

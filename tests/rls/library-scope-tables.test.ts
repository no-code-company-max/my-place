import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  closePool,
  insertTestLibraryCategory,
  insertTestLibraryReadScope,
  insertTestLibraryWriteScope,
  resolveE2EUserIds,
  withUser,
} from './harness'
import { E2E_PLACES, type E2ERole } from '../fixtures/e2e-data'

const palermoId = E2E_PLACES.palermo.id

/**
 * RLS: tablas scope de library (migración
 * `20260515000100_library_scope_tables_rls`).
 *
 * Las 6 tablas `LibraryCategory{Group,Tier,User}{Read,Write}Scope`
 * comparten policy idéntica (mismo `EXISTS` join a `LibraryCategory`
 * gateado por `is_place_admin || is_place_owner`). Se cubre el patrón
 * con `LibraryCategoryUserReadScope` + `LibraryCategoryUserWriteScope`
 * (userId directo, sin depender de fixtures de grupos/tiers). Las otras
 * 4 son estructuralmente idénticas.
 *
 * Reemplaza conceptualmente la cobertura de los ex-casos 12-17 de
 * `library-category.test.ts` (que protegían el difunto
 * `LibraryCategoryContributor`). Decisión G del plan: SELECT solo
 * admin/owner; escritura deny-by-default (service-role la gestiona).
 */
describe('RLS: library scope tables (20260515000100)', () => {
  let userIds: Record<E2ERole, string>

  beforeAll(async () => {
    userIds = await resolveE2EUserIds()
  })

  afterAll(async () => {
    await closePool()
  })

  // ── SELECT: solo admin/owner del place ───────────────────────────────

  it('1. SELECT: admin del place ve el read-scope de una categoría', async () => {
    let categoryId: string
    await withUser(
      userIds.admin,
      async (client) => {
        const { rows } = await client.query<{ userId: string }>(
          `SELECT "userId" FROM "LibraryCategoryUserReadScope" WHERE "categoryId" = $1`,
          [categoryId],
        )
        expect(rows).toHaveLength(1)
        expect(rows[0]?.userId).toBe(userIds.memberA)
      },
      {
        setup: async (client) => {
          categoryId = await insertTestLibraryCategory(client, {
            placeId: palermoId,
            readAccessKind: 'USERS',
          })
          await insertTestLibraryReadScope(client, { categoryId, userId: userIds.memberA })
        },
      },
    )
  })

  it('2. SELECT: owner del place ve el write-scope', async () => {
    let categoryId: string
    await withUser(
      userIds.owner,
      async (client) => {
        const { rows } = await client.query<{ userId: string }>(
          `SELECT "userId" FROM "LibraryCategoryUserWriteScope" WHERE "categoryId" = $1`,
          [categoryId],
        )
        expect(rows).toHaveLength(1)
      },
      {
        setup: async (client) => {
          categoryId = await insertTestLibraryCategory(client, {
            placeId: palermoId,
            writeAccessKind: 'USERS',
          })
          await insertTestLibraryWriteScope(client, { categoryId, userId: userIds.memberA })
        },
      },
    )
  })

  it('3. SELECT: member común (no admin/owner) NO ve el read-scope', async () => {
    let categoryId: string
    await withUser(
      userIds.memberB,
      async (client) => {
        const { rows } = await client.query<{ userId: string }>(
          `SELECT "userId" FROM "LibraryCategoryUserReadScope" WHERE "categoryId" = $1`,
          [categoryId],
        )
        expect(rows).toHaveLength(0)
      },
      {
        setup: async (client) => {
          categoryId = await insertTestLibraryCategory(client, {
            placeId: palermoId,
            readAccessKind: 'USERS',
          })
          await insertTestLibraryReadScope(client, { categoryId, userId: userIds.memberA })
        },
      },
    )
  })

  it('4. SELECT: nonMember NO ve el read-scope', async () => {
    let categoryId: string
    await withUser(
      userIds.nonMember,
      async (client) => {
        const { rows } = await client.query<{ userId: string }>(
          `SELECT "userId" FROM "LibraryCategoryUserReadScope" WHERE "categoryId" = $1`,
          [categoryId],
        )
        expect(rows).toHaveLength(0)
      },
      {
        setup: async (client) => {
          categoryId = await insertTestLibraryCategory(client, {
            placeId: palermoId,
            readAccessKind: 'USERS',
          })
          await insertTestLibraryReadScope(client, { categoryId, userId: userIds.memberA })
        },
      },
    )
  })

  // ── Escritura: deny-by-default para authenticated ────────────────────

  it('5. INSERT: admin NO puede insertar scope directo (deny-by-default)', async () => {
    let categoryId: string
    await withUser(
      userIds.admin,
      async (client) => {
        await expect(
          client.query(
            `INSERT INTO "LibraryCategoryUserReadScope" ("categoryId", "userId") VALUES ($1, $2)`,
            [categoryId, userIds.memberB],
          ),
        ).rejects.toThrow(/row-level security/i)
      },
      {
        setup: async (client) => {
          categoryId = await insertTestLibraryCategory(client, {
            placeId: palermoId,
            readAccessKind: 'USERS',
          })
        },
      },
    )
  })

  it('6. DELETE: admin NO puede borrar scope directo (deny-by-default)', async () => {
    let categoryId: string
    await withUser(
      userIds.admin,
      async (client) => {
        const r = await client.query(
          `DELETE FROM "LibraryCategoryUserReadScope" WHERE "categoryId" = $1`,
          [categoryId],
        )
        // Sin policy DELETE → 0 filas afectadas (RLS deny-by-default).
        expect(r.rowCount).toBe(0)
      },
      {
        setup: async (client) => {
          categoryId = await insertTestLibraryCategory(client, {
            placeId: palermoId,
            readAccessKind: 'USERS',
          })
          await insertTestLibraryReadScope(client, { categoryId, userId: userIds.memberA })
        },
      },
    )
  })
})

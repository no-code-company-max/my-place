import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closePool, insertTestEvent, insertTestRsvp, resolveE2EUserIds, withUser } from './harness'
import { E2E_PLACES, type E2ERole } from '../fixtures/e2e-data'

const palermoId = E2E_PLACES.palermo.id
const belgranoId = E2E_PLACES.belgrano.id

describe('RLS: Event + EventRSVP (9 casos sobre policies F.B Fase 6)', () => {
  let userIds: Record<E2ERole, string>

  beforeAll(async () => {
    userIds = await resolveE2EUserIds()
  })

  afterAll(async () => {
    await closePool()
  })

  // ── SELECT (Event) ────────────────────────────────────────────────────

  it('1. SELECT: memberA ve eventos del place', async () => {
    await withUser(
      userIds.memberA,
      async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `SELECT id FROM "Event" WHERE "placeId" = $1`,
          [palermoId],
        )
        expect(rows.length).toBeGreaterThan(0)
      },
      {
        setup: async (client) => {
          await insertTestEvent(client, {
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
        },
      },
    )
  })

  it('2. SELECT: non-member NO ve eventos de otro place', async () => {
    await withUser(
      userIds.nonMember,
      async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `SELECT id FROM "Event" WHERE "placeId" IN ($1, $2)`,
          [palermoId, belgranoId],
        )
        expect(rows).toHaveLength(0)
      },
      {
        setup: async (client) => {
          await insertTestEvent(client, {
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
        },
      },
    )
  })

  it('3. SELECT: ex-member NO ve eventos pasados ni futuros del place que dejó', async () => {
    await withUser(
      userIds.exMember,
      async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `SELECT id FROM "Event" WHERE "placeId" = $1`,
          [palermoId],
        )
        expect(rows).toHaveLength(0)
      },
      {
        setup: async (client) => {
          // Evento pasado.
          await insertTestEvent(client, {
            placeId: palermoId,
            authorUserId: userIds.memberA,
            startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            endsAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
          })
          // Evento futuro.
          await insertTestEvent(client, {
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
        },
      },
    )
  })

  // ── INSERT (Event) ────────────────────────────────────────────────────

  it('4. INSERT: memberA en place donde no es miembro → rejected (WITH CHECK)', async () => {
    await withUser(userIds.memberA, async (client) => {
      // memberA está en palermo, no en belgrano.
      await expect(
        client.query(
          `INSERT INTO "Event"
             (id, "placeId", "authorUserId", "authorSnapshot", title, "startsAt",
              timezone, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, NOW(), NOW())`,
          [
            'evt_rls_cross_place',
            belgranoId,
            userIds.memberA,
            JSON.stringify({ displayName: 'memberA', avatarUrl: null }),
            'Cross-place attempt',
            new Date(Date.now() + 60 * 60 * 1000),
            'America/Argentina/Buenos_Aires',
          ],
        ),
      ).rejects.toThrow(/row-level security|new row violates/i)
    })
  })

  it('5. INSERT: memberA con authorUserId ajeno → rejected (impersonación)', async () => {
    await withUser(userIds.memberA, async (client) => {
      await expect(
        client.query(
          `INSERT INTO "Event"
             (id, "placeId", "authorUserId", "authorSnapshot", title, "startsAt",
              timezone, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, NOW(), NOW())`,
          [
            'evt_rls_impersonate',
            palermoId,
            userIds.memberB,
            JSON.stringify({ displayName: 'memberA', avatarUrl: null }),
            'Impersonate memberB',
            new Date(Date.now() + 60 * 60 * 1000),
            'America/Argentina/Buenos_Aires',
          ],
        ),
      ).rejects.toThrow(/row-level security|new row violates/i)
    })
  })

  // ── UPDATE (Event) ────────────────────────────────────────────────────

  it('6. UPDATE: author puede modificar su propio evento', async () => {
    await withUser(
      userIds.memberA,
      async (client) => {
        const { rowCount } = await client.query(
          `UPDATE "Event" SET title = $1, "updatedAt" = NOW() WHERE id = $2`,
          ['Updated by author', 'evt_rls_update_author'],
        )
        expect(rowCount).toBe(1)
      },
      {
        setup: async (client) => {
          await insertTestEvent(client, {
            id: 'evt_rls_update_author',
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
        },
      },
    )
  })

  it('7. UPDATE: admin puede modificar evento ajeno del mismo place', async () => {
    await withUser(
      userIds.admin,
      async (client) => {
        const { rowCount } = await client.query(
          `UPDATE "Event" SET "cancelledAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
          ['evt_rls_admin_cancel'],
        )
        expect(rowCount).toBe(1)
      },
      {
        setup: async (client) => {
          await insertTestEvent(client, {
            id: 'evt_rls_admin_cancel',
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
        },
      },
    )
  })

  // ── EventRSVP ─────────────────────────────────────────────────────────

  it('8. INSERT RSVP: memberA NO puede RSVPear en nombre de memberB', async () => {
    await withUser(
      userIds.memberA,
      async (client) => {
        await expect(
          client.query(
            `INSERT INTO "EventRSVP" (id, "eventId", "userId", state, "updatedAt")
             VALUES ($1, $2, $3, $4::"RSVPState", NOW())`,
            ['rsvp_rls_impersonate', 'evt_rls_for_rsvp_impersonate', userIds.memberB, 'GOING'],
          ),
        ).rejects.toThrow(/row-level security|new row violates/i)
      },
      {
        setup: async (client) => {
          await insertTestEvent(client, {
            id: 'evt_rls_for_rsvp_impersonate',
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
        },
      },
    )
  })

  it('9. INSERT RSVP: memberA NO puede RSVPear en evento cancelado', async () => {
    await withUser(
      userIds.memberA,
      async (client) => {
        await expect(
          client.query(
            `INSERT INTO "EventRSVP" (id, "eventId", "userId", state, "updatedAt")
             VALUES ($1, $2, $3, $4::"RSVPState", NOW())`,
            ['rsvp_rls_cancelled', 'evt_rls_cancelled', userIds.memberA, 'GOING'],
          ),
        ).rejects.toThrow(/row-level security|new row violates/i)
      },
      {
        setup: async (client) => {
          await insertTestEvent(client, {
            id: 'evt_rls_cancelled',
            placeId: palermoId,
            authorUserId: userIds.memberA,
            cancelledAt: new Date(),
          })
        },
      },
    )
  })

  // ── EventRSVP — happy path complementario (no enumerado en plan, valida coherencia) ─

  it('extra. INSERT RSVP: memberA puede RSVPear su propio evento activo', async () => {
    await withUser(
      userIds.memberA,
      async (client) => {
        const { rowCount } = await client.query(
          `INSERT INTO "EventRSVP" (id, "eventId", "userId", state, "updatedAt")
           VALUES ($1, $2, $3, $4::"RSVPState", NOW())`,
          ['rsvp_rls_self', 'evt_rls_for_rsvp_self', userIds.memberA, 'GOING'],
        )
        expect(rowCount).toBe(1)
      },
      {
        setup: async (client) => {
          await insertTestEvent(client, {
            id: 'evt_rls_for_rsvp_self',
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
        },
      },
    )
  })

  it('extra. SELECT RSVP: admin ve la RSVP de memberA en el mismo place (palermo)', async () => {
    // Nota: en el seed E2E, memberA está en palermo y memberB en belgrano,
    // así que para validar visibility cross-user dentro de UN place uso admin
    // (también miembro activo de palermo).
    await withUser(
      userIds.admin,
      async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `SELECT id FROM "EventRSVP" WHERE id = $1`,
          ['rsvp_rls_visible'],
        )
        expect(rows).toHaveLength(1)
      },
      {
        setup: async (client) => {
          await insertTestEvent(client, {
            id: 'evt_rls_for_rsvp_visible',
            placeId: palermoId,
            authorUserId: userIds.memberA,
          })
          await insertTestRsvp(client, {
            id: 'rsvp_rls_visible',
            eventId: 'evt_rls_for_rsvp_visible',
            userId: userIds.memberA,
          })
        },
      },
    )
  })
})

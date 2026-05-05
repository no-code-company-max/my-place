import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { placeUrl } from '../../helpers/subdomain'
import { E2E_DISPLAY_NAMES, E2E_EMAILS, E2E_PLACES } from '../../fixtures/e2e-data'
import { getTestPrisma } from '../../helpers/prisma'

/**
 * Flow G.x — Block / Unblock / Expel de un miembro + `<UserBlockedView>`.
 *
 * Cubre el flujo del plan G.4–G.6 (PermissionGroups) y los actions del
 * slice members (`block-member.ts`, `unblock-member.ts`, `expel-member.ts`).
 *
 * Escenarios:
 *  1. Owner bloquea memberA desde `/settings/members/<userId>`.
 *  2. memberA intenta entrar al place → ve `<UserBlockedView>` (sin nav,
 *     sin zonas, sin posts).
 *  3. Owner desbloquea memberA.
 *  4. memberA vuelve a entrar al place — contenido visible nuevamente.
 *  5. Owner expulsa memberA. Detalle del miembro ya no es visible.
 *  6. Owner intenta abrir su propio detalle → no aparece "Bloquear miembro"
 *     (UI gate de la BlockSection: target !== self AND target !== owner).
 *  7. Owner intenta bloquear a otro owner — N/A: el seed sólo tiene un
 *     owner. Documentado con `test.skip()`.
 *
 * **Aislamiento entre workers**: chromium + mobile-safari corren en paralelo
 * contra el mismo cloud DB. El flujo block/unblock/expel es atómico y
 * ordered (`mode: 'serial'`). El `afterAll()` defensivo restaura la
 * membership de memberA via Prisma directo: limpia `blockedAt`, `leftAt`
 * y todos los campos de expel. Esto es crítico — sin restore, otros specs
 * que dependan de memberA quedan rotos.
 *
 * **Email**: en dev/cloud con `FakeMailer`, los emails se loguean a stdout
 * y no se envían. Este spec verifica el efecto en DB + UI, NO la entrega
 * del email (gotcha CLAUDE.md).
 *
 * **Webkit/mobile-safari y Radix Dialog**: los dialogs Radix flakean a veces
 * en mobile-safari. Si algún escenario muestra timeouts persistentes en CI,
 * agregar `test.skip(browserName === 'webkit', '…')` por test.
 *
 * Storage states:
 *  - `owner` → OWNER del place palermo (vía PlaceOwnership) + `members:block`.
 *  - `memberA` → MEMBER del place palermo. Es el target del flujo.
 */

const palermoSlug = E2E_PLACES.palermo.slug
const palermoId = E2E_PLACES.palermo.id

/**
 * Resuelve el `userId` (UUID Supabase) de memberA leyendo `User` por email.
 * No es determinístico al fixture — el seed lo genera al crear el auth user.
 */
async function findMemberAUserId(): Promise<string> {
  const prisma = getTestPrisma()
  const user = await prisma.user.findFirst({
    where: { email: E2E_EMAILS.memberA },
    select: { id: true },
  })
  if (!user) {
    throw new Error(
      `[member-block-expel] User memberA no encontrado (email=${E2E_EMAILS.memberA}). ` +
        `Correr \`pnpm test:e2e:seed\` antes de los specs.`,
    )
  }
  return user.id
}

/**
 * Restaura la membership de memberA a "activa, no bloqueada, no expulsada".
 * Se invoca en el `afterAll()` defensivo. Idempotente: si la membership ya
 * está limpia, el update es no-op.
 */
async function restoreMemberAMembership(): Promise<void> {
  const prisma = getTestPrisma()
  const memberAId = await findMemberAUserId()
  await prisma.membership
    .update({
      where: { userId_placeId: { userId: memberAId, placeId: palermoId } },
      data: {
        leftAt: null,
        blockedAt: null,
        blockedByUserId: null,
        blockedReason: null,
        blockedContactEmail: null,
        expelledByUserId: null,
        expelReason: null,
        expelContactEmail: null,
      },
    })
    .catch(() => {
      // Defensivo: si por alguna razón la membership no existe, no romper
      // el afterAll. El seed la recrea en el próximo run.
    })
}

test.describe('Member block / unblock / expel — flujo serial', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: storageStateFor('owner') })

  let memberAUserId: string

  test.beforeAll(async () => {
    memberAUserId = await findMemberAUserId()
    // Pre-restore por si una corrida anterior dejó memberA en estado raro.
    await restoreMemberAMembership()
  })

  test.afterAll(async () => {
    // Restore canónico: memberA queda activo, sin bloqueo, sin expel.
    // Crítico para que otros specs que dependen del baseline no rompan.
    await restoreMemberAMembership()
  })

  test('owner bloquea a memberA → BlockSection muestra estado "Bloqueado"', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, `/settings/members/${memberAUserId}`))
    await expect(
      page.getByRole('heading', { name: E2E_DISPLAY_NAMES.memberA, exact: true }),
    ).toBeVisible({ timeout: 10_000 })

    // Sección de bloqueo: heading + botón trigger del dialog.
    await expect(page.getByRole('heading', { name: 'Bloquear miembro' })).toBeVisible()
    await page.getByRole('button', { name: 'Bloquear miembro' }).click()

    // Dialog visible — verificamos también que `contactEmail` tiene el
    // default del owner (se autocompleta en el client component).
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('heading', { name: 'Bloquear miembro' }).last()).toBeVisible()
    const contactEmailInput = page.getByLabel('Email de contacto')
    await expect(contactEmailInput).toHaveValue(E2E_EMAILS.owner)

    // Fill motivo + submit.
    await page.getByLabel('Motivo').fill('Test e2e block')
    await page.getByRole('button', { name: /Bloquear y enviar email/i }).click()

    // Espera el toast OK + cierre del dialog.
    await expect(page.getByText(`${E2E_DISPLAY_NAMES.memberA} fue bloqueado.`).first()).toBeVisible(
      { timeout: 10_000 },
    )
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })

    // Reload — la sección ahora debe mostrar estado "Bloqueado" + botón
    // "Desbloquear miembro" en vez de "Bloquear miembro".
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Bloqueado', exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText(/Bloqueado el/i).first()).toBeVisible()
    await expect(page.getByText('Test e2e block')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Desbloquear miembro' })).toBeVisible()
    // Y NO debe haber un trigger de "Bloquear miembro" (se reemplazó).
    await expect(page.getByRole('button', { name: /^Bloquear miembro$/ })).toHaveCount(0)
  })

  test('memberA bloqueado entra al place → ve <UserBlockedView>', async ({ browser }) => {
    // Usamos un context separado con storage state de memberA. El
    // `test.use()` del describe es para owner; este caso necesita memberA.
    const context = await browser.newContext({
      storageState: storageStateFor('memberA'),
    })
    const memberPage = await context.newPage()
    try {
      await memberPage.goto(placeUrl(palermoSlug, '/'))

      // Copy del `<UserBlockedView>`: "Estás bloqueado de <placeName>".
      await expect(memberPage.getByRole('heading', { name: /Estás bloqueado de/i })).toBeVisible({
        timeout: 10_000,
      })
      // Motivo del bloqueo visible.
      await expect(memberPage.getByText('Test e2e block')).toBeVisible()
      // Email de contacto visible (link mailto).
      await expect(memberPage.getByRole('link', { name: E2E_EMAILS.owner })).toBeVisible()

      // NO contenido del place: ni nav de zonas ni posts.
      await expect(memberPage.getByRole('navigation', { name: 'Zonas del place' })).toHaveCount(0)
    } finally {
      await context.close()
    }
  })

  test('owner desbloquea a memberA → vuelve a aparecer "Bloquear miembro"', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, `/settings/members/${memberAUserId}`))
    await expect(page.getByRole('button', { name: 'Desbloquear miembro' })).toBeVisible({
      timeout: 10_000,
    })
    await page.getByRole('button', { name: 'Desbloquear miembro' }).click()

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
    // Mensaje opcional — lo dejamos vacío para cubrir el path "sin mensaje".
    // ContactEmail viene autocompletado con el owner.
    await expect(page.getByLabel('Email de contacto')).toHaveValue(E2E_EMAILS.owner)
    await page.getByRole('button', { name: /Desbloquear y enviar email/i }).click()

    await expect(
      page.getByText(`${E2E_DISPLAY_NAMES.memberA} fue desbloqueado.`).first(),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })

    // Reload — la sección vuelve al estado inicial (botón "Bloquear miembro").
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Bloquear miembro' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('button', { name: 'Bloquear miembro' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Desbloquear miembro' })).toHaveCount(0)
  })

  test('memberA desbloqueado entra al place → contenido visible', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: storageStateFor('memberA'),
    })
    const memberPage = await context.newPage()
    try {
      await memberPage.goto(placeUrl(palermoSlug, '/'))

      // Sin `<UserBlockedView>` — el heading de "Estás bloqueado" no aparece.
      await expect(memberPage.getByRole('heading', { name: /Estás bloqueado de/i })).toHaveCount(0)

      // Sí aparece la nav de zonas (señal de contenido renderizado por el
      // gated layout en estado "open" + no bloqueado).
      await expect(memberPage.getByRole('navigation', { name: 'Zonas del place' })).toBeVisible({
        timeout: 10_000,
      })
    } finally {
      await context.close()
    }
  })

  test('owner expulsa a memberA → membership terminada', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, `/settings/members/${memberAUserId}`))
    await expect(
      page.getByRole('heading', { name: E2E_DISPLAY_NAMES.memberA, exact: true }),
    ).toBeVisible({ timeout: 10_000 })

    // Sección expel — owner-only, target !== self.
    await expect(page.getByRole('heading', { name: 'Expulsar miembro' })).toBeVisible()
    await page.getByRole('button', { name: 'Expulsar miembro' }).click()

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByLabel('Email de contacto')).toHaveValue(E2E_EMAILS.owner)
    await page.getByLabel('Motivo').fill('Test e2e expel')
    await page.getByRole('button', { name: /Expulsar y enviar email/i }).click()

    // Toast OK + dialog cerrado.
    await expect(
      page.getByText(`${E2E_DISPLAY_NAMES.memberA} fue expulsado del place.`).first(),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })

    // Verificación en DB: memberA tiene leftAt + expelledByUserId NOT NULL.
    // Más fiable que asumir comportamiento de revalidación post-action.
    const prisma = getTestPrisma()
    const membership = await prisma.membership.findUnique({
      where: { userId_placeId: { userId: memberAUserId, placeId: palermoId } },
      select: { leftAt: true, expelledByUserId: true, expelReason: true },
    })
    expect(membership?.leftAt).not.toBeNull()
    expect(membership?.expelledByUserId).not.toBeNull()
    expect(membership?.expelReason).toBe('Test e2e expel')
  })
})

test.describe('Member block — UI gates (no mutations)', () => {
  test.use({ storageState: storageStateFor('owner') })

  test('owner abre su propio detalle → no aparece "Bloquear miembro" (gate self)', async ({
    page,
  }) => {
    // El page resuelve `auth.id` server-side y oculta `BlockSection` cuando
    // target === self. La forma más fiable de obtener el userId del owner
    // es leer User por email.
    const prisma = getTestPrisma()
    const owner = await prisma.user.findFirst({
      where: { email: E2E_EMAILS.owner },
      select: { id: true },
    })
    if (!owner) {
      throw new Error('[member-block-expel] User owner no encontrado.')
    }

    await page.goto(placeUrl(palermoSlug, `/settings/members/${owner.id}`))
    await expect(
      page.getByRole('heading', { name: E2E_DISPLAY_NAMES.owner, exact: true }),
    ).toBeVisible({ timeout: 10_000 })

    // Ni la sección "Bloquear miembro" ni la sección "Expulsar miembro"
    // se renderean cuando el target es el propio viewer (gate del page).
    await expect(page.getByRole('heading', { name: 'Bloquear miembro' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Expulsar miembro' })).toHaveCount(0)
  })

  // El seed sólo tiene UN owner del place palermo. No hay forma de cubrir
  // "owner intenta bloquear a otro owner" sin extender el fixture, lo cual
  // está fuera de scope del plan C.5. La validación server-side
  // (`cannot_block_owner`) está cubierta por unit tests del action.
  test.skip('owner intenta bloquear a otro owner → bloqueado por gate (N/A: seed con 1 owner)', () => {
    // Documentación intencional: este escenario quedaría así si hubiera
    // un segundo owner en el seed:
    //   await page.goto(placeUrl(palermoSlug, `/settings/members/${otherOwnerId}`))
    //   await expect(page.getByRole('heading', { name: 'Bloquear miembro' })).toHaveCount(0)
    // El gate del page es `showBlockSection = viewerCanBlock && !targetIsOwner && !isSelf`.
  })
})

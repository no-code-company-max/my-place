import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { placeUrl } from '../../helpers/subdomain'
import { E2E_PLACES } from '../../fixtures/e2e-data'
import { deleteInvitationsByEmail, findInvitationTokenByEmail } from '../../helpers/db'

/**
 * Invite — admin envía, se crea Invitation en DB con token, el link es
 * reachable. NO exercitamos el accept-handshake completo (crearía un user de
 * Supabase difícil de limpiar entre runs; el acceptInvitation server-side
 * está cubierto por tests unit).
 */

const palermoSlug = E2E_PLACES.palermo.slug
const palermoId = E2E_PLACES.palermo.id
const INVITEE_EMAIL = 'e2e-invitee@e2e.place.local'

test.describe('Invite — Palermo', () => {
  test.use({ storageState: storageStateFor('admin') })

  test.beforeEach(async () => {
    await deleteInvitationsByEmail(palermoId, INVITEE_EMAIL)
  })

  test.afterAll(async () => {
    await deleteInvitationsByEmail(palermoId, INVITEE_EMAIL)
  })

  test('admin completa el form → Invitation creada con token válido', async ({ page }) => {
    test.setTimeout(90_000) // generateLink contra Supabase Cloud puede tardar varios s.
    await page.goto(placeUrl(palermoSlug, '/settings/members'))
    await expect(page.getByRole('heading', { name: /Lista/ })).toBeVisible()

    await page
      .getByLabel(/^Email$/)
      .first()
      .fill(INVITEE_EMAIL)
    await page.getByRole('button', { name: /Enviar invitación/ }).click()

    // Poll DB generosamente: `admin.generateLink` contra Supabase Cloud puede
    // tardar varios segundos bajo carga.
    let token: string | null = null
    for (let i = 0; i < 60; i += 1) {
      try {
        token = await findInvitationTokenByEmail(palermoId, INVITEE_EMAIL)
        break
      } catch {
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
    expect(token).not.toBeNull()
    expect((token ?? '').length).toBeGreaterThan(10)
  })
})

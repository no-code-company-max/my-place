import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { placeUrl } from '../../helpers/subdomain'
import { E2E_EMAILS, E2E_PLACES } from '../../fixtures/e2e-data'
import {
  countFlagsByTarget,
  createTestPost,
  deletePostById,
  deletePostBySlug,
  findUserIdByEmail,
} from '../../helpers/db'

/**
 * Moderación: owner (no es autor del post) reporta un post spec-scoped vía
 * modal `FlagModal`; admin ve el flag en cola `/settings/flags`.
 *
 * Post propio del spec + delete en afterAll → cascade borra el flag y aisla
 * del estado de otros flows. Serial porque el view admin depende del insert
 * del owner.
 */

const palermoSlug = E2E_PLACES.palermo.slug
const palermoId = E2E_PLACES.palermo.id

test.describe.configure({ mode: 'serial' })

test.describe('Moderación — Palermo', () => {
  let postId: string
  let specSlug: string

  test.beforeAll(async ({ browserName }) => {
    specSlug = `moderation-${browserName}`
    const memberAId = await findUserIdByEmail(E2E_EMAILS.memberA)
    await deletePostBySlug(palermoId, specSlug)
    postId = await createTestPost({
      placeId: palermoId,
      authorUserId: memberAId, // owner no es autor → puede flaggear
      slug: specSlug,
      title: 'Post objeto de moderación',
    })
  })

  test.afterAll(async () => {
    await deletePostById(postId)
  })

  test.describe('owner reporta (no es autor)', () => {
    test.use({ storageState: storageStateFor('owner') })

    test('abre modal → elige motivo → envía y queda registrado en DB', async ({ page }) => {
      test.setTimeout(60_000) // flagAction toca Supabase + RLS; puede tardar varios s.
      await page.goto(placeUrl(palermoSlug, `/conversations/${specSlug}`))
      await page.getByLabel('Reportar este contenido').first().click()

      await expect(page.getByRole('heading', { name: 'Reportar este contenido' })).toBeVisible()
      await page.getByLabel('Motivo').selectOption({ label: 'Spam o contenido comercial' })
      await page.getByRole('button', { name: /^Reportar$/ }).click()

      // Modal se cierra al completarse con éxito → buena señal de que la action corrió.
      // Timeout generoso para cubrir variance WebKit + parallel workers contra Supabase.
      await expect(page.getByRole('heading', { name: 'Reportar este contenido' })).toHaveCount(0, {
        timeout: 30_000,
      })
      await expect.poll(() => countFlagsByTarget('POST', postId), { timeout: 15_000 }).toBe(1)
    })
  })

  test.describe('admin ve el flag en /settings/flags', () => {
    test.use({ storageState: storageStateFor('admin') })

    test('cola pendientes muestra al menos un flag', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/settings/flags'))
      await expect(page.getByRole('button', { name: /^Ignorar$/ }).first()).toBeVisible()
    })
  })
})

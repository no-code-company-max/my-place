import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { placeUrl } from '../../helpers/subdomain'
import { E2E_EMAILS, E2E_PLACES } from '../../fixtures/e2e-data'
import {
  createTestPost,
  deletePostById,
  deletePostBySlug,
  findUserIdByEmail,
} from '../../helpers/db'

/**
 * Moderación inline (C.G.1): `PostAdminMenu` (kebab) en `PostDetail` con
 * Editar / Ocultar / Eliminar — admin VE el menú, autor miembro NO.
 *
 * Post propio del spec + delete en afterAll. Los efectos (hide filtra para
 * members; delete cascade) se cubren a nivel RLS + actions unit tests.
 */

const palermoSlug = E2E_PLACES.palermo.slug
const palermoId = E2E_PLACES.palermo.id

test.describe.configure({ mode: 'serial' })

test.describe('Admin inline — Palermo', () => {
  let postId: string
  let specSlug: string

  test.beforeAll(async ({ browserName }) => {
    specSlug = `admin-inline-${browserName}`
    const memberAId = await findUserIdByEmail(E2E_EMAILS.memberA)
    await deletePostBySlug(palermoId, specSlug)
    postId = await createTestPost({
      placeId: palermoId,
      authorUserId: memberAId,
      slug: specSlug,
      title: 'Post objeto de admin-inline',
    })
  })

  test.afterAll(async () => {
    await deletePostById(postId)
  })

  test.describe('como admin', () => {
    test.use({ storageState: storageStateFor('admin') })

    test('PostAdminMenu: kebab visible con items Editar / Ocultar / Eliminar', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, `/conversations/${specSlug}`))
      const kebab = page.getByLabel('Acciones de moderación').first()
      await expect(kebab).toBeVisible()
      await kebab.click()
      await expect(page.getByRole('menuitem', { name: /^Editar$/ })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: /^(Ocultar|Mostrar)$/ })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: /^Eliminar$/ })).toBeVisible()
    })
  })

  test.describe('como memberA (autor, no admin)', () => {
    test.use({ storageState: storageStateFor('memberA') })

    test('autor NO ve el kebab de moderación admin', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, `/conversations/${specSlug}`))
      await expect(page.getByRole('heading', { name: /Post objeto de admin-inline/ })).toBeVisible()
      await expect(page.getByLabel('Acciones de moderación')).toHaveCount(0)
    })
  })
})

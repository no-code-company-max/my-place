import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { placeUrl } from '../../helpers/subdomain'
import { E2E_EMAILS, E2E_PLACES } from '../../fixtures/e2e-data'
import { createTestPost, deletePostById, findUserIdByEmail } from '../../helpers/db'

/**
 * Flow Post CRUD (C.H, subset inicial — más flows agendados en C.H.1).
 *
 * Cubre:
 *   - Lista de conversaciones de un place contiene el post baseline.
 *   - No-member ve gate de login cuando intenta entrar al place.
 *
 * TODO (próximas iteraciones):
 *   - Crear post via form.
 *   - Editar post dentro de la ventana de 60s (OK).
 *   - Editar post fuera de ventana (denied) usando `backdatePost`.
 *   - Admin-hide + member ve 404 sobre el post.
 */

const palermoSlug = E2E_PLACES.palermo.slug

test.describe('Post CRUD — Palermo', () => {
  test.describe('como memberA (active member)', () => {
    test.use({ storageState: storageStateFor('memberA') })

    test('lista de conversaciones incluye el post baseline', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/conversations'))
      await expect(page.getByRole('heading', { name: /Conversaciones/i })).toBeVisible()
      await expect(page.getByText(/Post baseline Palermo/)).toBeVisible()
    })

    test('link "Nueva conversación" visible en header', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/conversations'))
      await expect(page.getByRole('link', { name: /Nueva conversación/i })).toBeVisible()
    })

    test('post >60s: botón Editar NO aparece para el autor (edit window expiró)', async ({
      page,
    }) => {
      // Crea un post propio del spec con `createdAt` retroactivo → ventana 60s
      // ya expiró. Aislado de `baseline-post` que usan otros flows.
      const memberAId = await findUserIdByEmail(E2E_EMAILS.memberA)
      const expiredPostId = await createTestPost({
        placeId: E2E_PLACES.palermo.id,
        authorUserId: memberAId,
        slug: 'post-crud-edit-expired',
        title: 'Edit window expired',
        backdate: '2 minutes',
      })
      try {
        await page.goto(placeUrl(palermoSlug, `/conversations/post-crud-edit-expired`))
        await expect(page.getByRole('heading', { name: /Edit window expired/ })).toBeVisible()
        const postArticle = page.getByRole('article').first()
        await expect(postArticle.getByRole('button', { name: /^Editar$/ })).toHaveCount(0)
        await expect(postArticle.getByRole('button', { name: /^Eliminar$/ })).toHaveCount(0)
      } finally {
        await deletePostById(expiredPostId)
      }
    })
  })

  test.describe('como nonMember (no pertenece al place)', () => {
    test.use({ storageState: storageStateFor('nonMember') })

    test('intentar abrir /conversations de palermo → bloqueado (redirige o 404)', async ({
      page,
    }) => {
      const response = await page.goto(placeUrl(palermoSlug, '/conversations'))
      // El middleware puede redirigir a login o a la landing; el server puede
      // devolver 404. Cualquiera de esos estados es aceptable mientras NO
      // exponga la lista.
      const url = page.url()
      const content = await page.content()
      const isBlocked =
        /\/login\?/.test(url) || /\/$/.test(new URL(url).pathname) || response?.status() === 404
      expect(isBlocked).toBe(true)
      expect(content).not.toContain('Post baseline Palermo')
    })
  })
})

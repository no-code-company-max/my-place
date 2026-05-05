import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { placeUrl } from '../../helpers/subdomain'
import {
  E2E_DISPLAY_NAMES,
  E2E_EMAILS,
  E2E_LIBRARY_CATEGORIES,
  E2E_LIBRARY_ITEMS,
  E2E_PLACES,
} from '../../fixtures/e2e-data'
import { findUserIdByEmail } from '../../helpers/db'
import { getTestPrisma } from '../../helpers/prisma'

/**
 * Flow R.7 — viewer + edit/archive own + ex-miembro snapshot edge case.
 *
 * Cubre:
 *   - memberA ve listing `/library` (3 categorías + bento "Recientes"
 *     con los 2 items baseline).
 *   - memberA navega a `/library/tutorials` y entra al item
 *     `tutorials-intro` (detail page con title + author "Admin E2E").
 *   - memberA edita su propio item `resources-doc` desde el menú
 *     contextual; el cambio se refleja en detail + listing.
 *   - memberA archiva su propio item `resources-doc`; el item
 *     desaparece del listing tanto para member como admin (la query
 *     filtra `archivedAt: null` para todos los viewers).
 *   - Item con autor ex-miembro post-erasure: la detail page muestra
 *     "ex-miembro" sin link al perfil.
 *
 * Cleanups idempotentes: revert con prisma directo bypassea el
 * optimistic locking del Post.version (válido para restore admin).
 *
 * Ver `docs/features/library/spec.md` § 4 + § 14.9.
 */

const palermoSlug = E2E_PLACES.palermo.slug
const palermoId = E2E_PLACES.palermo.id

const tutorialsCat = E2E_LIBRARY_CATEGORIES.tutorials
const resourcesCat = E2E_LIBRARY_CATEGORIES.resources
const presetOnlyCat = E2E_LIBRARY_CATEGORIES.presetOnly

const tutorialsIntro = E2E_LIBRARY_ITEMS.tutorialsIntro
const resourcesDoc = E2E_LIBRARY_ITEMS.resourcesDoc

/**
 * Body baseline tal cual lo crea el seed (`baselineBody` en
 * `tests/fixtures/e2e-seed.ts`). Replicado acá para el revert manual
 * tras el test de edit.
 */
function seedBaselineBody(title: string): {
  type: 'doc'
  content: Array<{ type: 'paragraph'; content: Array<{ type: 'text'; text: string }> }>
} {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: `${title} — baseline E2E.` }] }],
  }
}

test.describe('Library viewer + edit/archive own + ex-miembro snapshot — Palermo', () => {
  test.describe('memberA ve listing público de /library', () => {
    test.use({ storageState: storageStateFor('memberA') })

    test('lista las 3 categorías + bento "Recientes" con los 2 items baseline', async ({
      page,
    }) => {
      await page.goto(placeUrl(palermoSlug, '/library'))

      await expect(page.getByRole('heading', { name: /Biblioteca/, level: 1 })).toBeVisible()

      // 3 cards de categorías baseline.
      await expect(page.getByRole('heading', { name: tutorialsCat.title, level: 3 })).toBeVisible()
      await expect(page.getByRole('heading', { name: resourcesCat.title, level: 3 })).toBeVisible()
      await expect(page.getByRole('heading', { name: presetOnlyCat.title, level: 3 })).toBeVisible()

      // Bento "Recientes" + ambos items baseline visibles.
      const recents = page.getByRole('region', { name: 'Recientes' })
      await expect(recents).toBeVisible()
      await expect(recents.getByText(tutorialsIntro.title)).toBeVisible()
      await expect(recents.getByText(resourcesDoc.title)).toBeVisible()

      // Authors visibles en el meta de cada row.
      await expect(recents.getByText(E2E_DISPLAY_NAMES.admin)).toBeVisible()
      await expect(recents.getByText(E2E_DISPLAY_NAMES.memberA)).toBeVisible()
    })
  })

  test.describe('memberA navega a /library/tutorials → detail del item', () => {
    test.use({ storageState: storageStateFor('memberA') })

    test('ve el item listado y entra a la detail page', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, `/library/${tutorialsCat.slug}`))

      await expect(
        page.getByRole('heading', {
          name: `${tutorialsCat.emoji} ${tutorialsCat.title}`,
          level: 1,
        }),
      ).toBeVisible()

      // El item baseline aparece en el listado.
      const itemLink = page.getByRole('link', { name: new RegExp(tutorialsIntro.title) })
      await expect(itemLink).toBeVisible()

      // Click → detail page con URL canónica.
      await itemLink.click()
      await page.waitForURL(
        new RegExp(`/library/${tutorialsCat.slug}/${tutorialsIntro.postSlug}$`),
        { timeout: 10_000 },
      )

      // Header: título + author display name.
      await expect(
        page.getByRole('heading', { name: tutorialsIntro.title, level: 1 }),
      ).toBeVisible()
      await expect(page.getByText(E2E_DISPLAY_NAMES.admin)).toBeVisible()
    })
  })

  test.describe('memberA edita su propio item (resources-doc)', () => {
    test.use({ storageState: storageStateFor('memberA') })

    const updatedTitle = 'Doc actualizado E2E'

    test.afterAll(async () => {
      // Restore canónico del seed: title + body + bump de version
      // (bypassea optimistic locking — es restore administrativo).
      const prisma = getTestPrisma()
      await prisma.post
        .update({
          where: { id: resourcesDoc.postId },
          data: {
            title: resourcesDoc.title,
            body: seedBaselineBody(resourcesDoc.title),
            version: { increment: 1 },
          },
        })
        .catch(() => {})
    })

    test('edita el título desde el menú contextual y se refleja en detail + listing', async ({
      page,
    }) => {
      await page.goto(
        placeUrl(palermoSlug, `/library/${resourcesCat.slug}/${resourcesDoc.postSlug}`),
      )

      // Abrir el menú admin (kebab) y click "Editar" → /edit page.
      await page.getByRole('button', { name: 'Acciones del recurso' }).click()
      await page.getByRole('menuitem', { name: 'Editar' }).click()

      await page.waitForURL(
        new RegExp(`/library/${resourcesCat.slug}/${resourcesDoc.postSlug}/edit$`),
        { timeout: 10_000 },
      )

      // Cambiar el título y submit.
      const titleInput = page.getByLabel(/^Título$/)
      await titleInput.fill(updatedTitle)
      await page.getByRole('button', { name: /^Guardar cambios$/ }).click()

      // Redirect a la detail page con el título nuevo.
      await page.waitForURL(new RegExp(`/library/${resourcesCat.slug}/${resourcesDoc.postSlug}$`), {
        timeout: 10_000,
      })
      await expect(page.getByRole('heading', { name: updatedTitle, level: 1 })).toBeVisible()

      // El listing de la categoría también muestra el título nuevo.
      await page.goto(placeUrl(palermoSlug, `/library/${resourcesCat.slug}`))
      await expect(page.getByRole('link', { name: new RegExp(updatedTitle) })).toBeVisible()
    })
  })

  test.describe('memberA archiva su propio item (resources-doc)', () => {
    test.use({ storageState: storageStateFor('memberA') })

    test.afterAll(async () => {
      // Restore: desarchivar para que el seed quede como antes del run.
      const prisma = getTestPrisma()
      await prisma.libraryItem
        .update({
          where: { id: resourcesDoc.id },
          data: { archivedAt: null },
        })
        .catch(() => {})
    })

    test('archiva el item; desaparece del listing para member y admin', async ({
      page,
      browser,
    }) => {
      // Defensivo: si una corrida anterior dejó el item archivado, restaurarlo
      // antes del test para mantener idempotencia.
      const prisma = getTestPrisma()
      await prisma.libraryItem
        .update({ where: { id: resourcesDoc.id }, data: { archivedAt: null } })
        .catch(() => {})

      await page.goto(
        placeUrl(palermoSlug, `/library/${resourcesCat.slug}/${resourcesDoc.postSlug}`),
      )

      // Abrir el menú admin → click "Archivar" → confirm dialog → "Archivar".
      await page.getByRole('button', { name: 'Acciones del recurso' }).click()
      await page.getByRole('menuitem', { name: 'Archivar' }).click()

      const dialog = page.getByRole('dialog')
      await expect(dialog.getByText('Archivar recurso')).toBeVisible()
      await dialog.getByRole('button', { name: /^Archivar$/ }).click()

      // El menú redirige al listado de la categoría tras archivar.
      await page.waitForURL(new RegExp(`/library/${resourcesCat.slug}$`), { timeout: 10_000 })

      // El item ya no aparece en el listing para memberA.
      await expect(page.getByRole('link', { name: new RegExp(resourcesDoc.title) })).toHaveCount(0)

      // Tampoco lo ve admin (la query `listItemsByCategory` filtra
      // `archivedAt: null` para todos los viewers).
      const adminContext = await browser.newContext({ storageState: storageStateFor('admin') })
      const adminPage = await adminContext.newPage()
      await adminPage.goto(placeUrl(palermoSlug, `/library/${resourcesCat.slug}`))
      await expect(
        adminPage.getByRole('link', { name: new RegExp(resourcesDoc.title) }),
      ).toHaveCount(0)

      // Pero admin puede acceder a la detail page directamente y ve
      // el badge "Archivado".
      await adminPage.goto(
        placeUrl(palermoSlug, `/library/${resourcesCat.slug}/${resourcesDoc.postSlug}`),
      )
      await expect(
        adminPage.getByRole('heading', { name: resourcesDoc.title, level: 1 }),
      ).toBeVisible()
      await expect(adminPage.getByText('Archivado')).toBeVisible()

      await adminContext.close()
    })
  })

  test.describe('item con autor ex-miembro post-erasure', () => {
    test.use({ storageState: storageStateFor('memberA') })

    const tempItemId = 'item_e2e_tmp_exmember_doc'
    const tempPostId = 'post_e2e_tmp_exmember_doc'
    const tempPostSlug = 'e2e-tmp-exmember-doc'
    const tempTitle = 'Recurso de un ex-miembro E2E'

    test.beforeAll(async () => {
      const prisma = getTestPrisma()

      // Cleanup defensivo previo (idempotencia entre runs).
      await prisma.libraryItem.delete({ where: { id: tempItemId } }).catch(() => {})
      await prisma.post.delete({ where: { id: tempPostId } }).catch(() => {})

      // Crear el Post + LibraryItem inicialmente con autor exMember real.
      const exMemberUserId = await findUserIdByEmail(E2E_EMAILS.exMember)
      await prisma.post.create({
        data: {
          id: tempPostId,
          placeId: palermoId,
          authorUserId: exMemberUserId,
          authorSnapshot: { displayName: E2E_DISPLAY_NAMES.exMember, avatarUrl: null },
          title: tempTitle,
          slug: tempPostSlug,
          body: seedBaselineBody(tempTitle),
        },
      })
      await prisma.libraryItem.create({
        data: {
          id: tempItemId,
          placeId: palermoId,
          categoryId: tutorialsCat.id,
          postId: tempPostId,
          authorUserId: exMemberUserId,
          authorSnapshot: { displayName: E2E_DISPLAY_NAMES.exMember, avatarUrl: null },
        },
      })

      // Aplicar el efecto del job de erasure 365d sobre LibraryItem
      // (source of truth del slice library): clear authorUserId y
      // reescribir authorSnapshot.displayName a "ex-miembro".
      await prisma.libraryItem.update({
        where: { id: tempItemId },
        data: {
          authorUserId: null,
          authorSnapshot: { displayName: 'ex-miembro', avatarUrl: null },
        },
      })
    })

    test.afterAll(async () => {
      const prisma = getTestPrisma()
      // LibraryItem cascade-borra al borrar el Post asociado, pero
      // borramos ambos explícitamente para ser robustos.
      await prisma.libraryItem.delete({ where: { id: tempItemId } }).catch(() => {})
      await prisma.post.delete({ where: { id: tempPostId } }).catch(() => {})
    })

    test('detail page muestra "ex-miembro" sin link al perfil', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, `/library/${tutorialsCat.slug}/${tempPostSlug}`))

      // Título del recurso visible (page no rompe).
      await expect(page.getByRole('heading', { name: tempTitle, level: 1 })).toBeVisible()

      // Display name "ex-miembro" visible en el header.
      await expect(page.getByText('ex-miembro', { exact: true })).toBeVisible()

      // Sin link al profile del autor: el header no debe tener un
      // <a href="/m/..."> envolviendo el display name (porque
      // `item.authorUserId` es null tras erasure).
      await expect(page.getByRole('link', { name: /ex-miembro/i })).toHaveCount(0)
    })
  })
})

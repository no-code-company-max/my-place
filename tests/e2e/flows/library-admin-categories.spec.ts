import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { placeUrl } from '../../helpers/subdomain'
import { E2E_LIBRARY_CATEGORIES, E2E_PLACES } from '../../fixtures/e2e-data'
import { getTestPrisma } from '../../helpers/prisma'

/**
 * Flow R.7.3 / R.7.4 — Admin CRUD de categorías de Library en Palermo.
 *
 * Cubre:
 *   - Listing en `/library` muestra las 3 categorías baseline del seed.
 *   - Admin crea una categoría nueva via `/settings/library` → aparece
 *     en el listing (cleanup en afterAll).
 *   - Admin edita el título de la categoría `tutorials` → cambio
 *     reflejado en `/library` (revert en afterAll).
 *   - Admin cambia `contributionPolicy` de `tutorials` MEMBERS_OPEN
 *     → ADMIN_ONLY → label en settings refleja el cambio (revert en
 *     afterAll).
 *   - memberA (no admin) intenta abrir `/settings/library` → 404 / sin
 *     acceso (notFound del settings layout).
 *
 * Las mutaciones tocan el seed compartido en my-place Cloud, así que los
 * cleanups son obligatorios y defensivos: corren `try/catch` y restauran
 * el estado canónico de `E2E_LIBRARY_CATEGORIES.tutorials`.
 *
 * Ver `docs/features/library/spec.md` § 14.3.
 */

const palermoSlug = E2E_PLACES.palermo.slug
const tutorialsCat = E2E_LIBRARY_CATEGORIES.tutorials
const resourcesCat = E2E_LIBRARY_CATEGORIES.resources
const presetOnlyCat = E2E_LIBRARY_CATEGORIES.presetOnly

const NEW_CATEGORY_TITLE = 'Test E2E Cat'
const NEW_CATEGORY_EMOJI = '🧪'

test.describe('Library admin categories — Palermo', () => {
  test.describe('listing público en /library', () => {
    test.use({ storageState: storageStateFor('admin') })

    test('admin ve las 3 categorías baseline (tutorials, resources, restringida)', async ({
      page,
    }) => {
      await page.goto(placeUrl(palermoSlug, '/library'))
      await expect(page.getByRole('heading', { name: /Biblioteca/, level: 1 })).toBeVisible()

      await expect(page.getByRole('heading', { name: tutorialsCat.title, level: 3 })).toBeVisible()
      await expect(page.getByRole('heading', { name: resourcesCat.title, level: 3 })).toBeVisible()
      await expect(page.getByRole('heading', { name: presetOnlyCat.title, level: 3 })).toBeVisible()
    })
  })

  test.describe('crear categoría nueva', () => {
    test.use({ storageState: storageStateFor('admin') })

    test.afterAll(async () => {
      // Borra cualquier categoría creada por el spec en cualquier corrida
      // (matchea por título único). Defensivo: idempotente.
      const prisma = getTestPrisma()
      await prisma.libraryCategory
        .deleteMany({
          where: { placeId: E2E_PLACES.palermo.id, title: NEW_CATEGORY_TITLE },
        })
        .catch(() => {})
    })

    test('admin crea categoría desde /settings/library y aparece en /library', async ({ page }) => {
      // Cleanup defensivo previo: si una corrida anterior dejó la
      // categoría, eliminarla antes de empezar para garantizar
      // idempotencia.
      const prisma = getTestPrisma()
      await prisma.libraryCategory
        .deleteMany({
          where: { placeId: E2E_PLACES.palermo.id, title: NEW_CATEGORY_TITLE },
        })
        .catch(() => {})

      await page.goto(placeUrl(palermoSlug, '/settings/library'))
      await expect(page.getByRole('heading', { name: /Biblioteca/i })).toBeVisible()

      // Trigger del dialog: el componente lo monta como botón con
      // aria-label="Nueva categoría".
      await page.getByRole('button', { name: 'Nueva categoría' }).first().click()

      // Form fields del dialog.
      await page.getByLabel('Emoji').fill(NEW_CATEGORY_EMOJI)
      await page.getByLabel('Título').fill(NEW_CATEGORY_TITLE)
      await page.getByLabel(/Quién puede agregar contenido/i).selectOption('MEMBERS_OPEN')

      await page.getByRole('button', { name: /^Crear categoría$/ }).click()

      // Verificación: la nueva categoría aparece en el listing del
      // settings page (revalidate del action lo refresca).
      await expect(page.getByRole('heading', { name: NEW_CATEGORY_TITLE, level: 3 })).toBeVisible()

      // Y en la zona pública de /library también.
      await page.goto(placeUrl(palermoSlug, '/library'))
      await expect(page.getByRole('heading', { name: NEW_CATEGORY_TITLE, level: 3 })).toBeVisible()
    })
  })

  test.describe('editar título de categoría existente', () => {
    test.use({ storageState: storageStateFor('admin') })

    const updatedTitle = 'Tutoriales actualizados'

    test.afterAll(async () => {
      // Restaurar el título canónico del seed.
      const prisma = getTestPrisma()
      await prisma.libraryCategory
        .update({
          where: { id: tutorialsCat.id },
          data: { title: tutorialsCat.title },
        })
        .catch(() => {})
    })

    test('admin edita título y se refleja en /library', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/settings/library'))

      // Localizar la fila de "Tutoriales" y abrir su sheet "Editar".
      // El listado usa <li> + heading + dropdown trigger ("Opciones para …")
      // con menuitem "Editar" que abre el `<CategoryFormSheet>`.
      const tutorialsRow = page.getByRole('listitem').filter({ hasText: tutorialsCat.title })
      await tutorialsRow
        .getByRole('button', { name: `Opciones para ${tutorialsCat.title}` })
        .click()
      await page.getByRole('menuitem', { name: 'Editar' }).click()

      const titleInput = page.getByLabel('Título')
      await titleInput.fill(updatedTitle)
      await page.getByRole('button', { name: /^Guardar cambios$/ }).click()

      await expect(page.getByRole('heading', { name: updatedTitle, level: 3 })).toBeVisible()

      await page.goto(placeUrl(palermoSlug, '/library'))
      await expect(page.getByRole('heading', { name: updatedTitle, level: 3 })).toBeVisible()
    })
  })

  test.describe('cambiar contributionPolicy', () => {
    test.use({ storageState: storageStateFor('admin') })

    test.afterAll(async () => {
      // Restaurar policy canónica del seed.
      const prisma = getTestPrisma()
      await prisma.libraryCategory
        .update({
          where: { id: tutorialsCat.id },
          data: { contributionPolicy: tutorialsCat.policy },
        })
        .catch(() => {})
    })

    test('admin cambia policy de MEMBERS_OPEN a DESIGNATED y label refleja el cambio', async ({
      page,
    }) => {
      await page.goto(placeUrl(palermoSlug, '/settings/library'))

      const tutorialsRow = page.getByRole('listitem').filter({ hasText: tutorialsCat.title })
      await tutorialsRow
        .getByRole('button', { name: `Opciones para ${tutorialsCat.title}` })
        .click()
      await page.getByRole('menuitem', { name: 'Editar' }).click()

      await page.getByLabel(/Quién puede agregar contenido/i).selectOption('DESIGNATED')
      await page.getByRole('button', { name: /^Guardar cambios$/ }).click()

      // El label en el row se computa con `contributionPolicyLabel` →
      // "Personas designadas" para DESIGNATED. Esperamos que esa fila lo
      // muestre tras la revalidación.
      const updatedRow = page.getByRole('listitem').filter({ hasText: tutorialsCat.title })
      await expect(updatedRow.getByText('Personas designadas')).toBeVisible()
    })
  })

  test.describe('member común no accede a /settings/library', () => {
    test.use({ storageState: storageStateFor('memberA') })

    test('memberA recibe 404 en /settings/library', async ({ page }) => {
      const response = await page.goto(placeUrl(palermoSlug, '/settings/library'))
      // El layout `/settings/layout.tsx` llama `notFound()` cuando el
      // viewer no es admin/owner. Aceptamos 404 explícito o cualquier
      // forma de bloqueo (redirect a login si la sesión no se honra).
      const status = response?.status() ?? 0
      const url = page.url()
      const content = await page.content()
      const isBlocked = status === 404 || /\/login\?/.test(url)
      expect(isBlocked).toBe(true)
      // Y nada del UI admin debe verse.
      expect(content).not.toContain('Nueva categoría')
    })
  })
})

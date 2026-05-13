import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { placeUrl } from '../../helpers/subdomain'
import { E2E_LIBRARY_CATEGORIES, E2E_PLACES } from '../../fixtures/e2e-data'
import { getTestPrisma } from '../../helpers/prisma'

/**
 * Flow R.7.3 + S2/S3 — Admin CRUD de categorías de Library en Palermo.
 *
 * **Rewrite S4 (2026-05-13):** adaptado al modelo de permisos v2 +
 * wizard 4-step (Identidad → Escritura → Lectura → Tipo).
 *
 * Cubre:
 *   - Listing en `/library` muestra las 3 categorías baseline del seed.
 *   - Admin crea una categoría nueva via `/settings/library` con defaults
 *     (writeAccessKind=OWNER_ONLY, readAccessKind=PUBLIC, kind=GENERAL).
 *   - Admin edita el título de la categoría `tutorials` via Pencil icon
 *     en RowActions inline.
 *   - memberA (no admin) intenta abrir `/settings/library` → 404 / sin
 *     acceso.
 *
 * Las mutaciones tocan el seed compartido en my-place Cloud, así que los
 * cleanups son obligatorios y defensivos. Cada describe restaura el
 * estado canónico de `E2E_LIBRARY_CATEGORIES.tutorials`.
 *
 * Wizard navigation: cada step intermedio tiene botón "Siguiente"; el
 * último step tiene "Guardar". El primer step ya viene con la validación
 * a true para los defaults (writeAccessKind/readAccessKind/kind no
 * requieren input), así que crear con defaults = 3 × "Siguiente" + 1 ×
 * "Guardar".
 *
 * Ver `docs/features/library/spec.md` § 14.3 y
 * `docs/plans/2026-05-12-library-permissions-redesign.md` § S3.
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

  test.describe('crear categoría nueva (wizard 4-step con defaults)', () => {
    test.use({ storageState: storageStateFor('admin') })

    test.afterAll(async () => {
      const prisma = getTestPrisma()
      await prisma.libraryCategory
        .deleteMany({
          where: { placeId: E2E_PLACES.palermo.id, title: NEW_CATEGORY_TITLE },
        })
        .catch(() => {})
    })

    test('admin crea categoría desde /settings/library y aparece en /library', async ({ page }) => {
      const prisma = getTestPrisma()
      await prisma.libraryCategory
        .deleteMany({
          where: { placeId: E2E_PLACES.palermo.id, title: NEW_CATEGORY_TITLE },
        })
        .catch(() => {})

      await page.goto(placeUrl(palermoSlug, '/settings/library'))
      await expect(page.getByRole('heading', { name: /Biblioteca/i })).toBeVisible()

      // Trigger: el panel monta el dashed-border "+ Nueva categoría".
      await page.getByRole('button', { name: /Nueva categoría/i }).click()

      // Step 1: Identidad (emoji + título).
      await page.getByLabel(/Emoji/i).fill(NEW_CATEGORY_EMOJI)
      await page.getByLabel(/Título/i).fill(NEW_CATEGORY_TITLE)
      await page.getByRole('button', { name: 'Siguiente' }).click()

      // Step 2: Escritura — default OWNER_ONLY.
      await page.getByRole('button', { name: 'Siguiente' }).click()

      // Step 3: Lectura — default PUBLIC.
      await page.getByRole('button', { name: 'Siguiente' }).click()

      // Step 4: Tipo — default GENERAL. Guardar finaliza.
      await page.getByRole('button', { name: 'Guardar' }).click()

      // La nueva categoría aparece en el listing del settings page.
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
      const prisma = getTestPrisma()
      await prisma.libraryCategory
        .update({
          where: { id: tutorialsCat.id },
          data: { title: tutorialsCat.title },
        })
        .catch(() => {})
    })

    test('admin edita título via Pencil icon y se refleja en /library', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/settings/library'))

      // RowActions (S3) usa inline icon buttons. El Pencil tiene
      // aria-label="Editar ${title}".
      await page.getByRole('button', { name: `Editar ${tutorialsCat.title}` }).click()

      // Wizard abre en mode=edit. Step 1 ya tiene el título original.
      const titleInput = page.getByLabel(/Título/i)
      await titleInput.fill(updatedTitle)
      await page.getByRole('button', { name: 'Siguiente' }).click()
      await page.getByRole('button', { name: 'Siguiente' }).click()
      await page.getByRole('button', { name: 'Siguiente' }).click()
      await page.getByRole('button', { name: 'Guardar' }).click()

      await expect(page.getByRole('heading', { name: updatedTitle, level: 3 })).toBeVisible()

      await page.goto(placeUrl(palermoSlug, '/library'))
      await expect(page.getByRole('heading', { name: updatedTitle, level: 3 })).toBeVisible()
    })
  })

  test.describe('member común no accede a /settings/library', () => {
    test.use({ storageState: storageStateFor('memberA') })

    test('memberA recibe 404 en /settings/library', async ({ page }) => {
      const response = await page.goto(placeUrl(palermoSlug, '/settings/library'))
      const status = response?.status() ?? 0
      const url = page.url()
      const content = await page.content()
      const isBlocked = status === 404 || /\/login\?/.test(url)
      expect(isBlocked).toBe(true)
      expect(content).not.toContain('Nueva categoría')
    })
  })
})

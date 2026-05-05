import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { placeUrl } from '../../helpers/subdomain'
import {
  E2E_DISPLAY_NAMES,
  E2E_EMAILS,
  E2E_LIBRARY_CATEGORIES,
  E2E_PLACES,
} from '../../fixtures/e2e-data'
import { findUserIdByEmail } from '../../helpers/db'
import { getTestPrisma } from '../../helpers/prisma'

/**
 * Flow R.7 — FAB visibility por rol/policy + admin contributors queue.
 *
 * Cubre:
 *   - FAB visibility: el item "Nuevo recurso" del menú aparece según
 *     `canCreateInAnyCategoryForViewer` (admin/owner siempre, memberA y
 *     memberB cuando hay categorías elegibles).
 *   - Edge: cuando todas las categorías del place son ADMIN_ONLY,
 *     memberB no ve "Nuevo recurso" (las otras dos opciones siguen).
 *   - Admin contributors queue (R.7.4): listado, invitar a un nuevo
 *     contributor (memberB) y remove + re-invite de memberA en
 *     `resources` (DESIGNATED).
 *
 * Cleanups idempotentes: cada describe que muta el seed restaura el
 * estado canónico en `afterAll`. Los `beforeAll` también limpian de
 * forma defensiva por si una corrida anterior dejó residuos.
 *
 * Ver `docs/features/library/spec.md` § 14.3 (admin) + § 14.6 (FAB).
 */

const palermoSlug = E2E_PLACES.palermo.slug

const tutorialsCat = E2E_LIBRARY_CATEGORIES.tutorials
const resourcesCat = E2E_LIBRARY_CATEGORIES.resources

test.describe('Library FAB visibility + admin contributors queue — Palermo', () => {
  test.describe('FAB visibility por rol y categoría en /library', () => {
    test.describe('admin', () => {
      test.use({ storageState: storageStateFor('admin') })

      test('admin ve "Nuevo recurso" en el FAB', async ({ page }) => {
        await page.goto(placeUrl(palermoSlug, '/library'))
        await page.getByRole('button', { name: /Acciones/i }).click()
        await expect(page.getByRole('menuitem', { name: /Nuevo recurso/i })).toBeVisible()
      })
    })

    test.describe('memberA (contributor de resources + member común)', () => {
      test.use({ storageState: storageStateFor('memberA') })

      test('memberA ve "Nuevo recurso" en el FAB', async ({ page }) => {
        // memberA es elegible por dos vías: tutorials (MEMBERS_OPEN) y
        // resources (DESIGNATED, memberA contributor por seed).
        await page.goto(placeUrl(palermoSlug, '/library'))
        await page.getByRole('button', { name: /Acciones/i }).click()
        await expect(page.getByRole('menuitem', { name: /Nuevo recurso/i })).toBeVisible()
      })
    })

    test.describe('memberB (member común sin contributor designation)', () => {
      test.use({ storageState: storageStateFor('memberB') })

      test('memberB ve "Nuevo recurso" porque tutorials es MEMBERS_OPEN', async ({ page }) => {
        // memberB no es contributor de resources ni admin, pero la
        // policy de tutorials (MEMBERS_OPEN) lo habilita → el FAB debe
        // exponer el item.
        await page.goto(placeUrl(palermoSlug, '/library'))
        await page.getByRole('button', { name: /Acciones/i }).click()
        await expect(page.getByRole('menuitem', { name: /Nuevo recurso/i })).toBeVisible()
      })
    })

    test.describe('memberB sin categorías elegibles (todas restringidas)', () => {
      test.use({ storageState: storageStateFor('memberB') })

      test.beforeAll(async () => {
        // Cambiar tutorials a DESIGNATED (sin contributors) deja al place
        // sin ninguna categoría elegible para memberB (resources DESIGNATED
        // sin designation + presetOnly DESIGNATED + tutorials DESIGNATED).
        // Post-2026-05-04 ADR drop ADMIN_ONLY, DESIGNATED con lista vacía
        // produce el mismo efecto comportamental que el viejo ADMIN_ONLY.
        const prisma = getTestPrisma()
        await prisma.libraryCategory.update({
          where: { id: tutorialsCat.id },
          data: { contributionPolicy: 'DESIGNATED' },
        })
      })

      test.afterAll(async () => {
        // Restaurar policy canónica del seed: MEMBERS_OPEN.
        const prisma = getTestPrisma()
        await prisma.libraryCategory
          .update({
            where: { id: tutorialsCat.id },
            data: { contributionPolicy: tutorialsCat.policy },
          })
          .catch(() => {})
      })

      test('memberB NO ve "Nuevo recurso", pero sí "Nueva discusión" y "Proponer evento"', async ({
        page,
      }) => {
        await page.goto(placeUrl(palermoSlug, '/library'))
        await page.getByRole('button', { name: /Acciones/i }).click()

        // Las dos opciones cross-zona siguen visibles.
        await expect(page.getByRole('menuitem', { name: /Nueva discusión/i })).toBeVisible()
        await expect(page.getByRole('menuitem', { name: /Proponer evento/i })).toBeVisible()

        // El item de library queda oculto porque
        // `canCreateInAnyCategoryForViewer` resuelve a false para memberB.
        await expect(page.getByRole('menuitem', { name: /Nuevo recurso/i })).toHaveCount(0)
      })
    })
  })

  test.describe('Admin contributors queue (resources DESIGNATED)', () => {
    test.use({ storageState: storageStateFor('admin') })

    test.afterAll(async () => {
      // Restaurar el set canónico del seed: solo memberA es contributor
      // de resources. Borramos cualquier otra fila y nos aseguramos
      // de que memberA esté presente.
      const prisma = getTestPrisma()
      const adminUserId = await findUserIdByEmail(E2E_EMAILS.admin).catch(() => null)
      const memberAUserId = await findUserIdByEmail(E2E_EMAILS.memberA).catch(() => null)

      await prisma.libraryCategoryContributor
        .deleteMany({ where: { categoryId: resourcesCat.id } })
        .catch(() => {})

      if (memberAUserId && adminUserId) {
        await prisma.libraryCategoryContributor
          .create({
            data: {
              categoryId: resourcesCat.id,
              userId: memberAUserId,
              invitedByUserId: adminUserId,
            },
          })
          .catch(() => {})
      }
    })

    test('admin lista contributors actuales de resources (memberA presente)', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/settings/library'))

      // Localizar la fila de "Recursos" (DESIGNATED) y abrir el dialog
      // con el affordance accesible "Gestionar contribuidores de Recursos".
      const resourcesRow = page.getByRole('listitem').filter({ hasText: resourcesCat.title })
      await resourcesRow
        .getByRole('button', { name: `Gestionar contribuidores de ${resourcesCat.title}` })
        .click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByText(E2E_DISPLAY_NAMES.memberA)).toBeVisible()
    })

    test('admin invita a memberB como contributor de resources', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/settings/library'))

      const resourcesRow = page.getByRole('listitem').filter({ hasText: resourcesCat.title })
      await resourcesRow
        .getByRole('button', { name: `Gestionar contribuidores de ${resourcesCat.title}` })
        .click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // El picker filtra por displayName/handle. Tipear el displayName
      // de memberB acota la lista al candidato esperado.
      const search = dialog.getByLabel('Agregar contribuidor')
      await search.fill(E2E_DISPLAY_NAMES.memberB)

      // Click en el botón "Invitar" del candidato — el botón engloba
      // displayName + el span "Invitar". Buscamos por nombre del row.
      await dialog.getByRole('button', { name: new RegExp(E2E_DISPLAY_NAMES.memberB) }).click()

      // Optimistic update: memberB aparece inmediatamente en la lista
      // de contributors del dialog.
      await expect(dialog.getByText(E2E_DISPLAY_NAMES.memberB)).toBeVisible()
    })

    test('admin remueve memberA y luego lo re-invita (idempotencia)', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/settings/library'))

      const resourcesRow = page.getByRole('listitem').filter({ hasText: resourcesCat.title })
      await resourcesRow
        .getByRole('button', { name: `Gestionar contribuidores de ${resourcesCat.title}` })
        .click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // Localizar la fila de memberA dentro de la lista de contributors
      // y click en "Quitar".
      const memberARow = dialog.getByRole('listitem').filter({ hasText: E2E_DISPLAY_NAMES.memberA })
      await expect(memberARow).toBeVisible()
      await memberARow.getByRole('button', { name: /^Quitar$/ }).click()

      // memberA desaparece de la lista (optimistic).
      await expect(
        dialog.getByRole('listitem').filter({ hasText: E2E_DISPLAY_NAMES.memberA }),
      ).toHaveCount(0)

      // Re-invitar a memberA via el buscador.
      const search = dialog.getByLabel('Agregar contribuidor')
      await search.fill(E2E_DISPLAY_NAMES.memberA)
      await dialog.getByRole('button', { name: new RegExp(E2E_DISPLAY_NAMES.memberA) }).click()

      // memberA reaparece en la lista de contributors.
      await expect(
        dialog.getByRole('listitem').filter({ hasText: E2E_DISPLAY_NAMES.memberA }),
      ).toBeVisible()
    })
  })
})

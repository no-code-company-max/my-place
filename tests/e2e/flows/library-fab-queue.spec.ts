import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { placeUrl } from '../../helpers/subdomain'
import { E2E_PLACES } from '../../fixtures/e2e-data'

/**
 * Flow — FAB visibility por write access kind en library.
 *
 * **Rewrite S4 (2026-05-13):** adaptado al modelo writeAccessKind v2.
 *
 * Cubre:
 *   - FAB visibility: el item "Nuevo recurso" aparece según
 *     `canWriteInAnyCategory` del sub-slice `library/contribution`.
 *   - Admin/owner SIEMPRE ve el FAB (owner bypass).
 *   - memberA es write-scoped en `resources` (writeAccessKind=USERS,
 *     writeUserRoles=['memberA']) → ve el FAB.
 *   - memberB NO está en ningún write scope; las 3 categorías baseline
 *     son OWNER_ONLY o USERS sin él → NO ve el FAB.
 *
 * Las decisiones de gating viven en `canWriteInAnyCategory` (cubierto
 * por unit tests). Estos e2e solo verifican que la UI gateá según el
 * gate del backend.
 */

const palermoSlug = E2E_PLACES.palermo.slug

test.describe('Library FAB visibility — Palermo', () => {
  test.describe('FAB visibility por rol y categoría en /library', () => {
    test.describe('admin', () => {
      test.use({ storageState: storageStateFor('admin') })

      test('admin ve "Nuevo recurso" en el FAB', async ({ page }) => {
        await page.goto(placeUrl(palermoSlug, '/library'))
        await page.getByRole('button', { name: /Acciones/i }).click()
        await expect(page.getByRole('menuitem', { name: /Nuevo recurso/i })).toBeVisible()
      })
    })

    test.describe('memberA (write-scoped en resources)', () => {
      test.use({ storageState: storageStateFor('memberA') })

      test('memberA ve "Nuevo recurso" en el FAB (USERS scope en resources)', async ({ page }) => {
        // memberA está en `LibraryCategoryUserWriteScope` para resources
        // (fixture writeUserRoles=['memberA']). `canWriteInAnyCategory`
        // matchea por user scope → habilita el FAB item.
        await page.goto(placeUrl(palermoSlug, '/library'))
        await page.getByRole('button', { name: /Acciones/i }).click()
        await expect(page.getByRole('menuitem', { name: /Nuevo recurso/i })).toBeVisible()
      })
    })

    test.describe('memberB (sin write scope en ninguna categoría)', () => {
      test.use({ storageState: storageStateFor('memberB') })

      // Las 3 categorías baseline son OWNER_ONLY (tutorials, presetOnly)
      // o USERS sin memberB (resources). `canWriteInAnyCategory` →
      // false → FAB oculta el item.
      test('memberB NO ve "Nuevo recurso", pero sí "Nueva discusión" y "Proponer evento"', async ({
        page,
      }) => {
        await page.goto(placeUrl(palermoSlug, '/library'))
        await page.getByRole('button', { name: /Acciones/i }).click()

        // Las dos opciones cross-zona siguen visibles.
        await expect(page.getByRole('menuitem', { name: /Nueva discusión/i })).toBeVisible()
        await expect(page.getByRole('menuitem', { name: /Proponer evento/i })).toBeVisible()

        // Library FAB item oculto.
        await expect(page.getByRole('menuitem', { name: /Nuevo recurso/i })).toHaveCount(0)
      })
    })
  })
})

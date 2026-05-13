import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { placeUrl } from '../../helpers/subdomain'
import { E2E_PLACES } from '../../fixtures/e2e-data'

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

      // S1b (2026-05-13): el modelo nuevo writeAccessKind hace que las 3
      // categorías baseline (tutorials/resources/presetOnly) ya bloqueen
      // a memberB por default (OWNER_ONLY o USERS sin él en el scope).
      // No hace falta mutar nada con beforeAll.

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

  // S1b (2026-05-13): bloque "Admin contributors queue" removido.
  // El dialog legacy "Gestionar contribuidores" se eliminó junto con
  // la tabla `LibraryCategoryContributor`. La gestión de write access
  // (incluyendo elegir usuarios designados) vive ahora en el wizard
  // unificado de categoría — los E2E nuevos se suman en S2/S3.
})

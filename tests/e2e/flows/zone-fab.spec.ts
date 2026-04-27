import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { placeUrl } from '../../helpers/subdomain'
import { E2E_PLACES } from '../../fixtures/e2e-data'

/**
 * Flow R.2.6 — Zone FAB cross-zona.
 *
 * Cubre el comportamiento del `<ZoneFab>` (orquestador) + `<FAB>`
 * (primitivo) montados en `(gated)/layout`:
 *   - Visibilidad solo en zonas root, pass-through en sub-pages.
 *   - Click abre menú con items "Nueva discusión" + "Proponer evento".
 *   - Items navegan a `/conversations/new` y `/events/new`.
 *   - Settings y sub-pages no muestran el FAB.
 *
 * Ver `docs/features/shell/spec.md` § 17 + ADR
 * `docs/decisions/2026-04-26-zone-fab.md`.
 */

const palermoSlug = E2E_PLACES.palermo.slug

test.describe('ZoneFab — Palermo', () => {
  test.use({ storageState: storageStateFor('memberA') })

  test.describe('visibilidad — solo zonas root', () => {
    test('en `/` (Inicio) el FAB es visible', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/'))
      await expect(page.getByRole('button', { name: /Acciones/i })).toBeVisible()
    })

    test('en `/conversations` el FAB es visible', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/conversations'))
      await expect(page.getByRole('button', { name: /Acciones/i })).toBeVisible()
    })

    test('en `/events` el FAB es visible', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/events'))
      await expect(page.getByRole('button', { name: /Acciones/i })).toBeVisible()
    })
  })

  test.describe('pass-through — sub-pages no muestran FAB', () => {
    test('en sub-page de conversation (thread detail) el FAB NO es visible', async ({ page }) => {
      // Usa el baseline post seedeado (existe siempre en e2e-palermo).
      await page.goto(placeUrl(palermoSlug, '/conversations/e2e-baseline-post'))
      await expect(page.getByRole('button', { name: /Acciones/i })).toHaveCount(0)
    })

    test('en `/conversations/new` el FAB NO es visible', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/conversations/new'))
      await expect(page.getByRole('button', { name: /Acciones/i })).toHaveCount(0)
    })

    test('en `/events/new` el FAB NO es visible', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/events/new'))
      await expect(page.getByRole('button', { name: /Acciones/i })).toHaveCount(0)
    })
  })

  test.describe('settings — fuera de gated, FAB no monta', () => {
    test.use({ storageState: storageStateFor('admin') })

    test('en `/settings/hours` el FAB NO es visible', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/settings/hours'))
      await expect(page.getByRole('button', { name: /Acciones/i })).toHaveCount(0)
    })
  })

  test.describe('menú — items y navegación', () => {
    test('click en FAB abre menú con "Nueva discusión" y "Proponer evento"', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/conversations'))
      await page.getByRole('button', { name: /Acciones/i }).click()
      await expect(page.getByRole('menuitem', { name: /Nueva discusión/i })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: /Proponer evento/i })).toBeVisible()
    })

    test('click en "Nueva discusión" navega a /conversations/new', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/conversations'))
      await page.getByRole('button', { name: /Acciones/i }).click()
      await page.getByRole('menuitem', { name: /Nueva discusión/i }).click()
      await page.waitForURL(/\/conversations\/new$/)
      expect(new URL(page.url()).pathname).toBe('/conversations/new')
    })

    test('click en "Proponer evento" navega a /events/new', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/events'))
      await page.getByRole('button', { name: /Acciones/i }).click()
      await page.getByRole('menuitem', { name: /Proponer evento/i }).click()
      await page.waitForURL(/\/events\/new$/)
      expect(new URL(page.url()).pathname).toBe('/events/new')
    })

    test('Escape cierra el menú abierto', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/'))
      const trigger = page.getByRole('button', { name: /Acciones/i })
      await trigger.click()
      await expect(page.getByRole('menuitem', { name: /Nueva discusión/i })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('menuitem', { name: /Nueva discusión/i })).toHaveCount(0)
    })
  })
})

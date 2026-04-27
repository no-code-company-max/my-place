import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { placeUrl } from '../../helpers/subdomain'
import { E2E_PLACES } from '../../fixtures/e2e-data'
import { setPlaceAlwaysOpen, setPlaceClosedByKey } from '../../helpers/db'

/**
 * Hours gate (Fase 2.5). Se aísla en Belgrano para no pisar otros flows que
 * usan Palermo. Al finalizar cada test (aún en fallo) restauramos
 * `always_open` para no dejar basura entre runs.
 */

const belgranoId = E2E_PLACES.belgrano.id
const belgranoSlug = E2E_PLACES.belgrano.slug

test.describe.configure({ mode: 'serial' })

test.describe('Hours gate — Belgrano', () => {
  test.afterEach(async () => {
    await setPlaceAlwaysOpen(belgranoId)
  })

  test.describe('como memberB (miembro activo)', () => {
    test.use({ storageState: storageStateFor('memberB') })

    test('place cerrado → ve "Está cerrado" + FAB NO visible (R.2.6)', async ({ page }) => {
      await setPlaceClosedByKey(belgranoId)
      await page.goto(placeUrl(belgranoSlug, '/conversations'))
      await expect(page.getByRole('heading', { name: /Está cerrado/ })).toBeVisible()
      // R.6.3 renombró el header a "Discusiones" (era "Conversaciones").
      // Cuando place cerrado, ningún header de zona renderiza.
      await expect(page.getByRole('heading', { name: /^Discusiones$/ })).toHaveCount(0)
      // R.2.6: el FAB no renderiza tampoco — (gated)/layout retorna
      // <PlaceClosedView> antes de mountar ZoneSwiper + ZoneFab.
      await expect(page.getByRole('button', { name: /Acciones/i })).toHaveCount(0)
    })

    test('place reabierto → vuelve a ver la lista de conversaciones + FAB visible', async ({
      page,
    }) => {
      await setPlaceAlwaysOpen(belgranoId)
      await page.goto(placeUrl(belgranoSlug, '/conversations'))
      await expect(page.getByRole('heading', { name: /^Discusiones$/ })).toBeVisible()
      await expect(page.getByRole('heading', { name: /Está cerrado/ })).toHaveCount(0)
      // R.2.6: place abierto → FAB cross-zona visible.
      await expect(page.getByRole('button', { name: /Acciones/i })).toBeVisible()
    })
  })

  test.describe('como owner (admin del place)', () => {
    test.use({ storageState: storageStateFor('owner') })

    test('place cerrado → admin mantiene acceso a /settings/hours', async ({ page }) => {
      await setPlaceClosedByKey(belgranoId)
      const res = await page.goto(placeUrl(belgranoSlug, '/settings/hours'))
      expect(res?.status()).toBeLessThan(400)
      // La pantalla de settings NO muestra el gate de "Está cerrado".
      await expect(page.getByRole('heading', { name: /Está cerrado/ })).toHaveCount(0)
    })
  })
})

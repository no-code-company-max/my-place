import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { placeUrl } from '../../helpers/subdomain'
import { E2E_PLACES, E2E_TIERS } from '../../fixtures/e2e-data'

/**
 * Flow T.x — Tiers feature (definición + CRUD owner-only).
 *
 * Cubre los escenarios definidos en `docs/features/tiers/spec.md` § 14:
 *  1. Owner CRUD happy path (free + paid).
 *  2. N tiers con mismo name HIDDEN coexisten (decisión #11 ADR
 *     actualizada 2026-05-02).
 *  3. Publicar segundo tier con mismo name → bloqueado (invariante
 *     "máx 1 PUBLISHED por (placeId, name) lower-case").
 *  4. Admin gateado en page (`/settings/tiers` → 404).
 *  5. Admin no ve item en FAB (`<SettingsNavFab>`).
 *  6. Member común gateado (página y FAB ocultos).
 *
 * **Aislamiento entre workers**: chromium + mobile-safari corren en paralelo
 * contra el mismo cloud DB. Los tests usan nombres únicos derivados de
 * `testInfo.workerIndex + Date.now()` para garantizar no-colisión entre
 * runs paralelos.
 *
 * **Empty state copy**: la `not-found.tsx` global de Next dice "No existe."
 * (no "404"), por eso el regex de gate matchea esa frase específica.
 *
 * Storage states usados:
 *  - `owner` → OWNER del place palermo (vía PlaceOwnership).
 *  - `admin` → ADMIN del place palermo (sin PlaceOwnership).
 *  - `memberA` → MEMBER del place palermo.
 */

const palermoSlug = E2E_PLACES.palermo.slug

const NOT_FOUND_REGEX = /No existe|Lo que buscabas/i

function uniqueTierName(testInfo: { workerIndex: number }): string {
  return `Test Tier w${testInfo.workerIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

test.describe('Tiers — owner read-only happy path (T.4)', () => {
  test.use({ storageState: storageStateFor('owner') })

  test('owner ve la page con tiers baseline (free PUBLISHED + paid HIDDEN)', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, '/settings/tiers'))
    await expect(page.getByRole('heading', { name: 'Tiers', exact: true })).toBeVisible()
    // Los 2 tiers baseline están visibles. Usamos heading-role para evitar
    // colisiones con otros tests que crean tiers con nombres similares (la
    // page acumula data entre tests dentro del mismo describe).
    await expect(
      page.getByRole('heading', { name: E2E_TIERS.colaboradores.name, exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: E2E_TIERS.premium.name, exact: true }),
    ).toBeVisible()
    // El tier free muestra "Gratis" como copy del precio.
    await expect(page.getByText(/Gratis/i).first()).toBeVisible()
    // El tier paid muestra el precio formateado (seed: 999 cents → 9,99).
    await expect(page.getByText(/9,99/).first()).toBeVisible()
  })

  test('FAB de settings muestra item "Tiers" para owner', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, '/settings'))
    await page.getByRole('button', { name: 'Navegación de settings' }).click()
    await expect(page.getByRole('menuitem', { name: /Tiers/i })).toBeVisible()
  })
})

test.describe('Tiers — owner CRUD (T.4)', () => {
  test.use({ storageState: storageStateFor('owner') })

  test('crear → publicar → ocultar un tier propio (CRUD atómico end-to-end)', async ({
    page,
  }, testInfo) => {
    // Test atómico: crea un tier propio con nombre único + ejecuta todo el
    // ciclo visibility en una sola navegación, sin compartir estado con
    // otros tests. Evita race entre workers paralelos que mutan el mismo DB.
    const uniqueName = uniqueTierName(testInfo)
    await page.goto(placeUrl(palermoSlug, '/settings/tiers'))

    // CREATE — arranca HIDDEN (default).
    await page.getByRole('button', { name: 'Nuevo tier' }).first().click()
    await page.getByLabel('Nombre').fill(uniqueName)
    await page.getByLabel(/Precio/).fill('1.99')
    await page.getByRole('button', { name: 'Crear tier' }).click()
    await expect(page.getByText(/Tier creado/i).first()).toBeVisible({ timeout: 10_000 })

    const row = page.locator('li', { hasText: uniqueName }).first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row.getByText('Oculto')).toBeVisible()

    // PUBLISH — dropdown 3-dot por row → menuitem "Publicar tier".
    // El dropdown se portalea al <body>, por eso los menuitems se buscan
    // a nivel `page` (no scoped al `row`).
    await row.getByRole('button', { name: `Opciones para ${uniqueName}` }).click()
    await page.getByRole('menuitem', { name: 'Publicar tier' }).click()
    await expect(page.getByText(/Tier publicado/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(row.getByText('Publicado')).toBeVisible({ timeout: 10_000 })

    // HIDE de vuelta — mismo patrón.
    await row.getByRole('button', { name: `Opciones para ${uniqueName}` }).click()
    await page.getByRole('menuitem', { name: 'Ocultar tier' }).click()
    await expect(page.getByText(/Tier oculto/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(row.getByText('Oculto')).toBeVisible({ timeout: 10_000 })
  })

  test('crear N tiers con mismo nombre HIDDEN coexisten — sin error', async ({
    page,
  }, testInfo) => {
    // Decisión #11 ADR (actualizada 2026-05-02): N tiers con mismo nombre
    // pueden coexistir mientras no haya MÁS DE UNO publicado.
    // Acá creamos 2 tiers con el mismo name lower-case, ambos HIDDEN.
    // Ambos creates deben pasar.
    const sharedName = `Basic-${testInfo.workerIndex}-${Date.now()}`
    await page.goto(placeUrl(palermoSlug, '/settings/tiers'))

    // Primer create OK.
    await page.getByRole('button', { name: 'Nuevo tier' }).first().click()
    await page.getByLabel('Nombre').fill(sharedName)
    await page.getByLabel(/Precio/).fill('1.00')
    await page.getByRole('button', { name: 'Crear tier' }).click()
    await expect(page.getByText(/Tier creado/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })

    // Segundo create con MISMO name pero CASE-INSENSITIVE distinto — también OK.
    await page.getByRole('button', { name: 'Nuevo tier' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
    await page.getByLabel('Nombre').fill(sharedName.toUpperCase())
    await page.getByLabel(/Precio/).fill('2.00')
    await page.getByRole('button', { name: 'Crear tier' }).click()
    await expect(page.getByText(/Tier creado/i).first()).toBeVisible({ timeout: 10_000 })

    // Ambos tiers visibles en la lista.
    await expect(page.locator('li', { hasText: sharedName }).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test('publicar segundo tier con mismo nombre case-insensitive → toast friendly', async ({
    page,
  }, testInfo) => {
    // Caso de uso real (decisión #11 ADR actualizada): owner crea 2 tiers
    // "Basic" (uno con precio viejo, otro con precio nuevo). Publica el
    // primero. Cuando intenta publicar el segundo → error: "ya hay otro
    // PUBLISHED con ese nombre, ocultalo primero". Garantizado por el
    // partial unique `Tier_placeId_lowerName_published_unique`.
    const sharedName = `Premium-${testInfo.workerIndex}-${Date.now()}`
    await page.goto(placeUrl(palermoSlug, '/settings/tiers'))

    // Crear tier #1.
    await page.getByRole('button', { name: 'Nuevo tier' }).first().click()
    await page.getByLabel('Nombre').fill(sharedName)
    await page.getByLabel(/Precio/).fill('1.99')
    await page.getByRole('button', { name: 'Crear tier' }).click()
    await expect(page.getByText(/Tier creado/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })

    // Crear tier #2 (mismo name, distinto precio).
    await page.getByRole('button', { name: 'Nuevo tier' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
    await page.getByLabel('Nombre').fill(sharedName)
    await page.getByLabel(/Precio/).fill('2.99')
    await page.getByRole('button', { name: 'Crear tier' }).click()
    await expect(page.getByText(/Tier creado/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })

    // Publicar tier #1 — primero de su nombre, no debería colisionar.
    // El dropdown 3-dot abre el menuitem "Publicar tier"; el contenido se
    // portalea al <body>, por eso `page.getByRole('menuitem', ...)`.
    const rows = page.locator('li', { hasText: sharedName })
    await expect(rows).toHaveCount(2, { timeout: 10_000 })
    await rows
      .first()
      .getByRole('button', { name: `Opciones para ${sharedName}` })
      .click()
    await page.getByRole('menuitem', { name: 'Publicar tier' }).click()
    await expect(page.getByText(/Tier publicado/i).first()).toBeVisible({ timeout: 10_000 })

    // Intentar publicar tier #2 — debería fallar (otro PUBLISHED con mismo name).
    await rows
      .nth(1)
      .getByRole('button', { name: `Opciones para ${sharedName}` })
      .click()
    await page.getByRole('menuitem', { name: 'Publicar tier' }).click()
    await expect(page.getByText(/Ya hay otro tier publicado con ese nombre/i).first()).toBeVisible({
      timeout: 10_000,
    })
  })
})

test.describe('Tiers — admin gateado (T.4)', () => {
  test.use({ storageState: storageStateFor('admin') })

  test('admin entra a /settings/tiers → custom 404 ("No existe.")', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, '/settings/tiers'))
    await expect(page.getByText(NOT_FOUND_REGEX).first()).toBeVisible({ timeout: 10_000 })
  })

  test('admin no ve item "Tiers" en el FAB de settings', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, '/settings'))
    await page.getByRole('button', { name: 'Navegación de settings' }).click()
    await expect(page.getByRole('menuitem', { name: /Tiers/i })).toHaveCount(0)
  })
})

test.describe('Tiers — member común gateado (T.4)', () => {
  test.use({ storageState: storageStateFor('memberA') })

  test('memberA navega a /settings/tiers → custom 404 (gate del layout settings)', async ({
    page,
  }) => {
    await page.goto(placeUrl(palermoSlug, '/settings/tiers'))
    await expect(page.getByText(NOT_FOUND_REGEX).first()).toBeVisible({ timeout: 10_000 })
  })
})

import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { appSubdomainUrl, placeUrl } from '../../helpers/subdomain'
import { E2E_PLACES } from '../../fixtures/e2e-data'

/**
 * Flow R.S — Acceso a Settings del place.
 *
 * Cubre los 3 affordances de settings introducidos en `docs/features/shell/spec.md` § 18:
 *  1. `<SettingsTrigger>` en TopBar (zonas root del place, solo admin).
 *  2. `<SettingsNavFab>` en `/settings/*` (FAB burger con menú de sub-pages).
 *  3. Icono engranaje en row del inbox (`<PlacesList>`, solo admin/owner per-row).
 *
 * Negative cases: member común NO ve los affordances; member que conoce la
 * URL `/settings` recibe 404 (gate del layout).
 *
 * Storage states usados:
 *  - `admin` → ADMIN del place palermo.
 *  - `memberA` → MEMBER del place palermo.
 *  - `owner` → OWNER del place palermo (vía PlaceOwnership).
 *
 * Ver `docs/features/shell/spec.md` § 18 (Settings affordances).
 */

const palermoSlug = E2E_PLACES.palermo.slug

test.describe('Settings access — TopBar trigger (R.S)', () => {
  test.describe('como admin del place', () => {
    test.use({ storageState: storageStateFor('admin') })

    test('engranaje TopBar visible en zona root y navega a /settings', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/'))
      const trigger = page.getByRole('link', { name: 'Configuración del place' })
      await expect(trigger).toBeVisible()
      await trigger.click()
      await page.waitForURL(/\/settings$/)
      expect(new URL(page.url()).pathname).toBe('/settings')
    })

    test('engranaje TopBar también visible en /conversations (otra zona root)', async ({
      page,
    }) => {
      await page.goto(placeUrl(palermoSlug, '/conversations'))
      await expect(page.getByRole('link', { name: 'Configuración del place' })).toBeVisible()
    })

    test('engranaje TopBar también visible dentro de /settings (consistencia)', async ({
      page,
    }) => {
      await page.goto(placeUrl(palermoSlug, '/settings'))
      await expect(page.getByRole('link', { name: 'Configuración del place' })).toBeVisible()
    })
  })

  test.describe('como owner del place', () => {
    test.use({ storageState: storageStateFor('owner') })

    test('owner sin rol ADMIN explícito también ve el engranaje', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/'))
      await expect(page.getByRole('link', { name: 'Configuración del place' })).toBeVisible()
    })
  })

  test.describe('como member común', () => {
    test.use({ storageState: storageStateFor('memberA') })

    test('memberA NO ve el engranaje en TopBar', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/'))
      await expect(page.getByRole('link', { name: 'Configuración del place' })).toHaveCount(0)
    })

    test('memberA navega manual a /settings y recibe 404 (gate del layout)', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/settings'))
      // El layout retorna notFound() — Next renderiza la 404 page.
      await expect(page.getByText(/404|no encontrad/i).first()).toBeVisible()
    })
  })
})

test.describe('Settings access — SettingsNavFab (R.S)', () => {
  test.use({ storageState: storageStateFor('admin') })

  test('admin en /settings ve el FAB burger con los 5 items default (sin owner-only)', async ({
    page,
  }) => {
    // Post-G.5/G.6: admin (no-owner) ve 5 items: General, Horarios, Biblioteca,
    // Acceso, Reportes. NO ve "Miembros" (directorio owner-only) ni "Grupos" ni
    // "Tiers" (owner-only).
    await page.goto(placeUrl(palermoSlug, '/settings'))
    const fab = page.getByRole('button', { name: 'Navegación de settings' })
    await expect(fab).toBeVisible()
    await fab.click()
    await expect(page.getByRole('menuitem', { name: /General/i })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /Horarios/i })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /Biblioteca/i })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /Acceso/i })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /Reportes/i })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /Miembros/i })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: /Grupos/i })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: /Tiers/i })).toHaveCount(0)
  })

  test('click en "Horarios" navega a /settings/hours', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, '/settings'))
    await page.getByRole('button', { name: 'Navegación de settings' }).click()
    await page.getByRole('menuitem', { name: /Horarios/i }).click()
    await page.waitForURL(/\/settings\/hours$/)
    expect(new URL(page.url()).pathname).toBe('/settings/hours')
  })

  test('FAB burger NO se monta en zonas root (solo settings)', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, '/'))
    await expect(page.getByRole('button', { name: 'Navegación de settings' })).toHaveCount(0)
  })
})

test.describe('Settings access — Inbox row engranaje (R.S)', () => {
  test.describe('como admin', () => {
    test.use({ storageState: storageStateFor('admin') })

    test('inbox row admin tiene icono engranaje secundario', async ({ page }) => {
      await page.goto(appSubdomainUrl('/'))
      // El nombre del place es "Palermo E2E" en el seed (E2E_PLACES.palermo.name).
      const settingsLink = page.getByRole('link', { name: /Configuración de Palermo E2E/i })
      await expect(settingsLink).toBeVisible()
    })

    test('click en engranaje del inbox navega a settings del place', async ({ page }) => {
      await page.goto(appSubdomainUrl('/'))
      const settingsLink = page.getByRole('link', {
        name: /Configuración de Palermo E2E/i,
      })
      const href = await settingsLink.getAttribute('href')
      expect(href).toMatch(/\/\/e2e-palermo\..+\/settings$/)
    })
  })

  test.describe('como member común', () => {
    test.use({ storageState: storageStateFor('memberA') })

    test('memberA en inbox NO ve engranaje en row donde es solo MEMBER', async ({ page }) => {
      await page.goto(appSubdomainUrl('/'))
      // memberA es MEMBER de palermo (no admin/owner).
      await expect(page.getByRole('link', { name: /Configuración de Palermo E2E/i })).toHaveCount(0)
    })
  })
})

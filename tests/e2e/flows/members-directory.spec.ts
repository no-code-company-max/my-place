import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { placeUrl } from '../../helpers/subdomain'
import { E2E_DISPLAY_NAMES, E2E_PLACES, E2E_TIERS } from '../../fixtures/e2e-data'

/**
 * Flow M.x — Directorio de miembros + asignación de tier + grupos.
 *
 * Cubre los escenarios definidos en
 * `docs/features/tier-memberships/spec.md` y el plan
 * `docs/plans/2026-05-02-tier-memberships-and-directory.md` § Verificación.
 *
 * **Post-G.6**: la sección "Rol" (con `<RoleSelectorDialog>`) fue removida.
 * El rol MEMBER↔ADMIN ahora se gestiona desde la sección "Grupos asignados"
 * asignando/removiendo del grupo preset "Administradores". Los flows de
 * promote/demote vía dialog quedaron obsoletos. La cobertura E2E del flujo
 * de grupos vive en `permission-groups.spec.ts`.
 *
 * **Aislamiento entre workers**: chromium + mobile-safari corren contra
 * el mismo cloud DB en el mismo run (globalSetup re-seedea sólo al
 * arrancar, no entre projects). Por eso los tests que mutan estado son
 * **atómicos self-contained**: cada uno asume nada del baseline previo
 * y restaura el state que necesita antes de verificar.
 *
 * **Empty state copy**: 404 page custom dice "No existe.".
 *
 * Storage states:
 *  - `owner` → OWNER del place palermo.
 *  - `admin` → ADMIN del place palermo (sin PlaceOwnership).
 *  - `memberA` → MEMBER del place palermo. Tiene asignado el tier
 *    `colaboradores` (baseline del seed — pero los tests no asumen
 *    su presencia para evitar race entre browsers).
 */

const palermoSlug = E2E_PLACES.palermo.slug
const NOT_FOUND_REGEX = /No existe|Lo que buscabas/i

test.describe('Directorio — owner read-only', () => {
  test.use({ storageState: storageStateFor('owner') })

  test('owner ve el directorio con todos los miembros', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, '/settings/members'))
    await expect(page.getByRole('heading', { name: 'Miembros', exact: true })).toBeVisible()
    // Owner + admin + memberA + memberB están en palermo. memberB participa
    // del grupo `libraryMods` de palermo (además de su Membership en belgrano),
    // por lo que aparece en el directorio del place — ver `tests/fixtures/e2e-seed.ts`.
    await expect(page.getByText(E2E_DISPLAY_NAMES.owner)).toBeVisible()
    await expect(page.getByText(E2E_DISPLAY_NAMES.admin)).toBeVisible()
    await expect(page.getByText(E2E_DISPLAY_NAMES.memberA)).toBeVisible()
    await expect(page.getByText(E2E_DISPLAY_NAMES.memberB)).toBeVisible()
  })

  test('search por nombre filtra la lista', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, '/settings/members'))
    const search = page.getByRole('searchbox', { name: /Buscar/i })
    await search.fill('Admin')
    // El componente usa `router.replace` (no `push`) para no pollutar history,
    // así que `waitForURL` no captura cleanly el cambio. Esperamos a la
    // re-render del Server Component vía visibility de la lista filtrada.
    // Owner ("Owner E2E") NO matchea "Admin" — desaparece tras el filter.
    await expect(page.getByText(E2E_DISPLAY_NAMES.owner, { exact: true })).toHaveCount(0, {
      timeout: 15_000,
    })
    // Admin E2E sí matchea.
    await expect(page.getByText(E2E_DISPLAY_NAMES.admin)).toBeVisible()
  })

  test('FAB muestra item "Miembros" para owner', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, '/settings'))
    await page.getByRole('button', { name: 'Navegación de settings' }).click()
    await expect(page.getByRole('menuitem', { name: /Miembros/i })).toBeVisible()
  })

  test('click en miembro navega al detalle (info básica visible, sin email)', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, '/settings/members'))
    await page.getByRole('link', { name: new RegExp(E2E_DISPLAY_NAMES.memberA, 'i') }).click()
    await page.waitForURL(/\/settings\/members\/[a-zA-Z0-9-]+$/)
    // Header con nombre del miembro.
    await expect(page.getByRole('heading', { name: E2E_DISPLAY_NAMES.memberA })).toBeVisible()
    // Email NO visible (privacidad — decisión #6 ADR).
    await expect(page.getByText(/e2e-member-a@e2e\.place\.local/i)).toHaveCount(0)
    // Section "Tiers asignados" presente.
    await expect(page.getByRole('heading', { name: 'Tiers asignados' })).toBeVisible()
    // Section "Grupos asignados" presente (G.6 reemplaza "Rol").
    await expect(page.getByRole('heading', { name: 'Grupos asignados' })).toBeVisible()
  })
})

test.describe('Directorio — owner CRUD de tier (atómico, serial)', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: storageStateFor('owner') })

  test('CRUD completo de tier sobre memberA (idempotente al state)', async ({ page }) => {
    // Test atómico self-contained: NO asume si el baseline TierMembership
    // del seed sigue presente (puede haber sido removido por otro browser
    // del mismo run). Flow:
    //   1. Navegar al detalle.
    //   2. Si "Colaboradores" está asignado → quitar.
    //   3. Asignar "Colaboradores" → toast OK + heading visible.
    //   4. Intentar asignar de nuevo → toast "ya tiene este tier".
    //   5. Quitar → toast OK + heading desaparece.
    await page.goto(placeUrl(palermoSlug, '/settings/members'))
    await page.getByRole('link', { name: new RegExp(E2E_DISPLAY_NAMES.memberA, 'i') }).click()
    await page.waitForURL(/\/settings\/members\/[a-zA-Z0-9-]+$/)

    // (1) Si el tier ya está asignado, removerlo primero.
    const tierHeading = page.getByRole('heading', { name: E2E_TIERS.colaboradores.name })
    if (await tierHeading.isVisible().catch(() => false)) {
      const removeBtn = page.getByRole('button', {
        name: new RegExp(`Quitar tier ${E2E_TIERS.colaboradores.name}`, 'i'),
      })
      await removeBtn.click()
      await page.getByRole('button', { name: /Sí, quitar/i }).click()
      await expect(page.getByText(/Asignación removida/i).first()).toBeVisible({
        timeout: 10_000,
      })
      await expect(tierHeading).toHaveCount(0, { timeout: 10_000 })
    }

    // (2) Asignar "Colaboradores". El select Match by value (id estable).
    await page.getByRole('combobox', { name: 'Tier' }).selectOption(E2E_TIERS.colaboradores.id)
    await page.getByRole('button', { name: 'Asignar tier' }).click()
    await expect(page.getByText('Tier asignado.').first()).toBeVisible({ timeout: 10_000 })
    await expect(tierHeading).toBeVisible({ timeout: 10_000 })

    // (3) Asignar de nuevo → conflict 'tier_already_assigned'. Re-buscar
    // el select porque el page revalidó tras el primer assign.
    await page.getByRole('combobox', { name: 'Tier' }).selectOption(E2E_TIERS.colaboradores.id)
    await page.getByRole('button', { name: 'Asignar tier' }).click()
    await expect(page.getByText(/ya tiene este tier/i).first()).toBeVisible({ timeout: 10_000 })

    // (4) Cleanup: quitar.
    const removeBtn2 = page.getByRole('button', {
      name: new RegExp(`Quitar tier ${E2E_TIERS.colaboradores.name}`, 'i'),
    })
    await removeBtn2.click()
    await page.getByRole('button', { name: /Sí, quitar/i }).click()
    await expect(page.getByText(/Asignación removida/i).first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Directorio — admin gateado', () => {
  test.use({ storageState: storageStateFor('admin') })

  test('admin entra a /settings/members → 404 custom (gate del page)', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, '/settings/members'))
    await expect(page.getByText(NOT_FOUND_REGEX).first()).toBeVisible({ timeout: 10_000 })
  })

  test('admin no ve item "Miembros" en el FAB (sí ve "Acceso")', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, '/settings/access'))
    await page.getByRole('button', { name: 'Navegación de settings' }).click()
    await expect(page.getByRole('menuitem', { name: /Miembros/i })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: /Acceso/i })).toBeVisible()
  })

  test('admin entra a /settings/access OK (lista mini visible)', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, '/settings/access'))
    await expect(page.getByRole('heading', { name: 'Acceso', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Miembros activos/i })).toBeVisible()
  })
})

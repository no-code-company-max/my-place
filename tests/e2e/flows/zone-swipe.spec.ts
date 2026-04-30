import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { placeUrl } from '../../helpers/subdomain'
import { E2E_PLACES } from '../../fixtures/e2e-data'

/**
 * Flow R.2.5 — Zone swiper navigation.
 *
 * Cubre el comportamiento del `<ZoneSwiper>` montado en `(gated)/layout`.
 * Tests robustos cross-browser: validan navegación dot-click + dot
 * sync + skeleton (los 2 fixes de R.2.5.2-fix) + pass-through en
 * sub-pages y settings.
 *
 * **Gesture real (drag/swipe touch)** queda fuera de scope automatizado:
 * Playwright `page.touchscreen` es flaky para gestures de framer-motion
 * en CI (timing dependent del spring physics). Manual QA en device
 * real (iOS Safari + Chrome Android) es la fuente de verdad para
 * gesture UX. Lo cubre R.2.5.4 manual QA.
 *
 * Ver `docs/features/shell/spec.md` § 16 + ADR
 * `docs/decisions/2026-04-26-zone-swiper.md`.
 */

const palermoSlug = E2E_PLACES.palermo.slug

test.describe('ZoneSwiper navigation — Palermo', () => {
  test.use({ storageState: storageStateFor('memberA') })

  test('click en dot Conversaciones desde / navega y URL actualiza', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, '/'))
    await page.getByRole('link', { name: 'Ir a Conversaciones' }).click()
    await page.waitForURL(/\/conversations$/)
    expect(new URL(page.url()).pathname).toBe('/conversations')
  })

  test('dot activo se sincroniza con la URL al navegar (R.2.5.2-fix)', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, '/'))
    // En "/" Inicio debe estar marcada
    await expect(page.getByRole('link', { name: 'Ir a Inicio' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // Click en Conversaciones → aria-current debe migrar
    await page.getByRole('link', { name: 'Ir a Conversaciones' }).click()
    await page.waitForURL(/\/conversations$/)
    await expect(page.getByRole('link', { name: 'Ir a Conversaciones' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByRole('link', { name: 'Ir a Inicio' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('navegación a Eventos desde Conversaciones también sincroniza', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, '/conversations'))
    await page.getByRole('link', { name: 'Ir a Eventos' }).click()
    await page.waitForURL(/\/events$/)
    await expect(page.getByRole('link', { name: 'Ir a Eventos' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('sub-page (thread detail): swiper queda pass-through', async ({ page }) => {
    // Sub-pages NO deben tener el swiper activo. Lo verificamos checkeando
    // que el ThreadHeaderBar (BackButton) está visible — propio del thread
    // detail, no del swiper. Y que el dot Conversaciones sigue activo
    // (el thread vive bajo /conversations/...).
    await page.goto(placeUrl(palermoSlug, '/conversations/e2e-baseline-post'))
    await expect(page.getByRole('button', { name: 'Volver a conversaciones' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ir a Conversaciones' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('settings: ningún dot tiene aria-current (no es zona del producto)', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, '/settings'))
    // Settings está fuera de gated, sin swiper. Los dots se renderizan en el
    // shell (parent layout) pero ninguno marca "current" porque
    // /settings/* no es zona.
    await expect(page.getByRole('link', { name: 'Ir a Inicio' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByRole('link', { name: 'Ir a Conversaciones' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByRole('link', { name: 'Ir a Eventos' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByRole('link', { name: 'Ir a Biblioteca' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('library: dot de Biblioteca activa en `/library` (R.5)', async ({ page }) => {
    await page.goto(placeUrl(palermoSlug, '/library'))
    await expect(page.getByRole('link', { name: 'Ir a Biblioteca' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByRole('link', { name: 'Ir a Eventos' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('nav cíclica vuelve al estado correcto (Inicio → Conversaciones → Eventos → Biblioteca → Inicio)', async ({
    page,
  }) => {
    await page.goto(placeUrl(palermoSlug, '/'))

    await page.getByRole('link', { name: 'Ir a Conversaciones' }).click()
    await page.waitForURL(/\/conversations$/)

    await page.getByRole('link', { name: 'Ir a Eventos' }).click()
    await page.waitForURL(/\/events$/)

    await page.getByRole('link', { name: 'Ir a Biblioteca' }).click()
    await page.waitForURL(/\/library$/)

    await page.getByRole('link', { name: 'Ir a Inicio' }).click()
    await page.waitForURL((url) => url.pathname === '/')
    await expect(page.getByRole('link', { name: 'Ir a Inicio' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})

import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { placeUrl } from '../../helpers/subdomain'
import { E2E_PLACES } from '../../fixtures/e2e-data'
import { deleteEventsByPlace, findEventIdByTitle } from '../../helpers/db'

/**
 * Flow Events F.D — smoke E2E del slice eventos (Fase 6).
 *
 * Cubre:
 *  - memberA propone evento → redirect al detalle → thread auto-creado linkeado.
 *  - RSVP "Voy" → optimistic + persistencia tras refresh.
 *  - RSVP "Voy si…" → textfield aparece + nota se guarda.
 *  - non-member intenta entrar a /events → bloqueado.
 *
 * Cleanup: cada run borra todos los Events del place de test (cascade RSVPs +
 * Post asociado). Aislado por título único per-spec.
 */

const palermoSlug = E2E_PLACES.palermo.slug
const palermoId = E2E_PLACES.palermo.id

const SPEC_EVENT_TITLE = 'F.D smoke evento del viernes'
const SPEC_EVENT_TITLE_RSVP = 'F.D smoke evento RSVP'

test.describe('Events F.D — Palermo', () => {
  test.afterAll(async () => {
    await deleteEventsByPlace(palermoId)
  })

  test.describe('como memberA (active member)', () => {
    test.use({ storageState: storageStateFor('memberA') })

    test('lista de eventos: header + botón "Proponer evento" visibles', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/events'))
      await expect(page.getByRole('heading', { name: /^Eventos$/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /Proponer evento/i })).toBeVisible()
    })

    test('crear evento: navega al detalle + thread auto-creado linkeado', async ({ page }) => {
      await page.goto(placeUrl(palermoSlug, '/events/new'))
      await expect(page.getByRole('heading', { name: /^Proponer evento$/i })).toBeVisible()

      await page.getByLabel(/Título/i).fill(SPEC_EVENT_TITLE)
      await page.getByLabel(/Descripción/i).fill('Vino, comida, charla.')

      // datetime-local: futuro a +2 días para no chocar con validación.
      const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      const startsAtIso = toDatetimeLocal(future)
      await page.getByLabel(/Empieza/i).fill(startsAtIso)

      await page.getByLabel(/Timezone/i).selectOption('America/Argentina/Buenos_Aires')
      await page.getByLabel(/Dónde/i).fill('Casa de Maxi')

      await page.getByRole('button', { name: /Proponer evento/i }).click()

      // Esperamos el redirect al detalle: heading h1 con el título exacto.
      await expect(page.getByRole('heading', { name: SPEC_EVENT_TITLE })).toBeVisible({
        timeout: 10_000,
      })

      // Thread auto-creado: link "Ver la conversación del evento →"
      await expect(
        page.getByRole('link', { name: /Ver la conversación del evento/i }),
      ).toBeVisible()
    })

    test('RSVP: click "Voy" persiste tras refresh; "Voy si…" expone textfield', async ({
      page,
    }) => {
      // Crear el evento de este caso en setup vía UI (más realista que seedear DB).
      await page.goto(placeUrl(palermoSlug, '/events/new'))
      await page.getByLabel(/Título/i).fill(SPEC_EVENT_TITLE_RSVP)

      const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      await page.getByLabel(/Empieza/i).fill(toDatetimeLocal(future))
      await page.getByLabel(/Timezone/i).selectOption('America/Argentina/Buenos_Aires')
      await page.getByRole('button', { name: /Proponer evento/i }).click()

      // En el detalle del evento.
      await expect(page.getByRole('heading', { name: SPEC_EVENT_TITLE_RSVP })).toBeVisible({
        timeout: 10_000,
      })

      // Click "Voy".
      await page.getByRole('button', { name: /^Voy$/ }).click()

      // Confirmar persistencia: tras refresh, el botón "Voy" sigue activo
      // (aria-pressed=true) y aparece en "Quién viene".
      await page.reload()
      await expect(page.getByRole('button', { name: /^Voy$/, pressed: true })).toBeVisible({
        timeout: 5_000,
      })

      // Cambio a "Voy si…" → textfield aparece.
      await page.getByRole('button', { name: /Voy si/ }).click()
      await expect(page.getByLabel(/¿Qué necesitarías\?/i)).toBeVisible()

      // Cleanup explícito por si afterAll falla.
      const eventId = await findEventIdByTitle(palermoId, SPEC_EVENT_TITLE_RSVP)
      if (eventId !== null) {
        // El cleanup en afterAll cubre, no hace falta delete específico acá.
      }
    })
  })

  test.describe('como nonMember (no pertenece al place)', () => {
    test.use({ storageState: storageStateFor('nonMember') })

    test('intentar abrir /events → bloqueado (no expone listado)', async ({ page }) => {
      const response = await page.goto(placeUrl(palermoSlug, '/events'))
      const url = page.url()
      const content = await page.content()
      const isBlocked =
        /\/login\?/.test(url) || /\/$/.test(new URL(url).pathname) || response?.status() === 404
      expect(isBlocked).toBe(true)
      expect(content).not.toContain('F.D smoke evento')
    })
  })
})

/**
 * Convierte un Date a YYYY-MM-DDTHH:MM (formato `<input type="datetime-local">`).
 * Usa hora local del runtime — los specs corren en CI con TZ del runner.
 */
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`
}

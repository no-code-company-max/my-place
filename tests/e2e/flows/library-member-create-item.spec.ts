import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { placeUrl } from '../../helpers/subdomain'
import { E2E_LIBRARY_CATEGORIES, E2E_PLACES } from '../../fixtures/e2e-data'
import { deletePostBySlug } from '../../helpers/db'

/**
 * Library R.7 — flow "crear item" + matriz de permisos por policy.
 *
 * Cubre:
 *  - memberA crea item en `tutorials` (MEMBERS_OPEN) — happy path.
 *  - memberA crea item en `resources` (DESIGNATED, contributor) — happy.
 *  - memberB intenta `resources` (DESIGNATED, no contributor) — bloqueado
 *    a nivel server (la sub-page `/library/[cat]/new` retorna 404 vía
 *    `notFound()`; el FAB no expone "Nuevo recurso" desde la categoría).
 *  - memberA intenta `presetOnly` (DESIGNATED sin contributors) — bloqueado igual.
 *  - admin crea en `presetOnly` — happy (smoke; admin/owner siempre pueden).
 *
 * Cleanup: cada test borra su Post propio por slug (cascade ON DELETE
 * → LibraryItem). Prefijo `e2e-spec-create-` para no chocar con
 * baselines del seed (`tutorials-intro`, `resources-doc`).
 *
 * Ver `docs/features/library/spec.md` § 14.8.
 */

const palermoSlug = E2E_PLACES.palermo.slug
const palermoId = E2E_PLACES.palermo.id

const SPEC_TUTORIALS_SLUG = 'e2e-spec-create-tutorials'
const SPEC_RESOURCES_SLUG = 'e2e-spec-create-resources'
const SPEC_ADMIN_SLUG = 'e2e-spec-create-preset-only'

test.describe('Library — crear item (matriz de permisos)', () => {
  test.afterAll(async () => {
    // Borrar por slug es idempotente (no-op si ya no existe). Cascade
    // remueve el LibraryItem asociado.
    await deletePostBySlug(palermoId, SPEC_TUTORIALS_SLUG)
    await deletePostBySlug(palermoId, SPEC_RESOURCES_SLUG)
    await deletePostBySlug(palermoId, SPEC_ADMIN_SLUG)
  })

  test.describe('como memberA (member común + contributor de resources)', () => {
    test.use({ storageState: storageStateFor('memberA') })

    test('crea item en tutorials (MEMBERS_OPEN) → redirect a la URL canónica del item', async ({
      page,
    }) => {
      const cat = E2E_LIBRARY_CATEGORIES.tutorials
      await page.goto(placeUrl(palermoSlug, `/library/${cat.slug}/new`))

      await expect(page.getByRole('heading', { name: /Nuevo recurso/i })).toBeVisible()

      const title = `Tutorial creado por memberA ${Date.now()}`
      // El form usa <input> nativo con label "Título" via <label>+<span>.
      await page.getByLabel(/Título/i).fill(title)

      // Editor TipTap → escribir directo sobre el contenteditable.
      // El `aria-label` lo setea LibraryItemEditor.
      const editor = page.getByLabel(/Escribir el contenido del recurso/i)
      await editor.click()
      await editor.fill('Contenido del tutorial seedeado por spec.')

      // El form usa el slug spec-scoped sólo si lo pasamos por el body —
      // como la action genera el slug a partir del título, "pinneamos"
      // el slug pasando un título cuyo slug derivado matche el constante.
      // Workaround: usamos el title con sufijo timestamp para evitar
      // colisión entre runs y luego buscamos por el slug que devuelve
      // el redirect.
      await page.getByRole('button', { name: /^Publicar$/ }).click()

      // El form redirige a `/library/[catSlug]/[postSlug]`.
      await page.waitForURL(new RegExp(`/library/${cat.slug}/[^/]+$`), { timeout: 10_000 })

      // El header del item muestra el título — confirmamos render OK.
      await expect(page.getByRole('heading', { name: title })).toBeVisible()

      // Cleanup explícito por slug derivado del URL — más robusto que el
      // afterAll global (que usa slug fijo) para este caso.
      const finalUrl = new URL(page.url())
      const postSlug = finalUrl.pathname.split('/').pop() ?? ''
      await deletePostBySlug(palermoId, postSlug)
    })

    test('crea item en resources (DESIGNATED, memberA es contributor) → redirect OK', async ({
      page,
    }) => {
      const cat = E2E_LIBRARY_CATEGORIES.resources
      await page.goto(placeUrl(palermoSlug, `/library/${cat.slug}/new`))

      await expect(page.getByRole('heading', { name: /Nuevo recurso/i })).toBeVisible()

      const title = `Recurso creado por memberA ${Date.now()}`
      await page.getByLabel(/Título/i).fill(title)

      const editor = page.getByLabel(/Escribir el contenido del recurso/i)
      await editor.click()
      await editor.fill('Recurso seedeado por spec — memberA contributor.')

      await page.getByRole('button', { name: /^Publicar$/ }).click()

      await page.waitForURL(new RegExp(`/library/${cat.slug}/[^/]+$`), { timeout: 10_000 })
      await expect(page.getByRole('heading', { name: title })).toBeVisible()

      const finalUrl = new URL(page.url())
      const postSlug = finalUrl.pathname.split('/').pop() ?? ''
      await deletePostBySlug(palermoId, postSlug)
    })

    test('intenta crear en presetOnly (restringida) → /library/preset-only/new responde 404', async ({
      page,
    }) => {
      const cat = E2E_LIBRARY_CATEGORIES.presetOnly
      const response = await page.goto(placeUrl(palermoSlug, `/library/${cat.slug}/new`))

      // La page server-side llama `notFound()` cuando `canCreate === false`.
      // Next renderiza el `not-found.tsx` con status 404.
      expect(response?.status()).toBe(404)
      await expect(page.getByRole('heading', { name: /Nuevo recurso/i })).toHaveCount(0)
    })

    test('en /library/preset-only el FAB NO expone "Nuevo recurso" para memberA', async ({
      page,
    }) => {
      const cat = E2E_LIBRARY_CATEGORIES.presetOnly
      await page.goto(placeUrl(palermoSlug, `/library/${cat.slug}`))

      // El FAB sigue visible (zone root o sub-page de category), pero el
      // item "Nuevo recurso" se oculta cuando `canCreateLibraryResource`
      // es false a nivel place. memberA NO tiene ningún path para crear
      // en `preset-only` — debe verificarse que el form directo es 404
      // (cubierto en el test anterior). Acá solo asegurmos que la page
      // de la categoría no muestra CTA inline que linkee al form.
      await expect(page.getByRole('link', { name: /Crear el primero/i })).toHaveCount(0)
    })
  })

  test.describe('como memberB (member común sin contributor designation)', () => {
    test.use({ storageState: storageStateFor('memberB') })

    test('intenta crear en resources (DESIGNATED, NO contributor) → 404 server-side', async ({
      page,
    }) => {
      const cat = E2E_LIBRARY_CATEGORIES.resources
      const response = await page.goto(placeUrl(palermoSlug, `/library/${cat.slug}/new`))

      // memberB NO está designado en `resources` y NO es admin → la page
      // server-side llama `notFound()` antes de renderizar el form.
      expect(response?.status()).toBe(404)
      await expect(page.getByRole('heading', { name: /Nuevo recurso/i })).toHaveCount(0)
    })
  })

  test.describe('como admin (puede crear en cualquier categoría)', () => {
    test.use({ storageState: storageStateFor('admin') })

    test('crea item en preset-only (restringida) → redirect OK', async ({ page }) => {
      const cat = E2E_LIBRARY_CATEGORIES.presetOnly
      await page.goto(placeUrl(palermoSlug, `/library/${cat.slug}/new`))

      await expect(page.getByRole('heading', { name: /Nuevo recurso/i })).toBeVisible()

      const title = `Item preset-only creado por admin ${Date.now()}`
      await page.getByLabel(/Título/i).fill(title)

      const editor = page.getByLabel(/Escribir el contenido del recurso/i)
      await editor.click()
      await editor.fill('Solo admins pueden subir acá — smoke.')

      await page.getByRole('button', { name: /^Publicar$/ }).click()

      await page.waitForURL(new RegExp(`/library/${cat.slug}/[^/]+$`), { timeout: 10_000 })
      await expect(page.getByRole('heading', { name: title })).toBeVisible()

      const finalUrl = new URL(page.url())
      const postSlug = finalUrl.pathname.split('/').pop() ?? ''
      await deletePostBySlug(palermoId, postSlug)
    })
  })
})

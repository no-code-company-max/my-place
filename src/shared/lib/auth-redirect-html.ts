import { NextResponse } from 'next/server'

/**
 * Construye un `NextResponse` 200 OK con HTML + click button explícito en
 * lugar de un redirect HTTP (307/303).
 *
 * **Por qué:** browsers (especialmente Safari iOS con ITP) descartan
 * `Set-Cookie` headers en respuestas a redirects cuando consideran el flow
 * cross-site. Documentado en
 * https://github.com/vercel/next.js/discussions/48434 y
 * https://github.com/supabase/ssr/issues/36 — el síntoma típico es el primer
 * login deja solo `sb-*-auth-token-code-verifier` sin la `auth-token` real.
 *
 * **Workaround:** respuesta 200 OK con `Set-Cookie` (que el browser SÍ procesa)
 * + body HTML con anchor button. El user CLIQUEA el botón (first-party intent)
 * → request al target con cookies ya almacenadas. Sin auto-redirect: Safari
 * iOS ITP rechaza cookies si la navegación es automática post-Mail.app.
 *
 * **Trade-off UX:** un click extra para el user. Mitigado con copy claro
 * explicando por qué (email clients abren links automaticamente, queremos
 * confirmar que el user sí está acá). Ver `options.kind`.
 */

type HtmlRedirectKind = 'login' | 'invite'

export type HtmlRedirectOptions = {
  /**
   * Contexto del flow para adaptar el copy de la página intermedia:
   * - 'login' (default): user clickeó magic link de login.
   * - 'invite': user clickeó link de invitación a un place.
   */
  kind?: HtmlRedirectKind
  /**
   * Nombre del place al que el user fue invitado. Solo aplica con
   * `kind: 'invite'`. Se renderiza como "Aceptar invitación a {placeName}".
   * Si se omite, el botón dice "Aceptar invitación" genérico.
   */
  placeName?: string
}

export function htmlRedirect(target: URL, options: HtmlRedirectOptions = {}): NextResponse {
  const url = target.toString()
  const escapedHref = escapeHtmlAttr(url)
  const kind = options.kind ?? 'login'
  const placeName = options.placeName ? escapeHtmlText(options.placeName) : null

  const copy = buildCopy(kind, placeName)

  const html = renderHtml({ href: escapedHref, copy })

  return new NextResponse(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
      pragma: 'no-cache',
    },
  })
}

type Copy = {
  pageTitle: string
  heading: string
  body: string
  cta: string
}

function buildCopy(kind: HtmlRedirectKind, placeName: string | null): Copy {
  const sharedBody =
    'Antes de entrar te pedimos un click más — algunos clientes de email abren los links automáticamente y queremos asegurarnos que sos vos.'

  if (kind === 'invite') {
    return {
      pageTitle: 'Aceptar invitación · Place',
      heading: 'Estamos por sumarte',
      body: sharedBody,
      cta: placeName ? `Aceptar invitación a ${placeName} →` : 'Aceptar invitación →',
    }
  }

  return {
    pageTitle: 'Entrar a Place',
    heading: 'Bienvenido',
    body: sharedBody,
    cta: 'Entrar a Place →',
  }
}

function renderHtml({ href, copy }: { href: string; copy: Copy }): string {
  // Diseño chrome-neutral (sin colores del place: no los conocemos en este
  // punto del flow). Serif italic en heading consistente con `<InvitationProblem>`
  // y resto del producto. Mobile-first con padding generoso; el max-width
  // mantiene legibilidad en desktop. CSS embebido en `<style>` para no
  // depender de Tailwind ni asset pipeline (esta página vive en una respuesta
  // server-side dinámica, no en `/public/`).
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${copy.pageTitle}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        background: #fafafa;
        color: #171717;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        line-height: 1.55;
      }
      main {
        width: 100%;
        max-width: 28rem;
        text-align: center;
      }
      .brand {
        font-family: ui-serif, Georgia, "Times New Roman", serif;
        font-style: italic;
        font-size: 1rem;
        color: #737373;
        margin: 0 0 2rem;
        letter-spacing: 0.02em;
      }
      h1 {
        font-family: ui-serif, Georgia, "Times New Roman", serif;
        font-style: italic;
        font-weight: 400;
        font-size: 1.875rem;
        line-height: 1.2;
        color: #171717;
        margin: 0 0 1rem;
      }
      p.body {
        color: #525252;
        font-size: 0.9375rem;
        margin: 0 0 2rem;
      }
      a.btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 3rem;
        padding: 0 1.75rem;
        background: #171717;
        color: #fafafa;
        text-decoration: none;
        border-radius: 999px;
        font-size: 0.9375rem;
        font-weight: 500;
        transition: background-color 120ms;
      }
      a.btn:hover { background: #404040; }
      a.btn:active { background: #525252; }
      a.btn:focus-visible { outline: 2px solid #171717; outline-offset: 3px; }
      @media (min-width: 640px) {
        h1 { font-size: 2.25rem; }
        p.body { font-size: 1rem; }
      }
    </style>
  </head>
  <body>
    <main>
      <p class="brand">Place</p>
      <h1>${copy.heading}</h1>
      <p class="body">${copy.body}</p>
      <a class="btn" href="${href}">${copy.cta}</a>
    </main>
  </body>
</html>`
}

const HTML_ATTR_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ATTR_ESCAPES[c] ?? c)
}

/**
 * Escape para contenido textual en HTML (no atributos). El `&apos;` no es
 * estrictamente necesario fuera de attributes pero lo mantenemos por
 * uniformidad con `escapeHtmlAttr`.
 */
function escapeHtmlText(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ATTR_ESCAPES[c] ?? c)
}

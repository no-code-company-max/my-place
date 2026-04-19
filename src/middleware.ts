import { NextResponse, type NextRequest } from 'next/server'
import { resolveHost } from '@/shared/lib/host'

/**
 * Routing multi-tenant por subdomain. Ver `docs/multi-tenancy.md`.
 *
 * - `place.app`            → /(marketing)
 * - `app.place.app`        → /(app)/inbox
 * - `{slug}.place.app/*`   → /(app)/{slug}/*
 * - subdominios reservados → 404 (rewrite a /not-found)
 */
export function middleware(req: NextRequest) {
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN
  if (!appDomain) {
    // Fail fast si env no está configurado — no rutear ciegamente.
    return new NextResponse('NEXT_PUBLIC_APP_DOMAIN no configurado', { status: 500 })
  }

  const hostname = req.headers.get('host') ?? ''
  const resolution = resolveHost(hostname, appDomain)
  const url = req.nextUrl.clone()

  switch (resolution.kind) {
    case 'marketing': {
      // Next Router: el grupo (marketing) es transparent. Lo forzamos como ruta base.
      // Solo re-escribe si la URL apunta a un path que no es de marketing.
      if (!url.pathname.startsWith('/(marketing)')) {
        url.pathname = `/${url.pathname.replace(/^\/+/, '')}`.replace(/\/+$/, '') || '/'
      }
      return NextResponse.next()
    }
    case 'inbox': {
      const rest = url.pathname === '/' ? '' : url.pathname
      url.pathname = `/inbox${rest}`
      return NextResponse.rewrite(url)
    }
    case 'place': {
      const rest = url.pathname === '/' ? '' : url.pathname
      url.pathname = `/${resolution.slug}${rest}`
      return NextResponse.rewrite(url)
    }
    case 'reserved': {
      url.pathname = '/not-found'
      return NextResponse.rewrite(url)
    }
  }
}

export const config = {
  matcher: [
    // Excluye _next, archivos estáticos y rutas API (que manejan su propio host check si lo necesitan).
    '/((?!_next/|api/|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|woff2|ttf)$).*)',
  ],
}

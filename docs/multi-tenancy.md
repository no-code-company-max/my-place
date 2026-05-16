# Multi-tenancy: routing por subdomain

Cada place tiene su propia URL con subdomain. La estructura de URLs refuerza la ontología de "lugar" vs "app".

## Estructura de URLs

| URL                            | Qué es                                                                 |
| ------------------------------ | ---------------------------------------------------------------------- |
| `place.community`                    | Landing pública del producto                                           |
| `app.place.community`                | Inbox universal del usuario (DMs, lista de places a los que pertenece) |
| `{slug}.place.community`             | Portada del place con ese slug                                         |
| `{slug}.place.community/{zone}`      | Zona del place (conversations, events, etc)                            |
| `{slug}.place.community/thread/{id}` | Thread individual                                                      |
| `{slug}.place.community/settings`    | Configuración del place (solo admins)                                  |

## Implementación en Next.js

Middleware en `src/app/middleware.ts` inspecciona el hostname en cada request:

- Si el subdomain es `app` → rutea a `/(app)/inbox/...`
- Si el subdomain es cualquier otro → extrae el slug y reescribe la URL a `/(app)/[placeSlug]/...`
- Si es el dominio raíz → rutea a `/(marketing)/...`

Estructura de rutas:

```
src/app/
├── (marketing)/       Para place.community
│   └── page.tsx
├── (app)/             Para todo lo autenticado
│   ├── inbox/         En app.place.community
│   └── [placeSlug]/   En {slug}.place.community
│       ├── page.tsx
│       ├── [zone]/page.tsx
│       ├── thread/[id]/page.tsx
│       └── settings/page.tsx
├── api/              Route handlers (webhooks, cron, etc.) — a definir
└── middleware.ts
```

## DNS y Vercel

- Record wildcard: `*.place.community → CNAME → cname.vercel-dns.com`
- En Vercel: configurar wildcard domain en el proyecto
- SSL automático para todos los subdomains

## Dominios propios (custom domains)

Un place puede configurar su propio dominio en vez del subdomain asignado: en vez de `mio.place.community`, servirse en `community.empresa.com`. El subdomain `{slug}.place.community` sigue existiendo siempre como fallback canónico.

- **Routing:** el middleware resuelve el place por hostname. Si el host no es `*.place.community` ni el apex, se busca el place por su custom domain mapeado (tabla de dominios → `place_id`); si no matchea, 404.
- **DNS/SSL:** el dueño del place apunta su dominio a Vercel; el dominio se agrega vía la API de domains de Vercel (SSL automático). Flujo de verificación de propiedad: **TBD**.
- **Sesión:** un custom domain no comparte la cookie del apex, pero el miembro igual tiene SSO silencioso: cada custom domain es un Relying Party del IdP OIDC central de Place. Login único, sesión local aislada por dominio. Ver `docs/architecture.md` § "Sesión y SSO".

## Development local

Los browsers modernos resuelven `*.localhost` automáticamente. Usar:

- `thecompany.localhost:3000` para probar un place
- `app.localhost:3000` para el inbox
- `localhost:3000` para la landing

Alternativa: entradas en `/etc/hosts` si algún browser no resuelve wildcard localhost.

## Slug inmutable

El slug del place es inmutable una vez creado. Si un usuario necesita cambiar el slug de su place, es operación manual por soporte. Razón: los URLs compartidos, los invites enviados, y las referencias externas rompen si el slug cambia.

## Reservados

Subdomains que no pueden ser usados como slug de place:

- `app`, `www`, `api`, `admin`
- `staging`, `dev`, `test`
- Cualquier otro que el producto use para funcionalidad propia

Esta lista vive en código como constante en `shared/config/reserved-slugs.ts` y se valida en el flow de creación.

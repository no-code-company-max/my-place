import 'server-only'

/**
 * Superficie pública server-only del slice `hours`. Queries Prisma + helpers
 * que tocan I/O y nunca deben viajar al bundle cliente.
 *
 * Server Components, server actions y otros server modules (jobs) consumen
 * acá; Client Components consumen sólo `public.ts`. Ver
 * `docs/decisions/2026-04-21-flags-subslice-split.md` § "Boundary client vs
 * server".
 */

export { findPlaceHours, assertPlaceOpenOrThrow } from './server/queries'

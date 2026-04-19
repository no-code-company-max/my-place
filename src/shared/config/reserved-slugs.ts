/**
 * Subdomains que no pueden ser slugs de place.
 * Ver `docs/multi-tenancy.md` § "Reservados".
 *
 * Extender esta lista cada vez que el producto tome un subdomain nuevo.
 */
export const RESERVED_SLUGS = [
  'app',
  'www',
  'api',
  'admin',
  'staging',
  'dev',
  'test',
  'docs',
  'mail',
  'status',
  'blog',
  'help',
  'support',
  'assets',
  'static',
  'cdn',
] as const

export type ReservedSlug = (typeof RESERVED_SLUGS)[number]

export function isReservedSlug(candidate: string): candidate is ReservedSlug {
  return (RESERVED_SLUGS as readonly string[]).includes(candidate.toLowerCase())
}

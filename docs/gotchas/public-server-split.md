# Slice con queries `server-only` + componentes que viajan al bundle cliente requieren split `public.ts` + `public.server.ts`

Cuando un Server Component del slice (ej: `CommentItem`) se renderiza bajo un Client Component (ej: `LoadMoreComments`), Next traza todo el `public.ts` al bundle cliente; si `public.ts` re-exporta un módulo con `import 'server-only'`, el build falla con `"You're importing a component that needs 'server-only'"`.

**Fix:** dividir la superficie pública en dos archivos:

- `public.ts` — lo client-safe (tipos, Server Actions `'use server'`, componentes `'use client'`, schemas, mappers puros).
- `public.server.ts` — `import 'server-only'` + re-exports de queries Prisma.

Server Components/pages importan de ambos; Client Components sólo del primero.

`tests/boundaries.test.ts` acepta `public.server` como entry válido.

Caso real: `features/flags/` en C.G. Ver `docs/decisions/2026-04-21-flags-subslice-split.md` § "Boundary client vs server".

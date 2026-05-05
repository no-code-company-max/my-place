# Excepción de tamaño para `discussions/domain/types.ts`

**Fecha:** 2026-05-01
**Milestone:** Audit checklist post-R.7 (M1 — split de archivos > 300 LOC)
**Autor:** Max

## Contexto

`CLAUDE.md` y `docs/architecture.md` fijan **archivos ≤ 300 líneas** como cap inviolable salvo excepción documentada. El audit del 2026-05-01 listó `src/features/discussions/domain/types.ts` (316 LOC) entre los archivos a splitear.

El slice `discussions` ya tiene una excepción **a nivel slice-total** (1500 LOC, ver `docs/decisions/2026-04-20-discussions-size-exception.md`), pero **esa excepción no aplica al cap por archivo**. El audit es correcto en flaggearlo.

## Análisis

`domain/types.ts` contiene exclusivamente tipos puros — sin lógica, sin imports de Prisma client, sin React, sin Next:

| Bloque                             | Líneas aproximadas | Contenido                                                                   |
| ---------------------------------- | ------------------ | --------------------------------------------------------------------------- |
| Re-export de enums Prisma          | ~20                | `ContentTargetKind`, `ReactionEmoji`, `PlaceOpeningSource`                  |
| Rich Text AST (TipTap)             | ~100               | `RichTextDocument`, block nodes, inline nodes, marks                        |
| Snapshots                          | ~26                | `AuthorSnapshot`, `QuoteSnapshot`                                           |
| Post + relations                   | ~70                | `Post`, `PostState`, `PostListView`, `PostEventLink`, `PostLibraryItemLink` |
| Comment                            | ~24                | `Comment`, `QuoteSourceComment`                                             |
| PlaceOpening + PostRead + Reaction | ~46                | tipos restantes                                                             |

Total: ~316 LOC, todo `export type` o `export {}` re-exports.

## Decisión

**Se acepta la excepción** para `src/features/discussions/domain/types.ts`. No se splitea en sub-archivos.

## Razones

1. **Tipos puros, no lógica.** El cap de 300 LOC apunta a archivos auditables por humanos y agentes — el riesgo aumenta con la densidad de control flow, branches y side effects. Un archivo de 316 LOC de `export type` declarativos no degrada auditabilidad: cada tipo es independiente, leíble en aislamiento, sin estado que rastrear.

2. **Splitearlo sería burocrático sin ganar cohesión.** El plan de split natural (rich-text + snapshots + post + comment + reactions + place + index) genera **7 archivos** donde 6 son < 110 LOC y `index.ts` re-exporta todo para preservar la API consumida por todo el slice. Net: +6 archivos, +50 LOC de re-exports y headers, cero ganancia en legibilidad real (los tipos de Post son siempre relevantes junto a los de Comment cuando trabajás en discussions).

3. **Precedente en `events`.** `docs/decisions/2026-04-25-events-size-exception.md` § "Razones, punto 4" explícitamente justifica `domain/types.ts` del slice events con razonamiento idéntico: _"Mantener el contrato del dominio en un sólo archivo permite que `public.ts` re-exporte lineal sin múltiples imports."_ Aplicar el mismo criterio a `discussions/domain/types.ts` mantiene consistencia entre slices.

4. **Acceso constante en navegación.** Cuando trabajás en `discussions/`, los tipos cruzan dominios — un `Post` se mapea con `AuthorSnapshot`, contiene `RichTextDocument`, se vincula con `PostEventLink` o `PostLibraryItemLink`. Tener todos en un archivo es la postura correcta para refactor cross-tipo (renombrar campo, cambiar shape).

5. **Sin función > 60 LOC.** El cap de funciones NO se viola — no hay funciones, son sólo tipos.

## Cuándo revisar

Revisar esta excepción si:

- El archivo supera **400 LOC** (≥ +30% sobre el cap actual).
- Se introduce un sub-dominio nuevo (ej: hilos editoriales agendados, comentarios efímeros) que justifique extraer una sección a un archivo dedicado.
- El re-export desde `public.ts` se vuelve > 50 LOC (señal de que la superficie ya pide jerarquía).

## No aplica

Esta excepción **no** autoriza:

- Subir el cap general en CLAUDE.md ni architecture.md.
- Excepciones por archivo en otros slices sin registro propio.
- Mover lógica (mappers, queries, schemas) a este archivo — sigue siendo `domain/types.ts`, **tipos puros**.
- Crecer el archivo con tipos que pertenecen a otro slice.

## Referencias

- `CLAUDE.md` § Límites de tamaño
- `docs/architecture.md` § Límites de tamaño
- `docs/decisions/2026-04-20-discussions-size-exception.md` — excepción slice-level vigente.
- `docs/decisions/2026-04-25-events-size-exception.md` — precedente con razonamiento idéntico.
- `docs/plans/2026-05-01-audit-checklist.md` § M1

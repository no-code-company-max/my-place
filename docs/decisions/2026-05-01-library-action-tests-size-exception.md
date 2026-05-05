# Excepción de tamaño para 3 test files de actions de `library`

**Fecha:** 2026-05-01
**Milestone:** Audit checklist post-R.7 (M3 — tests unitarios para 9 actions de library)
**Autor:** Max

## Contexto

El cap del repo es **archivos ≤ 300 LOC**, sin carve-out por defecto para tests. El ADR de `events` (`2026-04-25-events-size-exception.md`) explícitamente NO autoriza tests > 300 LOC sin justificación; cualquier excepción requiere registro propio.

Durante M3 se crearon 9 test files para las server actions del slice `library`. **6 de los 9 quedaron bajo el cap**:

- `archive-category.test.ts` — 238 LOC (pilot)
- `archive-item.test.ts` — 250 LOC
- `invite-contributor.test.ts` — 297 LOC
- `remove-contributor.test.ts` — 196 LOC
- `reorder-categories.test.ts` — 293 LOC
- `update-category.test.ts` — 249 LOC

**3 archivos superaron el cap**:

| Archivo                   | LOC | +cap | Tests       | Mock surface (LOC aprox) |
| ------------------------- | --- | ---- | ----------- | ------------------------ |
| `create-category.test.ts` | 367 | +22% | 15          | ~110                     |
| `create-item.test.ts`     | 511 | +70% | 15 + 1 todo | ~150                     |
| `update-item.test.ts`     | 434 | +45% | 10 + 1 todo | ~140                     |

## Decisión

**Se acepta la excepción** para los 3 archivos. NO se splittean.

## Razones

1. **Mock surface no-negociable**. Cada test file de action tiene `~100-150 LOC de mock setup` que no se puede abstraer sin romper el patrón establecido del repo (`vi.mock` inline por archivo, helpers `mockActiveMember()` locales, scope vitest por archivo). Este setup es **coste fijo por archivo**, no por test.

2. **Splitear empeora la auditabilidad, no la mejora**. Si dividiéramos `create-item.test.ts` (511 LOC, 15 tests) en 3 archivos por concern (happy / validation / bugs), cada uno tendría:
   - ~150 LOC de mock setup (duplicado).
   - ~120 LOC de tests reales.
   - **Total combinado: ~810 LOC en 3 archivos** vs 511 LOC en uno cohesivo.
     El cap apunta a auditabilidad por humanos y agentes; un archivo de 511 LOC con 15 tests cohesivos es más auditable que 3 archivos con 90% setup duplicado.

3. **Precedente consistente con la postura del repo sobre densidad inherente**. ADRs previas (`discussions-size-exception.md`, `events-size-exception.md`, `discussions-types-size-exception.md`) aceptan que **archivos genuinamente densos por la naturaleza del dominio** justifican excepción. Las 3 actions cubiertas son las más complejas del slice:
   - `create-item`: multi-tabla (`prisma.$transaction` con Post + LibraryItem + verificación de policy contribution + helper externo `createPostFromSystemHelper`). Mock surface más ancha del slice.
   - `update-item`: multi-tabla (Post + LibraryItem) + permisos author/admin/owner + invariants (title/cover/body/embed) + bug latente CRITICAL documentado (lost writes sin `expectedVersion`).
   - `create-category`: cap enforcement + slug collision retry + reserved words + 7 ramas de validation.

4. **Densidad de cobertura = densidad de tests**. Estos 3 archivos cubren las **3 actions con severity CRITICAL/HIGH/MEDIUM más altas del slice**. Tests reducidos = cobertura reducida = blast radius mayor. La densidad sigue al riesgo.

5. **Funciones por debajo del cap de 60 líneas**. Cada `it(...)` es < 30 LOC. El single-function cap NO se viola — son archivos densos en cantidad de tests, no en complejidad por test.

6. **Bugs latentes documentados**. `update-item.test.ts` y `reorder-categories.test.ts` documentan vía `it.todo` los bugs CRITICAL/HIGH detectados (lost writes, TOCTOU race). Esos `todo` viven en los archivos para que cualquier persona reviewing el slice los vea — splitearlos a un archivo aparte oculta el contexto.

## Cuándo revisar

Revisar esta excepción si:

- Algún archivo supera **600 LOC** (≥ +100% sobre el cap actual).
- Aparece un patrón de **fixtures compartidos** en el repo (ej: `__tests__/_helpers/library-action-mocks.ts`) que reduzca el mock setup duplicado a < 30 LOC por archivo. En ese momento, los 3 archivos pueden bajar bajo cap sin sacrificar cohesión.
- Se introduce una herramienta de testing (ej: `msw`-style fixtures, test factories) que cambie la economía del setup.

## No aplica

Esta excepción **no** autoriza:

- Subir el cap general en CLAUDE.md ni architecture.md.
- Aplicar el carve-out a otros slices sin registro propio.
- Aplicar el carve-out a archivos de production (queries, actions, UI) — los caps ahí siguen estrictos.
- Tests con setup inflado por copy-paste cuando un helper local podría reducir el archivo bajo cap. Si un test file > 300 LOC _no_ tiene la densidad descripta aquí, debe splitearse o factorizarse.

## Referencias

- `CLAUDE.md` § Límites de tamaño
- `docs/architecture.md` § Límites de tamaño
- `docs/decisions/2026-04-20-discussions-size-exception.md` — slice-level
- `docs/decisions/2026-04-25-events-size-exception.md` — file-level (precedente para `domain/types.ts`)
- `docs/decisions/2026-05-01-discussions-types-size-exception.md` — file-level types puros (precedente reciente)
- `docs/plans/2026-05-01-audit-checklist.md` § M3

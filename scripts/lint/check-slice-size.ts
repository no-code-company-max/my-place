/**
 * CI cap enforcement — falla si algún slice o sub-slice supera el cap de
 * 1500 LOC sin estar en `WHITELIST` con un ADR vinculado.
 *
 * Reglas (CLAUDE.md + docs/architecture.md):
 *  - Cap default por feature/slice: 1500 LOC prod (excluyendo `__tests__/`).
 *  - Caps mayores requieren ADR explícito + entry en `WHITELIST` abajo.
 *  - Sub-slices (carpetas hijas con `public.ts` propio) cuentan como su
 *    propia unidad y se descuentan del raíz al medir el parent.
 *
 * Uso: `pnpm tsx scripts/lint/check-slice-size.ts` (corre desde `pnpm lint`).
 *
 * Excepciones autorizadas viven hardcoded acá — auditable por diff. NO usar
 * config externo ni env vars: el cap es decisión arquitectónica versionada.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const FEATURES_ROOT = join(__dirname, '..', '..', 'src', 'features')

/**
 * Cap default por slice/sub-slice. Documentado en CLAUDE.md +
 * docs/architecture.md.
 */
const DEFAULT_CAP_LOC = 1500

/**
 * Excepciones autorizadas. Cada entry **requiere** ADR vinculado.
 *
 * Para sumar entry:
 *  1. Redactar ADR en `docs/decisions/` justificando el cap mayor.
 *  2. Agregar `{ slicePath, maxLoc, adrPath }` con el path EXACTO desde
 *     `src/features/` (ej: `'discussions'` o `'library/embeds'`).
 *  3. `maxLoc` debe ser el LOC actual + margen razonable (ej: + 500 LOC para
 *     próximos 6 meses). NO poner Infinity — que el chequeo siga vigente.
 *  4. `adrPath` debe ser un archivo existente bajo `docs/decisions/`.
 *
 * Si una entry tiene `temporary: true` significa que está vigente sólo hasta
 * que se cierre un plan en curso. Documentado en el plan referenciado.
 */
type WhitelistEntry = {
  /** Path desde `src/features/`. Ej: `'discussions'` o `'library/embeds'`. */
  slicePath: string
  /** Cap autorizado en LOC prod. */
  maxLoc: number
  /** Path al ADR (relativo a repo root) que justifica la excepción. */
  adrPath: string
  /** Marcar `true` si la entry es temporal hasta cerrar un plan en curso. */
  temporary?: boolean
  /** Path al plan que cierra la temporalidad (requerido si `temporary`). */
  planPath?: string
}

const WHITELIST: ReadonlyArray<WhitelistEntry> = [
  // ---------------------------------------------------------------
  // Slices con sub-split planeado — entries TEMPORALES.
  // Cada plan referenciado se cierra en N sesiones; al cerrarse, la
  // entry se REMUEVE de este array (no es permanente). El día que
  // todos los slices estén bajo cap, este array queda vacío salvo
  // por excepciones permanentes con ADR (ej: discussions histórico).
  // ---------------------------------------------------------------
  // Whitelist vacío post-cleanup 2026-05-04. Cualquier slice nuevo que
  // requiera excepción debe agregar entry con ADR vinculado.
]

/**
 * Resultado del walk: una unidad medible (slice top-level o sub-slice).
 */
type SliceUnit = {
  /** Path desde `src/features/`. Ej: `'library'` o `'library/embeds'`. */
  slicePath: string
  /** Path absoluto en disco. */
  absolutePath: string
  /** Sub-slices directos (carpetas con `public.ts` propio bajo este slice).
   *  Se restan del cómputo de LOC del parent — cuentan en su propia unidad. */
  subSlices: string[]
}

/**
 * Detecta si una carpeta es una unidad medible (tiene `public.ts` o
 * `public.server.ts` directo en su raíz).
 */
function hasPublicEntry(absolutePath: string): boolean {
  try {
    const entries = readdirSync(absolutePath)
    return entries.some((e) => e === 'public.ts' || e === 'public.server.ts')
  } catch {
    return false
  }
}

/**
 * Walk: encuentra cada slice top-level + cada sub-slice (carpeta con
 * `public.ts` propio bajo el slice).
 */
function walkSliceUnits(): SliceUnit[] {
  const units: SliceUnit[] = []
  const topLevelEntries = readdirSync(FEATURES_ROOT)

  for (const entry of topLevelEntries) {
    const sliceAbsPath = join(FEATURES_ROOT, entry)
    if (!statSync(sliceAbsPath).isDirectory()) continue

    // Detectar sub-slices (1 nivel adentro con public.ts propio).
    const subSlices: string[] = []
    try {
      const subEntries = readdirSync(sliceAbsPath)
      for (const sub of subEntries) {
        const subAbsPath = join(sliceAbsPath, sub)
        if (!statSync(subAbsPath).isDirectory()) continue
        if (sub === '__tests__') continue
        if (hasPublicEntry(subAbsPath)) {
          subSlices.push(sub)
        }
      }
    } catch {
      // ignore — no readable
    }

    units.push({
      slicePath: entry,
      absolutePath: sliceAbsPath,
      subSlices,
    })

    for (const sub of subSlices) {
      units.push({
        slicePath: `${entry}/${sub}`,
        absolutePath: join(sliceAbsPath, sub),
        subSlices: [], // sub-sub-slices no soportados por ahora
      })
    }
  }

  return units
}

/**
 * Cuenta LOC de archivos `.ts` y `.tsx` bajo `absolutePath`, excluyendo:
 *  - `__tests__/` directorios
 *  - `*.test.ts` / `*.test.tsx` (tests fuera de __tests__/)
 *  - Sub-slices declarados (cuentan en su propia unidad)
 *  - `node_modules/` (defensive)
 */
function countLocProd(absolutePath: string, excludeSubSlices: string[]): number {
  let total = 0
  const stack: string[] = [absolutePath]
  const excludeAbsPaths = new Set(excludeSubSlices.map((s) => join(absolutePath, s)))

  while (stack.length > 0) {
    const current = stack.pop()
    if (current === undefined) break

    let entries: string[]
    try {
      entries = readdirSync(current)
    } catch {
      continue
    }

    for (const entry of entries) {
      const entryAbsPath = join(current, entry)
      let st
      try {
        st = statSync(entryAbsPath)
      } catch {
        continue
      }

      if (st.isDirectory()) {
        if (entry === '__tests__') continue
        if (entry === 'node_modules') continue
        if (excludeAbsPaths.has(entryAbsPath)) continue
        stack.push(entryAbsPath)
      } else if (st.isFile()) {
        if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) continue
        if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) continue
        try {
          const content = readFileSync(entryAbsPath, 'utf8')
          // Equivalente a `wc -l`: cuenta newlines. `split('\n').length - 1`
          // funciona en ambos casos (archivo termina en \n o no), porque
          // `split` produce un elemento extra vacío cuando el separador
          // está al final.
          total += content.split('\n').length - 1
        } catch {
          // ignore unreadable
        }
      }
    }
  }
  return total
}

function main(): void {
  const units = walkSliceUnits()
  const violations: Array<{
    slicePath: string
    locProd: number
    cap: number
    whitelisted: boolean
    adrPath?: string
    planPath?: string
  }> = []
  const reportRows: Array<{
    slicePath: string
    locProd: number
    cap: number
    headroom: number
    note: string
  }> = []

  for (const unit of units) {
    const locProd = countLocProd(unit.absolutePath, unit.subSlices)
    const whitelistEntry = WHITELIST.find((w) => w.slicePath === unit.slicePath)
    const cap = whitelistEntry?.maxLoc ?? DEFAULT_CAP_LOC

    let note = ''
    if (whitelistEntry) {
      note = whitelistEntry.temporary
        ? `whitelisted (TEMPORAL — plan ${whitelistEntry.planPath ?? '?'})`
        : `whitelisted (${whitelistEntry.adrPath})`
    }

    reportRows.push({
      slicePath: unit.slicePath,
      locProd,
      cap,
      headroom: cap - locProd,
      note,
    })

    if (locProd > cap) {
      const violation: {
        slicePath: string
        locProd: number
        cap: number
        whitelisted: boolean
        adrPath?: string
        planPath?: string
      } = {
        slicePath: unit.slicePath,
        locProd,
        cap,
        whitelisted: whitelistEntry !== undefined,
      }
      if (whitelistEntry?.adrPath !== undefined) violation.adrPath = whitelistEntry.adrPath
      if (whitelistEntry?.planPath !== undefined) violation.planPath = whitelistEntry.planPath
      violations.push(violation)
    }
  }

  // Reporte siempre se imprime (informativo).
  reportRows.sort((a, b) => b.locProd - a.locProd)
  console.log('\n[check-slice-size] LOC por slice/sub-slice (prod, sin __tests__):')
  for (const row of reportRows) {
    const status = row.locProd > row.cap ? '✗' : '✓'
    const headroomStr = row.headroom >= 0 ? `+${row.headroom}` : `${row.headroom}`
    const padded = row.slicePath.padEnd(28)
    console.log(
      `  ${status}  ${padded} ${String(row.locProd).padStart(5)} / ${String(row.cap).padStart(5)} (${headroomStr}) ${row.note}`,
    )
  }

  if (violations.length === 0) {
    console.log('\n[check-slice-size] OK — todos los slices bajo cap.\n')
    process.exit(0)
  }

  console.error('\n[check-slice-size] VIOLACIONES:')
  for (const v of violations) {
    console.error(
      `  ✗ ${v.slicePath}: ${v.locProd} LOC > cap ${v.cap}` +
        (v.whitelisted
          ? ` (excede whitelist autorizada por ${v.adrPath})`
          : ` (sin entry en WHITELIST)`),
    )
  }
  console.error(
    '\nOpciones:',
    '\n  - Sub-splittear el slice en sub-slices con `public.ts` propio.',
    '\n  - Redactar ADR de excepción + agregar entry a WHITELIST en este script.',
    '\n  - Si la excepción es temporal hasta cerrar un plan, marcar `temporary: true` + `planPath`.',
    '\n\nNO subir el cap default — el cap es decisión arquitectónica documentada en CLAUDE.md.\n',
  )
  process.exit(1)
}

main()

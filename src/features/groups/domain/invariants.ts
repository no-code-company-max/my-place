/**
 * Invariantes puras del slice `groups` (G.2).
 *
 * Funciones puras — sin Prisma, sin Next, sin React. Las server actions
 * las llaman después de parsear el input Zod para validar reglas de
 * negocio antes de tocar la DB.
 *
 * Devuelven boolean (o array de issues) en lugar de tirar — los callers
 * decidén si responden con discriminated union o `ValidationError`.
 *
 * Ver `docs/features/groups/spec.md` § 4 + § 10.
 */

import { isValidPermission, type Permission } from './permissions'

/** Limites del nombre de grupo (matchea el `@db.VarChar(60)` del schema). */
export const GROUP_NAME_MIN_LENGTH = 1
export const GROUP_NAME_MAX_LENGTH = 60

/** Limite de la descripción (matchea el `@db.VarChar(280)` del schema). */
export const GROUP_DESCRIPTION_MAX_LENGTH = 280

/**
 * `true` si el nombre tiene longitud válida tras `trim`. NO chequea
 * unicidad — eso es responsabilidad de la action (caso runtime con
 * acceso a DB → discriminated union `group_name_taken`).
 */
export function isValidGroupName(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length >= GROUP_NAME_MIN_LENGTH && trimmed.length <= GROUP_NAME_MAX_LENGTH
}

/**
 * Lanza un Error simple si el nombre es inválido. Útil para gates
 * defensivos cuando el caller sabe que ya pasó por Zod (Zod ya tira
 * `ValidationError` con shape correcto). NO se usa en server actions
 * — ahí se prefiere Zod + discriminated union.
 */
export function assertGroupName(name: string): void {
  if (!isValidGroupName(name)) {
    throw new Error(
      `Group name must be between ${GROUP_NAME_MIN_LENGTH} and ${GROUP_NAME_MAX_LENGTH} characters.`,
    )
  }
}

/**
 * Filtra un array recibido del cliente al subset de permisos válidos
 * según el enum hardcoded. Devuelve los inválidos por separado para
 * que el caller pueda tirar `ValidationError` o discriminated union.
 *
 * Idempotente y dedupe-aware: si un permiso aparece dos veces, queda
 * una sola vez en `valid`.
 */
export function partitionPermissions(input: ReadonlyArray<string>): {
  valid: Permission[]
  invalid: string[]
} {
  const seen = new Set<string>()
  const valid: Permission[] = []
  const invalid: string[] = []
  for (const item of input) {
    if (seen.has(item)) continue
    seen.add(item)
    if (isValidPermission(item)) {
      valid.push(item)
    } else {
      invalid.push(item)
    }
  }
  return { valid, invalid }
}

/**
 * `true` si todos los items del array son `Permission` válidos.
 */
export function arePermissionsValid(input: ReadonlyArray<string>): boolean {
  return partitionPermissions(input).invalid.length === 0
}

/**
 * Normaliza un array (dedupe + filtra inválidos) y devuelve sólo los
 * válidos. Caller defensivo: tras Zod, llamamos a esto para asegurar
 * que NO se persista un duplicado o un valor manipulado.
 */
export function normalizePermissions(input: ReadonlyArray<string>): Permission[] {
  return partitionPermissions(input).valid
}

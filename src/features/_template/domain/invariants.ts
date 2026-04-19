import { InvariantViolation } from '@/shared/errors/domain-error'

/**
 * Invariantes del dominio de este slice.
 *
 * Estas funciones son la forma canónica de expresar reglas estructurales:
 * tipan su contexto, lanzan errores de dominio descriptivos, y son
 * testeables sin infraestructura.
 *
 * Ejemplo (para referencia — no usar tal cual):
 *
 * export function assertMaxMembers(count: number) {
 *   if (count >= 150) {
 *     throw new InvariantViolation(
 *       'Un place no puede exceder 150 miembros.',
 *       { count }
 *     )
 *   }
 * }
 */

export function assertTemplateInvariant(_ctx: unknown): void {
  // Placeholder: reemplazar por reglas reales al copiar este template.
  void InvariantViolation
}

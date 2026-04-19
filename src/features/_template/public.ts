/**
 * API pública de este slice. ÚNICO punto de entrada desde otras partes del sistema.
 *
 * Reglas (ver architecture.md):
 * - Otras features SOLO pueden importar desde aquí.
 * - Nunca exportar internals (db queries crudas, helpers privados).
 * - Exportar: componentes UI top-level, server actions que otras features usen,
 *   tipos de dominio que sean parte del contrato público.
 *
 * Este archivo es un template — reemplazar exports al copiar esta carpeta.
 */

export type { TemplateEntity } from './domain/types'
// export { createTemplate } from './server/actions'
// export { TemplateView } from './ui/template-view'

import { z } from 'zod'

/**
 * Zod schemas del slice. Usados por:
 * - Server actions (parse del input antes de tocar DB)
 * - Forms (react-hook-form + zodResolver)
 * - Tests (generar fixtures tipados)
 */

export const templateCreateSchema = z.object({
  // Ejemplo — reemplazar por campos reales.
  name: z.string().min(1).max(200),
})

export type TemplateCreateInput = z.infer<typeof templateCreateSchema>

import { z, type ZodTypeAny } from 'zod'
import { ValidationError } from '@/shared/errors/domain-error'

/**
 * Audit #5: schemas Zod para validar **antes del insert** los snapshots
 * que se persisten como JSONB (`AuthorSnapshot`, `QuoteSnapshot`).
 *
 * **Por qué**: hoy las creates de Post/Comment hacen `as Prisma.InputJsonValue`
 * sin validar runtime. Si alguien refactorea `buildAuthorSnapshot` o
 * `buildQuoteSnapshot` y mete un campo no JSON-serializable (`Map`, `Set`,
 * `Function`, ref circular), Prisma lo guarda como `{}` o tira opaco. Validar
 * acá detecta el error antes de tocar DB y devuelve un `ValidationError`
 * tipado con el path del campo inválido.
 *
 * **Por qué los types siguen en `domain/types.ts`**: estos schemas son
 * subconjunto del shape (campos requeridos + tipos primitivos). Mantener el
 * type separado evita romper los muchos consumers de `AuthorSnapshot` y
 * `QuoteSnapshot` que sólo necesitan el shape, no el validator. Si en el
 * futuro queremos single-source-of-truth, podemos derivar el type con
 * `z.infer` — el shape es idéntico hoy.
 */

export const authorSnapshotSchema = z.object({
  displayName: z.string().min(1),
  avatarUrl: z.string().nullable(),
})

export const quoteSnapshotSchema = z.object({
  commentId: z.string().min(1),
  authorLabel: z.string(),
  bodyExcerpt: z.string(),
  // Date in-memory; Prisma serializa a ISO string al insertar JSONB.
  // z.date() acepta sólo instancias reales de Date — descarta strings o numbers.
  createdAt: z.date(),
})

/**
 * Helper genérico: valida `value` contra `schema` y devuelve el value si pasa,
 * o throwea `ValidationError` con el path del campo inválido. Reusable desde
 * cualquier action de discussions que persiste un shape JSONB.
 */
export function assertSnapshot<T>(value: T, schema: ZodTypeAny): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new ValidationError('Snapshot inválido para persistir.', {
      issues: result.error.issues,
    })
  }
  return value
}

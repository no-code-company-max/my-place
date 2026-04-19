import { getTemplateById } from '../server/queries'

/**
 * Server Component por default (Next 15). Client Components se marcan con 'use client'.
 * Ver `ui/template-form.tsx` como ejemplo de Client Component.
 */
export async function TemplateView({ id }: { id: string }) {
  const entity = await getTemplateById(id)

  if (!entity) {
    return (
      <section className="p-4">
        <p className="text-place-text-soft">Vacío.</p>
      </section>
    )
  }

  return (
    <section className="p-4">
      <p className="text-place-text">Entity {entity.id}</p>
    </section>
  )
}

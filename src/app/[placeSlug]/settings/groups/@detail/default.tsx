/**
 * Default del slot `@detail` de `/settings/groups/*` (Parallel Routes
 * Next 15). Se renderea cuando NO hay un grupo seleccionado en el URL
 * (ej. el user está en `/settings/groups` raíz).
 *
 * - Desktop: ocupa el detail pane del split con un placeholder calmo
 *   "Elegí un grupo para ver detalle".
 * - Mobile: NO se ve (el `<MasterDetailLayout>` esconde el detail pane
 *   cuando `hasDetail=false`).
 *
 * Ver `docs/features/groups/spec.md` § 5.
 */
export default function GroupsDetailDefault() {
  return (
    <div className="flex h-full items-center justify-center px-6 py-10">
      <div className="text-center">
        <p className="text-sm text-neutral-500">Elegí un grupo de la lista para ver su detalle.</p>
      </div>
    </div>
  )
}

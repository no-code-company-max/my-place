# Prompt — Library

```
Voy a implementar la slice Library siguiendo docs/design/library/.

Stack: Next.js 15 App Router, TS strict, Tailwind + CSS vars, Supabase + Prisma.

Pasos:

1. Lee docs/design/library/DESIGN_NOTES.md y components.tsx.

2. Estructura:
   - app/[community]/library/page.tsx (Server Component)
     · query categories (sorted by sortOrder) + count de docs por categoría
     · query recent docs (limit 5, order by uploadedAt DESC)
   - components/library/LibraryHeader.tsx (Server)
   - components/library/CategoryGrid.tsx (Server)
   - components/library/CategoryCard.tsx (Server, link)
   - components/library/RecentDocList.tsx (Server)
   - components/library/RecentDocRow.tsx (Server, link al doc)
   - components/library/FileIcon.tsx (Server) — switch por type
   - components/library/EmptyLibrary.tsx (Server)

3. Tipos en TS strict (ver shape en DESIGN_NOTES).

4. Estados:
   - Loading: skeleton de 4 categorías + 3 recents.
   - Empty: si categories.length === 0.

5. Uploads: out of scope para v1. El botón "Subir el primero"
   render como disabled o redirige a una página placeholder.
```

## Notas

- Los **recents** son top-5 entre todas las categorías. La query es:
  `SELECT * FROM docs ORDER BY uploaded_at DESC LIMIT 5`.
- Cuando se tape un doc:
  - `type === 'pdf'` o `'image'` → abrir en una sheet/modal full-screen.
  - `type === 'link'` → `window.open(url, '_blank', 'noopener,noreferrer')`.
  - `type === 'doc'` o `'sheet'` → si es Google Workspace, abrir en pestaña; si es archivo subido, descargar.
- El **chevron** en cada recent row es solo decorativo — el row entero es el link.

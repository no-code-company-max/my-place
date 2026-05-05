# Prompt — Library Category

```
Voy a implementar la slice Library Category siguiendo
docs/design/library-category/.

Stack: Next.js 15 App Router, TS strict, Tailwind + CSS vars.

Pasos:

1. Lee docs/design/library-category/DESIGN_NOTES.md.

2. Estructura:
   - app/[community]/library/[categoryId]/page.tsx (Server Component)
     · query category + ALL docs en esa categoría
   - components/library-category/CategoryHeaderBar.tsx (Client) — back con router.back()
   - components/library-category/CategoryTitle.tsx (Server)
   - components/library-category/TypeFilterBar.tsx (Client) — useState, no query param
   - components/library-category/DocList.tsx (Server, recibe docs filtrados como prop)
   - components/library-category/PdfSheet.tsx (Client) — Radix Dialog
   - components/library-category/ImageLightbox.tsx (Client) — Radix Dialog
   - components/library-category/EmptyResults.tsx (Server)

3. Filter handling:
   - TypeFilterBar es Client, mantiene el filter state con useState.
   - Toda la lista renderiza en el cliente (cheap: ~50 items max).
   - O patrón "wrapper Client + children Server" si querés mantener docs en server:
     - TypeFilterBar wraps el listado y aplica display:none vía data-attr.
   - Pick uno; recomiendo Client-side filtering por simplicidad.

4. Type pills disponibles:
   - Calcular dinámicamente: solo mostrar pills para types que existen
     en docs[]. Siempre mostrar "Todos".

5. Doc opening:
   - PdfSheet abre cuando type === 'pdf'.
   - ImageLightbox abre cuando type === 'image'.
   - Otros → window.open.
   - Manejar el state del sheet/lightbox con useState en el page-level
     o en un context si querés reusar.

Cuando termines mostrame:
- Estructura de archivos
- Cómo manejaste el routing del back button (router.back vs Link)
```

## Notas

- **Back button**: `router.back()` es lo más natural. Pero si el usuario llegó vía deep-link, no hay historial — fallback a `<Link href={`/${community}/library`}>`.
  - Patrón: `if (window.history.length > 1) router.back(); else router.push(libraryHref);`
- **PDF iframe**: en iOS Safari, los iframes con PDF a veces no funcionan. Considerá usar `<embed>` o redirigir directo al URL.

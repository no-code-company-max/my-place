# Prompt sugerido para Claude Code — Shell

Este es el shell que envuelve toda la app. Implementalo **primero**, antes de cualquier slice.

---

```
Voy a implementar el shell de la app siguiendo el design package en docs/design/_shell/.

Stack: Next.js 15 (App Router), TypeScript strict, React 19, Tailwind + CSS variables,
Supabase + Prisma, TanStack Query.

Pasos:

1. Lee docs/design/_shell/DESIGN_NOTES.md.

2. Lee docs/design/_shell/components.tsx — referencias JSX en inline styles.
   Traducí a Tailwind manteniendo los tokens (--accent, --text, etc.).

3. Pegá los tokens de docs/design/_shell/design-tokens.css en app/globals.css
   (si no están ya — cualquier slice anterior puede haberlos agregado, son los mismos).

4. Pegá el snippet de docs/design/_shell/tailwind.config.snippet.ts en
   tailwind.config.ts bajo theme.extend.

5. Estructura sugerida:
   - app/[community]/layout.tsx → Server Component que hace fetch del usuario,
     sus comunidades, y la comunidad activa.
   - components/shell/TopBar.tsx (Client) — recibe community + communities,
     maneja el estado del dropdown.
   - components/shell/CommunityDropdown.tsx (Client) — animación con CSS
     transitions, backdrop con onClick close.
   - components/shell/Dots.tsx (Client) — recibe current section + onGo.
   - components/shell/StatusBar.tsx — solo en preview, NO en producción
     (envolvelo en `process.env.NEXT_PUBLIC_PREVIEW === 'true'`).

6. Routing:
   - /[community] → la comunidad activa, sección 0 (Home)
   - /[community]?s=1..3 → otras secciones (manejá el query param desde
     el layout/page; el viewport hace nav por hash o ?s).
   - Cambio de comunidad: router.push(`/${nextCommunity.id}`).

7. El swipe horizontal entre secciones lo implementaremos en otra slice.
   Por ahora el shell solo expone los Dots con onClick que cambia el query param.

8. Estados:
   - Loading dropdown: mostrar skeletons de las filas mientras llegan las comunidades.
   - Empty: si el usuario solo tiene 1 comunidad, no mostrar el chevron en el switcher
     (no hay a dónde cambiar) — solo "+ Descubrir comunidades" en el dropdown.

Cuando termines, mostrame:
- La estructura de archivos creados
- Los tipos TypeScript definidos
- Cómo se persiste la "comunidad activa" entre sesiones (cookie/localStorage/DB?)
```

---

## Notas adicionales

- **No implementes la búsqueda todavía** — el botón solo dispara `onOpenSearch` que abre un modal. La slice de search es separada (`docs/design/search/`).
- **Performance**: el TopBar es Client, pero la lista de `communities` la pasa el layout (Server) como prop. No la fetchees desde el cliente.
- **Animaciones**: usá CSS transitions plain. Nada de framer-motion para esto — es overkill.

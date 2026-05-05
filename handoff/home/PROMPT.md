# Prompt sugerido para Claude Code

Copiá y pegá esto en tu terminal con Claude Code, dentro del repo:

---

```
Voy a implementar la slice de Home siguiendo el design package en docs/design/home/.

Stack: Next.js 15 (App Router), TypeScript strict, React 19, Tailwind + CSS variables,
Supabase + Prisma, TanStack Query, vertical slices.

Pasos:

1. Lee docs/design/home/DESIGN_NOTES.md para entender el diseño completo,
   estructura, tokens, datos requeridos y decisiones tomadas.

2. Lee docs/design/home/components.tsx — son los componentes JSX de referencia
   del prototipo. NO los copies tal cual: están en estilos inline. Usalos como
   guía estructural y traducí los estilos a clases de Tailwind, manteniendo
   las CSS variables del proyecto (--accent, --text, etc.) cuando aplique.

3. Mirá docs/design/home/screenshots/ para ver el resultado visual esperado.

4. Si no existen, agregá las CSS variables del archivo
   docs/design/home/design-tokens.css a app/globals.css.

5. Creá la slice siguiendo nuestra estructura de vertical slices:
   - Server Component principal en app/[community]/page.tsx (la home de una comunidad)
   - Componentes presentacionales (Server) que reciben props
   - Client Components solo donde haga falta interactividad
   - Datos: query a Prisma desde el Server Component, en paralelo (Promise.all)
     para latestThread, nextEvent, latestDocs, members
   - Tipos en TypeScript estricto (ver shape de HomeData en DESIGN_NOTES.md)

6. Para variantes (eventVariant, libraryVariant): por ahora hardcodeá las
   defaults (postit y stack). Más adelante las exponemos via preferencias de usuario.

7. Estados:
   - Loading: usar Suspense + loading.tsx con skeletons de cada bloque
   - Error: error.tsx por slice
   - Empty: cada card debe mostrar empty state propio si no hay datos

Cuando termines, mostrame:
- La estructura de archivos creados
- Los tipos TypeScript definidos
- Cualquier decisión de tradeoff que hayas tomado y por qué
```

---

## Notas adicionales para Claude Code

- **No traer dependencias nuevas** salvo las del stack ya definido.
- **Tailwind primero**, CSS variables solo para tokens (colores, radii, padding).
- **Si necesitás avatares con iniciales**, podés crear un componente `<Avatar>` reutilizable.
- **Iconos**: si hay un sistema de iconos en el repo, usalo; sino, importar de `lucide-react`.
- **Mobile-first**: este diseño es para mobile. Desktop puede mantener el mismo grid de 2 cols con max-width centrado, no expandir a 3+ cols por ahora.

## Después de la slice de Home

Las siguientes slices comparten muchas primitivas con Home (Avatar, BentoCard, BentoHead, Tag). Idealmente extraelas a una carpeta `components/ui/` durante esta slice así las reusan las próximas (Threads, Events, Library).

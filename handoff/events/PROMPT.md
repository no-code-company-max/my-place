# Prompt sugerido para Claude Code

Copiá y pegá esto en tu terminal con Claude Code, dentro del repo:

---

```
Voy a implementar la slice de Events siguiendo el design package en
docs/design/events/.

Stack: Next.js 15 (App Router), TypeScript strict, React 19, Tailwind + CSS
variables, Supabase + Prisma, TanStack Query, vertical slices.

Pasos:

1. Lee docs/design/events/DESIGN_NOTES.md para entender el diseño completo
   de las dos pantallas (lista bento + detalle), estructura, tokens, datos
   requeridos y decisiones tomadas.

2. Lee docs/design/events/components.tsx — son los componentes JSX de
   referencia del prototipo. NO los copies tal cual: están en estilos inline.
   Usalos como guía estructural y traducí los estilos a clases de Tailwind,
   manteniendo las CSS variables del proyecto (--accent, --text, etc.) cuando
   aplique.

3. Mirá docs/design/events/screenshots/ para ver el resultado visual esperado.

4. Si no existen, agregá las CSS variables del archivo
   docs/design/events/design-tokens.css a app/globals.css. (Si ya las agregaste
   con la slice de Home, saltá este paso — son las mismas.)

5. Reusá primitivas existentes: Avatar, BentoCard, BentoHead, Composer,
   CommentItem. Si no existen todavía en components/ui/, este es el momento
   de extraerlas — Events las necesita y luego Threads/Library las van a
   reusar.

6. Creá la slice siguiendo nuestra estructura de vertical slices:

   app/[community]/events/page.tsx               ← lista (Server Component)
     ├─ EventsBento.tsx                          ← Client (filter + grid)
     └─ EventCard.tsx                            ← presentational
   app/[community]/events/[eventId]/page.tsx     ← detalle (Server Component)
     ├─ EventHeader.tsx                          ← presentational
     ├─ EventCardBlock.tsx                       ← Client (RSVP state)
     ├─ EventDescription.tsx                     ← presentational
     ├─ EventComments.tsx                        ← Server (data) + Client (composer)
     └─ EventComposer.tsx                        ← Client

7. Datos:
   - Server Component: query Prisma en paralelo (Promise.all) para
     event + attendees + comments
   - RSVP es estado optimista: mutación con Server Action, useOptimistic
     en el cliente
   - Tipos en TypeScript estricto (ver shape de EventData en DESIGN_NOTES.md)

8. Estados:
   - Loading: Suspense + loading.tsx con skeletons
   - Error: error.tsx por slice
   - Empty: lista de eventos vacía → CTA "Crear primer evento" (placeholder
     onClick por ahora, el form es out of scope)
   - 404 evento: notFound() en el Server Component

9. Variants del bento card (postit/wall/minimal/countdown): por ahora
   hardcodeá `postit` como default. Más adelante las exponemos via
   preferencias de comunidad (campo `eventCardVariant` en Community).

Cuando termines, mostrame:
- La estructura de archivos creados
- Los tipos TypeScript definidos
- Cualquier decisión de tradeoff que hayas tomado y por qué
```

---

## Notas adicionales para Claude Code

- **No traer dependencias nuevas** salvo las del stack ya definido.
- **Tailwind primero**, CSS variables solo para tokens (colores, radii, padding).
- **Formateo de fechas**: usar `date-fns` con locale español. Mostrar "Sáb 27 Abr"
  en lista, "Sábado 27 de abril" en detalle. Usar `formatRelative` para "hace 2 h"
  en comentarios.
- **Iconos**: si hay un sistema de iconos en el repo, usalo; sino, importar de
  `lucide-react` (`MapPin`, `Calendar`, `ArrowLeft`, `Send`, `Check`).
- **Mobile-first**: este diseño es para mobile. En desktop, mantener la grid
  bento centrada con max-width 640px — no expandir a más columnas.
- **RSVP**: el botón activo invierte fondo (text bg, bg fg). Los tres son
  exclusivos — apretar el activo lo des-selecciona (toggle).
- **Comentarios**: idénticos al de Threads. El composer es idéntico también.
  Si ya implementaste Threads, importalos directo.

## Después de la slice de Events

La slice de **Library** comparte el patrón de "lista categorizada → detalle".
La slice de **Threads** comparte composer y comentarios — extraé esas
primitivas en `components/ui/` durante esta slice si todavía no lo hiciste.

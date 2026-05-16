# Producto · visión y principios de experiencia

Documento canónico de **qué es Place** y de los **principios de experiencia/diseño** que atraviesan todos los objetos. Es la fuente de verdad de producto. Los objetos del core (miembros, conversaciones, eventos) tienen su ontología propia en `docs/ontologia/`; este documento es lo transversal que no pertenece a un objeto único.

---

## Qué es Place

Place es un lugar digital pequeño e íntimo para hasta 150 personas. Es **cozytech**: un espacio tranquilo donde entrás, te ponés al día de lo que pasa, participás si querés, y salís. Como entrar a un pub conocido — no como abrir una red social.

**No es:** un feed con scroll infinito, una app que compite por atención, un producto con notificaciones agresivas, un sistema con métricas de engagement, ni una plataforma con gamificación.

**Es:** un lugar con miembros, conversaciones, eventos y memoria compartida. Donde cada place tiene su identidad visual propia y su propio ritmo.

---

## Principios no negociables de experiencia

Estos principios definen el DNA de Place. Violarlos es violar qué es el producto. Aplican a toda la UI, en todos los objetos.

- **Nada parpadea, nada grita, nada demanda atención.** La información está disponible para el que mire, nunca se impone.
- **Sin métricas vanidosas.** No se muestran contadores que no aporten al lugar ("47 eventos en memoria", "el más consultado esta semana").
- **Sin urgencia artificial.** Nada de "EN 2 DÍAS", "ÚLTIMA CHANCE", countdowns o similar.
- **Sin gamificación.** No hay streaks, badges, puntos, niveles, rankings, achievements.
- **Sin push notifications agresivas.** El MVP no tiene push notifications. Sumar notificaciones requiere decisión de producto, no técnica.
- **Sin infinite scroll.** Los feeds interminables son el paradigma opuesto.
- **Presencia silenciosa.** Quién está se comunica visualmente (burbuja con borde verde), nunca con texto ansioso ni animaciones.
- **Customización activa, no algorítmica.** El admin del place configura colores. El orden y la personalización son decisión humana, no del algoritmo.

---

## Identidad visual por place

- **Cada place tiene identidad visual propia**, configurable por el admin. El producto provee defaults; cada place los personaliza dentro de límites que protegen usabilidad.
- Los colores del place viven como CSS custom properties configurables, no como clases Tailwind hardcoded. El detalle técnico está en `docs/architecture.md` y `docs/stack.md`.

---

## Multi-idioma

Place es una plataforma multi-idioma. La regla estructural es la **frontera estático/dinámico**:

- **Contenido estático se traduce.** Todo lo que provee el producto —landing page, formularios, labels, instrucciones, mensajes del sistema, emails transaccionales— está disponible en los idiomas soportados.
- **Contenido dinámico NO se traduce.** Lo que crea un miembro (mensajes, temas, eventos, nombres, descripciones del place) queda en el idioma en que se escribió. Place nunca auto-traduce contenido de la gente: traducir automáticamente es ruido y distorsión, contrario al principio cozytech. Si alguien quiere traducir lo que lee, lo hace fuera del producto.

**Idiomas y roadmap:**

- **Español** — idioma base, day-one. Todo el contenido estático existe en ES desde el MVP.
- **Inglés, Francés, Portugués** — roadmap post-MVP. Se suman cuando la infraestructura i18n esté lista; no son bloqueantes para lanzar.

La estrategia técnica (librería, catálogos de mensajes, routing por locale, detección) es **TBD** y se documenta en `docs/stack.md`.

## Dónde vive el resto

Los principios que pertenecen a un objeto específico viven en su ontología canónica, no acá:

- **Identidad de los miembros** (se manifiestan por lo que hacen, identidad contextual, derecho al olvido, sin perfil público fuera de places) → `docs/ontologia/miembros.md`
- **Comunicación** (discusiones como turnos editoriales, audios efímeros, lectores como presencia, temas dormidos) → `docs/ontologia/conversaciones.md`
- **Momentos compartidos** (eventos-ocasión vs ritual, acumulación como memoria cálida) → `docs/ontologia/eventos.md`
- **Invariantes de dominio** (máx 150 miembros, mínimo 1 owner, slug inmutable, transferencia de ownership) → `docs/data-model.md`
- **Horario y multi-tenancy** (gate por horario, routing por subdomain, slug inmutable) → `docs/multi-tenancy.md` y `docs/ontologia/conversaciones.md`

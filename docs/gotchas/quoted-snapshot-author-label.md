# `quotedSnapshot.authorLabel` es inmutable — asimetría histórica intencional

Cuando un comment cita a otro, `buildQuoteSnapshot` congela `authorLabel` al momento de citar (vive en `Comment.quotedSnapshot JSONB`).

Si luego el author del comment citado deja el place y pasa por erasure 365d → su `authorSnapshot.displayName` se renombra a "ex-miembro", pero el `quotedSnapshot.authorLabel` en los comments que lo citaron **sigue mostrando el nombre original**.

**Esto es deliberado:** el snapshot de la cita es un snapshot histórico del momento de la cita. No se retro-anonimiza porque implicaría scan + UPDATE de cada cita que referencie al ex-miembro, y rompería la semántica "snapshot congelado" del sistema de citas.

Documentado en `docs/decisions/2026-04-24-erasure-365d.md` § "Alternativas descartadas".

# Cookie residual host-only: cleanup self-heals individualmente por subdomain

## Síntoma

Un user que tiene cookies residuales con `Domain=<host>` (host-only) en MÚLTIPLES place subdomains (`the-company.place.community`, `another-place.place.community`) experimenta el bug de auth (`refresh_token_not_found`) en cada subdomain de forma independiente.

El cleanup defensivo (commit `6ed1a4c` + Sesión 1 hardening en `af99683`) y el proactivo (Sesión 3 en `737bbb5`) limpian la cookie residual del **host actual** cuando se dispara. No tocan cookies de OTROS subdomains hermanos: por **RFC 6265 § 5.3 step 5**, un host solo puede emitir Set-Cookie para su propio domain o un ancestor, NUNCA para domains hermanos.

Resultado: si el user tiene residuales en N subdomains, necesita visitar cada uno una vez para que cada middleware self-heal su residual.

## Quién se ve afectado

- **Testers internos** que probaron flows previos en múltiples places durante el desarrollo (commits pre-fix emitían cookies sin Domain attribute, generando residuales host-only).
- **Cualquier user** que hubiera visitado N subdomains place ANTES del deploy de los fixes (commits `0a9b489`, `8ab7649`, `6ed1a4c`+).

**Users genuinamente nuevos en producción no se ven afectados** — el código actual SIEMPRE emite cookies con `Domain=<apex>` (validado vía `tests/boundaries.test.ts`, ver `docs/architecture.md` § "Cookies de sesión Supabase (Domain)").

## Workaround inmediato

En el browser:

1. DevTools → Application → Cookies
2. Filtrar por `place.community`
3. Borrar todas las cookies `sb-*` con `Domain=<host>` (host-only, columna Domain sin leading dot)
4. Mantener las que tienen `Domain=.place.community` o `Domain=place.community` (apex)

En Safari iOS (sin DevTools):

1. Settings → Safari → Advanced → Website Data → buscar `place.community`
2. Eliminar todos los entries de `place.community` y subdomains
3. Re-loguearse desde el email de invitación

## Por qué no se puede arreglar centralmente

Considerado y descartado:

- **Cleanup desde el callback en apex con Domain=apex**: las cookies host-only NO matchéan ese pattern (RFC 6265: un Set-Cookie con `Domain=<apex>` no afecta cookies con `Domain=<subdomain>`).
- **Cleanup desde un endpoint compartido que itere subdomains**: requiere conocer la lista de places del user (lookup DB) Y emitir N requests cross-host con cookies (cada Set-Cookie host-only debe venir del subdomain mismo, no se puede hacer desde apex).
- **iframe trick para limpiar N subdomains**: rompe el flow visual del user (botón "Continuar" único de la PÁGINA 1 deja de funcionar como espera).

El approach actual (self-heal individual) es el menos invasivo y se completa orgánicamente: la primera visita a cada subdomain con residual dispara el cleanup proactivo (transparente, redirect al mismo URL) o el reactivo (un /login extra). Después, el subdomain queda limpio.

## Observability

Buscar en Vercel Logs:

```
debug:"MW_proactive_cleanup"  # cleanup proactivo (1 redirect transparente)
debug:"MW_stale_cleanup"      # cleanup reactivo (1 /login intermedio)
```

Ambos incluyen `host`, `path`, `currentRef`, `clearedNames` para identificar el subdomain afectado. Si el problema persiste tras el deploy de los fixes, esos logs deberían decrecer monotónicamente con el tiempo (cada user limpia sus residuales orgánicamente).

## Referencias

- ADR completo: `docs/decisions/2026-05-10-cookie-residual-host-only-cleanup.md`
- Plan de hardening: `docs/plans/2026-05-10-cookie-cleanup-hardening.md` (4 sesiones)
- Implementación reactiva: `src/shared/lib/supabase/middleware.ts` (catch path)
- Implementación proactiva: `src/shared/lib/supabase/proactive-residual-cleanup.ts`
- Boundary test guard: `tests/boundaries.test.ts` (cookies sb-\* con Domain)

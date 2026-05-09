# Supabase Auth manda magic links via SMTP de Resend (no via su SMTP default)

Por qué: el SMTP default de Supabase es free tier con cap muy bajo (~3-4 emails/hora). Con eso agotado, **el flow de login (`signInWithOtp`) deja de funcionar** — el user ni puede pedir su magic link, lo cual bloquea testing y producción real.

**Importante:** este setup es **separado** del `RESEND_API_KEY` + `EMAIL_FROM` del app (`src/shared/lib/mailer/provider.ts`). Esos sirven para emails que **el app** manda (invitations). Los magic link de login los manda **Supabase** internamente vía SMTP — no podemos interceptarlos desde código. La única forma de cambiar quién los manda es darle a Supabase otras credenciales SMTP.

## Setup (una vez por ambiente)

### 1. Verificar el dominio en Resend

Si no lo está ya: Resend → Domains → Add Domain → `place.community` → agregar los DNS records que pida Resend (TXT DKIM en `resend._domainkey`, MX + TXT en `send`, SPF + DMARC en apex). Para Place el DNS está en **Vercel** (nameservers `ns1/ns2.vercel-dns.com`); los records se agregan en Vercel Dashboard → Domains → `place.community` → DNS Records, no en el registrar.

### 2. Crear API key de Resend dedicada para SMTP

Resend → API Keys → Create:

- **Name:** `Supabase Auth SMTP`
- **Permission:** `Sending access only` (más restrictivo que Full)
- **Domain:** `place.community` (restringir, no dejar All)

Es **separada** de la `RESEND_API_KEY` del app. Razón: poder rotar/revocar SMTP sin romper invitations del app, y viceversa. Una sola key compartida es un footgun de blast radius.

### 3. Configurar SMTP en Supabase Dashboard

Supabase Dashboard → Authentication → Settings → SMTP Settings → toggle **"Enable Custom SMTP"** ON.

| Campo        | Valor                                                   |
| ------------ | ------------------------------------------------------- |
| Sender email | `hola@place.community` (mismo que `EMAIL_FROM` del app) |
| Sender name  | `Place`                                                 |
| Host         | `smtp.resend.com`                                       |
| Port         | `465`                                                   |
| Username     | `resend`                                                |
| Password     | la API key del paso 2                                   |

Guardar. Después subir el rate limit en Authentication → Rate Limits → "Rate limit for sending emails" (con custom SMTP Supabase deja hasta el límite de tu plan Resend).

## Verificación

1. Pedir magic link en `/login` con un email tuyo.
2. Email debe llegar de `hola@place.community` (no del default `noreply@mail.app.supabase.io` o similar).
3. Resend Dashboard → Logs → debe aparecer el send registrado.

Si no llega:

- Resend Logs vacío → Supabase no llegó a SMTP. Chequear Supabase Dashboard → Logs → Auth para ver el error (típico: password mal copiada o sender email con dominio no verificado).
- Resend Logs con error → DNS de DKIM/SPF no propagó o key revocada.

## No olvidar al cambiar de dominio

Cuando cambia el `EMAIL_FROM` del app (paso de `ogas.ar` a `place.community`, por ejemplo), hay que cambiar **dos** cosas separadas:

1. `EMAIL_FROM` env var en Vercel + `.env.local` + `.env.example` — afecta los envíos del app.
2. **Sender email en Supabase Auth SMTP Settings** — afecta los magic links de login.

Si solo se actualiza (1), las invitations salen del nuevo dominio pero los magic links siguen saliendo del viejo.

## Rotación de la API key SMTP

1. Crear nueva key en Resend con mismo permission/scope.
2. Actualizar password en Supabase Dashboard.
3. Esperar 24h para confirmar que ningún send falla (Supabase puede tener requests en cola).
4. Revocar la vieja en Resend.

No requiere downtime. La key vieja sigue funcionando hasta que la revocás.

## Ambientes separados

Cada ambiente con Supabase project propio (dev/staging/prod) requiere repetir los pasos 2-3 — la config SMTP vive en el project Supabase, no se copia automáticamente. Si compartís dominio Resend entre ambientes, podés reusar la misma API key SMTP, pero recomendado: una key por ambiente para audit.

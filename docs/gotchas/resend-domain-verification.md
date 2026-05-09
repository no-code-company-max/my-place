# Resend: el dominio del `From` debe estar verificado en el dashboard

Si `EMAIL_FROM` apunta a un dominio no verificado, Resend responde `400 validation_error: "The <from> domain is not verified"` y el caller lo recibe como `InvitationEmailFailedError`. La UI muestra el mensaje del error, pero no hay warning a nivel app.

**Fix:** verificar DNS (SPF + DKIM + DMARC) en Resend → Domains antes del primer send en cada ambiente (dev cloud, staging, prod).

**Dev local sin `RESEND_API_KEY`:** el mailer cae a `FakeMailer` — loguea el URL a stdout + guarda el payload en memoria. Esto es intencional (dev sin cuenta Resend), no silenciar.

Plan completo y ADR: `docs/plans/2026-04-20-members-email-resend.md`, `docs/decisions/2026-04-20-mailer-resend-primary.md`.

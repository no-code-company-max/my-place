import type {
  BlockNoticeEmailInput,
  ExpelNoticeEmailInput,
  UnblockNoticeEmailInput,
} from '../types'

/**
 * Templates de notificación de moderación: block, unblock, expel.
 * Plan G.4 — PermissionGroups.
 *
 * Diseño: mismo wrapper visual que `invitation.tsx` (inline styles, sin
 * `@react-email/components`). Copy sobrio, sin urgencia, sin CTAs.
 * El miembro afectado recibe la notificación + email de contacto del
 * actor. No hay link de retorno al place — el bloqueado no tiene a dónde
 * ir, y el expulsado no puede entrar sin nueva invitación.
 *
 * Anti-phishing: el `contactEmail` es el del actor (autocompletado en el
 * form, pero editable). Se renderea como `mailto:` para reducir fricción.
 */

const wrapper: React.CSSProperties = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  backgroundColor: '#f7f5f2',
  padding: '40px 20px',
  color: '#1a1a1a',
}

const card: React.CSSProperties = {
  maxWidth: '540px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  padding: '32px',
  borderRadius: '8px',
  border: '1px solid #e7e4de',
}

const heading: React.CSSProperties = {
  fontFamily: "'Playfair Display', Georgia, serif",
  fontStyle: 'italic',
  fontSize: '22px',
  fontWeight: 400,
  margin: '0 0 20px',
  color: '#1a1a1a',
}

const paragraph: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: 1.6,
  margin: '0 0 16px',
}

const reasonBlock: React.CSSProperties = {
  backgroundColor: '#f7f5f2',
  borderLeft: '3px solid #999999',
  padding: '12px 16px',
  margin: '8px 0 20px',
  fontSize: '14px',
  lineHeight: 1.5,
  color: '#333333',
  whiteSpace: 'pre-wrap',
}

const contactBlock: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: 1.5,
  margin: '0 0 24px',
  color: '#333333',
}

const link: React.CSSProperties = {
  color: '#1a1a1a',
  textDecoration: 'underline',
}

const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#999999',
  marginTop: '32px',
  borderTop: '1px solid #e7e4de',
  paddingTop: '16px',
}

// ---------------------------------------------------------------
// Block
// ---------------------------------------------------------------

export function BlockNoticeEmail({ placeName, reason, contactEmail }: BlockNoticeEmailInput) {
  return (
    <html lang="es">
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta charSet="utf-8" />
        <title>Has sido bloqueado de {placeName}</title>
      </head>
      <body style={wrapper}>
        <div style={card}>
          <h1 style={heading}>Has sido bloqueado de {placeName}</h1>
          <p style={paragraph}>
            Un administrador de <strong>{placeName}</strong> bloqueó tu acceso al place. Mientras el
            bloqueo esté activo, no vas a poder entrar.
          </p>
          <p style={paragraph}>Motivo:</p>
          <div style={reasonBlock}>{reason}</div>
          <p style={contactBlock}>
            Si querés discutirlo, escribí a{' '}
            <a href={`mailto:${contactEmail}`} style={link}>
              {contactEmail}
            </a>
            .
          </p>
          <p style={footer}>Place · {placeName}</p>
        </div>
      </body>
    </html>
  )
}

export function renderBlockNoticePlaintext(input: BlockNoticeEmailInput): string {
  return [
    `Has sido bloqueado de ${input.placeName}`,
    ``,
    `Un administrador de ${input.placeName} bloqueó tu acceso al place.`,
    `Mientras el bloqueo esté activo, no vas a poder entrar.`,
    ``,
    `Motivo:`,
    input.reason,
    ``,
    `Si querés discutirlo, escribí a ${input.contactEmail}.`,
    ``,
    `—`,
    `Place · ${input.placeName}`,
  ].join('\n')
}

export function renderBlockNoticeSubject(input: BlockNoticeEmailInput): string {
  return `Has sido bloqueado de ${input.placeName}`
}

// ---------------------------------------------------------------
// Unblock
// ---------------------------------------------------------------

export function UnblockNoticeEmail({ placeName, message, contactEmail }: UnblockNoticeEmailInput) {
  return (
    <html lang="es">
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta charSet="utf-8" />
        <title>Tu acceso fue restaurado en {placeName}</title>
      </head>
      <body style={wrapper}>
        <div style={card}>
          <h1 style={heading}>Tu acceso fue restaurado en {placeName}</h1>
          <p style={paragraph}>
            Un administrador de <strong>{placeName}</strong> restauró tu acceso. Ya podés volver a
            entrar al place cuando quieras.
          </p>
          {message ? <div style={reasonBlock}>{message}</div> : null}
          <p style={contactBlock}>
            Si tenés dudas, escribí a{' '}
            <a href={`mailto:${contactEmail}`} style={link}>
              {contactEmail}
            </a>
            .
          </p>
          <p style={footer}>Place · {placeName}</p>
        </div>
      </body>
    </html>
  )
}

export function renderUnblockNoticePlaintext(input: UnblockNoticeEmailInput): string {
  const lines = [
    `Tu acceso fue restaurado en ${input.placeName}`,
    ``,
    `Un administrador de ${input.placeName} restauró tu acceso. Ya podés`,
    `volver a entrar al place cuando quieras.`,
    ``,
  ]
  if (input.message) {
    lines.push(input.message, ``)
  }
  lines.push(
    `Si tenés dudas, escribí a ${input.contactEmail}.`,
    ``,
    `—`,
    `Place · ${input.placeName}`,
  )
  return lines.join('\n')
}

export function renderUnblockNoticeSubject(input: UnblockNoticeEmailInput): string {
  return `Tu acceso fue restaurado en ${input.placeName}`
}

// ---------------------------------------------------------------
// Expel
// ---------------------------------------------------------------

export function ExpelNoticeEmail({ placeName, reason, contactEmail }: ExpelNoticeEmailInput) {
  return (
    <html lang="es">
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta charSet="utf-8" />
        <title>Has sido expulsado de {placeName}</title>
      </head>
      <body style={wrapper}>
        <div style={card}>
          <h1 style={heading}>Has sido expulsado de {placeName}</h1>
          <p style={paragraph}>
            El owner de <strong>{placeName}</strong> decidió expulsarte del place. Ya no sos
            miembro.
          </p>
          <p style={paragraph}>Motivo:</p>
          <div style={reasonBlock}>{reason}</div>
          <p style={paragraph}>Si querés volver al place, deberás recibir una nueva invitación.</p>
          <p style={contactBlock}>
            Para contactar, escribí a{' '}
            <a href={`mailto:${contactEmail}`} style={link}>
              {contactEmail}
            </a>
            .
          </p>
          <p style={footer}>Place · {placeName}</p>
        </div>
      </body>
    </html>
  )
}

export function renderExpelNoticePlaintext(input: ExpelNoticeEmailInput): string {
  return [
    `Has sido expulsado de ${input.placeName}`,
    ``,
    `El owner de ${input.placeName} decidió expulsarte del place. Ya no`,
    `sos miembro.`,
    ``,
    `Motivo:`,
    input.reason,
    ``,
    `Si querés volver al place, deberás recibir una nueva invitación.`,
    ``,
    `Para contactar, escribí a ${input.contactEmail}.`,
    ``,
    `—`,
    `Place · ${input.placeName}`,
  ].join('\n')
}

export function renderExpelNoticeSubject(input: ExpelNoticeEmailInput): string {
  return `Has sido expulsado de ${input.placeName}`
}

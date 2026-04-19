import pino from 'pino'

/**
 * Logger estructurado.
 * Pretty en dev, JSON en prod. Redacta keys sensibles por default.
 */
const isDev = process.env.NODE_ENV !== 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.secret',
      '*.service_role_key',
      '*.serviceRoleKey',
      '*.stripeSecretKey',
      '*.stripeWebhookSecret',
    ],
    censor: '[REDACTED]',
  },
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss.l' },
        },
      }
    : {}),
})

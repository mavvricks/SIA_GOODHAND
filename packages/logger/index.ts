import pino from 'pino';

export const REDACTION_PATHS = [
  'password',
  '*.password',
  'password_hash',
  '*.password_hash',
  'token',
  '*.token',
  'secret',
  '*.secret',
  'email',
  '*.email',
  'phone',
  '*.phone',
  'customer_phone',
  '*.customer_phone',
  'customer_email',
  '*.customer_email',
  'contact_phone',
  '*.contact_phone',
  'contact_email',
  '*.contact_email',
  'address',
  '*.address',
  'installation_address',
  '*.installation_address',
  'notes',
  '*.notes',
  'comment',
  '*.comment',
  'technician_comment',
  '*.technician_comment',
  'store_comment',
  '*.store_comment',
  'special_instructions',
  '*.special_instructions',
  'specialInstructions',
  '*.specialInstructions',
  'authorization',
  '*.authorization',
  'headers.authorization',
  'headers["authorization"]',
  'headers["x-signature"]',
  'x-signature',
  '*.x-signature'
];

export function createLogger(name: string, destination?: pino.DestinationStream) {
  const isDev = process.env.NODE_ENV !== 'production';
  return pino(
    {
      name,
      level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
      redact: {
        paths: REDACTION_PATHS,
        censor: '[REDACTED]'
      },
      formatters: {
        level: (label) => ({ level: label })
      },
      base: {
        env: process.env.NODE_ENV || 'development'
      },
      timestamp: pino.stdTimeFunctions.isoTime
    },
    destination
  );
}

export const logger = createLogger('prototype');
export default logger;

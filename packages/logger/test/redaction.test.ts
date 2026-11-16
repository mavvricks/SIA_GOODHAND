import { describe, it, expect } from 'vitest';
import { createLogger } from '../index.js';
import { Writable } from 'node:stream';

describe('Logger Redaction (CL-14 & Sec 5.2)', () => {
  it('redacts sensitive fields from logged objects', async () => {
    let output = '';
    const stream = new Writable({
      write(chunk, encoding, callback) {
        output += chunk.toString();
        callback();
      }
    });

    const testLogger = createLogger('test-logger', stream);

    testLogger.info({
      correlationId: '2b0f4c9e-0000-4000-8000-000000000000',
      email: 'customer@example.com',
      password: 'superSecretPassword123!',
      phone: '+639171234567',
      address: {
        line1: '123 Rizal Ave',
        city: 'Manila'
      },
      notes: 'Customer gate code is 1234',
      comment: 'Technician arrived late',
      specialInstructions: 'Watch out for the dog',
      headers: {
        authorization: 'Bearer eyJhbGciOiJIUzI1Ni...',
        'x-signature': 'sha256=abcdef123456...'
      },
      safeField: 'visible_data'
    }, 'Audit action performed');

    const parsed = JSON.parse(output.trim());

    expect(parsed.safeField).toBe('visible_data');
    expect(parsed.correlationId).toBe('2b0f4c9e-0000-4000-8000-000000000000');

    // Sensitive fields MUST be redacted
    expect(parsed.email).toBe('[REDACTED]');
    expect(parsed.password).toBe('[REDACTED]');
    expect(parsed.phone).toBe('[REDACTED]');
    expect(parsed.address).toBe('[REDACTED]');
    expect(parsed.notes).toBe('[REDACTED]');
    expect(parsed.comment).toBe('[REDACTED]');
    expect(parsed.specialInstructions).toBe('[REDACTED]');
    expect(parsed.headers.authorization).toBe('[REDACTED]');
    expect(parsed.headers['x-signature']).toBe('[REDACTED]');
  });
});

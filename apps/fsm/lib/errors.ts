import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import type { ErrorCategory, StandardErrorPayload } from '@prototype/contract';

export const CategoryToStatus: Record<ErrorCategory, number> = {
  VALIDATION_FAILED: 422,
  AUTHENTICATION_REQUIRED: 401,
  FORBIDDEN_SCOPE: 403,
  NOT_FOUND: 404,
  DUPLICATE_RECORD: 409,
  IDEMPOTENCY_KEY_CONFLICT: 409,
  SCHEDULE_CONFLICT: 409,
  INSUFFICIENT_STOCK: 409,
  BUSINESS_RULE_VIOLATED: 409,
  UNEXPECTED_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  RATE_LIMITED: 429
};

export function createErrorResponse(
  category: ErrorCategory,
  message: string,
  correlationId?: string,
  field?: string,
  statusOverride?: number
): NextResponse<StandardErrorPayload> {
  const status = statusOverride || CategoryToStatus[category] || 500;
  const refId = `ERR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const corrId = correlationId || crypto.randomUUID();

  return NextResponse.json(
    {
      error: {
        category,
        message,
        ...(field ? { field } : {}),
        referenceId: refId,
        correlationId: corrId
      }
    },
    { status }
  );
}

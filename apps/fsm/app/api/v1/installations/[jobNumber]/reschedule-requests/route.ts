import { NextResponse, type NextRequest } from 'next/server';
import { verifyServiceToken } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { jobsStore } from '@/lib/services/jobs-store';
import { RescheduleRequestSchema } from '@prototype/contract';
import { logger } from '@prototype/logger';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobNumber: string }> }
) {
  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
  const authHeader = req.headers.get('authorization');
  const idempotencyKey = req.headers.get('idempotency-key');
  const { jobNumber } = await params;

  // 1. Verify Scope
  const authResult = await verifyServiceToken(authHeader, 'installations:update');
  if (!authResult.valid) {
    return createErrorResponse(
      authResult.errorCategory || 'AUTHENTICATION_REQUIRED',
      'Valid installations:update Bearer token required',
      correlationId
    );
  }

  // 2. Validate Idempotency-Key
  if (!idempotencyKey) {
    return createErrorResponse(
      'VALIDATION_FAILED',
      'Idempotency-Key header is required',
      correlationId,
      'Idempotency-Key'
    );
  }

  try {
    const rawBody = await req.json();
    const parsed = RescheduleRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return createErrorResponse(
        'VALIDATION_FAILED',
        parsed.error.issues[0]?.message || 'Validation failed',
        correlationId,
        parsed.error.issues[0]?.path.join('.')
      );
    }

    const { requestedStart, requestedEnd, reason } = parsed.data;
    const job = await jobsStore.requestReschedule(
      jobNumber,
      requestedStart,
      requestedEnd,
      reason,
      correlationId
    );

    logger.info({ correlationId, jobNumber, status: job.status }, 'OP-03 reschedule request accepted');

    return NextResponse.json(
      { success: true, message: 'Reschedule request accepted for dispatcher review' },
      { status: 202 }
    );
  } catch (err: any) {
    return createErrorResponse(
      err.category || 'UNEXPECTED_ERROR',
      err.message || 'Failed to process reschedule request',
      correlationId
    );
  }
}

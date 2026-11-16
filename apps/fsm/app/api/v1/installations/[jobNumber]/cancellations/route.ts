import { NextResponse, type NextRequest } from 'next/server';
import { verifyServiceToken } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { jobsStore } from '@/lib/services/jobs-store';
import { CancelInstallationRequestSchema } from '@prototype/contract';
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
    const parsed = CancelInstallationRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return createErrorResponse(
        'VALIDATION_FAILED',
        parsed.error.issues[0]?.message || 'Validation failed',
        correlationId,
        parsed.error.issues[0]?.path.join('.')
      );
    }

    const { reason, cancelledBy } = parsed.data;
    const job = await jobsStore.cancelJob(
      jobNumber,
      reason,
      cancelledBy,
      correlationId
    );

    logger.info({ correlationId, jobNumber, status: job.status }, 'OP-04 cancellation accepted');

    return NextResponse.json(
      { success: true, message: 'Installation job successfully cancelled' },
      { status: 200 }
    );
  } catch (err: any) {
    return createErrorResponse(
      err.category || 'UNEXPECTED_ERROR',
      err.message || 'Failed to process cancellation',
      correlationId
    );
  }
}

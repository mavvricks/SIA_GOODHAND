import { NextResponse, type NextRequest } from 'next/server';
import { verifyServiceToken } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { jobsStore } from '@/lib/services/jobs-store';
import { simulationService } from '@/lib/simulation/simulation-service';
import { logger } from '@prototype/logger';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobNumber: string }> }
) {
  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
  const idempotencyKey = req.headers.get('idempotency-key');
  const authHeader = req.headers.get('authorization');
  const { jobNumber } = await params;

  // 1. Simulation Outage Check (Section 8.1)
  if (simulationService.getFlag('partner_outage_simulated')) {
    return createErrorResponse(
      'SERVICE_UNAVAILABLE',
      'System B is currently unavailable (simulated outage)',
      correlationId
    );
  }

  // 2. Auth & Scope Verification (CL-09, feedback:write scope)
  const authResult = await verifyServiceToken(authHeader, 'feedback:write');
  if (!authResult.valid) {
    return createErrorResponse(
      authResult.errorCategory || 'AUTHENTICATION_REQUIRED',
      'Valid feedback:write Bearer token required',
      correlationId
    );
  }

  // 3. Idempotency Key presence check
  if (!idempotencyKey) {
    return createErrorResponse(
      'VALIDATION_FAILED',
      'Idempotency-Key header is required',
      correlationId,
      'headers.Idempotency-Key'
    );
  }

  // 4. Parse request body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return createErrorResponse(
      'VALIDATION_FAILED',
      'Invalid JSON body',
      correlationId
    );
  }

  // 5. Save technician feedback
  try {
    const result = await jobsStore.saveTechnicianFeedback(
      jobNumber,
      body,
      idempotencyKey,
      correlationId
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch (err: any) {
    logger.warn({ correlationId, jobNumber, error: err.message }, 'Technician feedback save error');
    return createErrorResponse(
      err.category || 'UNEXPECTED_ERROR',
      err.message,
      correlationId,
      err.field,
      err.statusCode
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ jobNumber: string }> }
) {
  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
  const idempotencyKey = req.headers.get('idempotency-key');
  const authHeader = req.headers.get('authorization');
  const { jobNumber } = await params;

  // 1. Simulation Outage Check
  if (simulationService.getFlag('partner_outage_simulated')) {
    return createErrorResponse(
      'SERVICE_UNAVAILABLE',
      'System B is currently unavailable (simulated outage)',
      correlationId
    );
  }

  // 2. Auth & Scope Verification
  const authResult = await verifyServiceToken(authHeader, 'feedback:write');
  if (!authResult.valid) {
    return createErrorResponse(
      authResult.errorCategory || 'AUTHENTICATION_REQUIRED',
      'Valid feedback:write Bearer token required',
      correlationId
    );
  }

  // 3. Idempotency Key presence check
  if (!idempotencyKey) {
    return createErrorResponse(
      'VALIDATION_FAILED',
      'Idempotency-Key header is required',
      correlationId,
      'headers.Idempotency-Key'
    );
  }

  // 4. Parse body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return createErrorResponse(
      'VALIDATION_FAILED',
      'Invalid JSON body',
      correlationId
    );
  }

  // 5. Update technician feedback
  try {
    const result = await jobsStore.updateTechnicianFeedback(
      jobNumber,
      body,
      idempotencyKey,
      correlationId
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch (err: any) {
    logger.warn({ correlationId, jobNumber, error: err.message }, 'Technician feedback update error');
    return createErrorResponse(
      err.category || 'UNEXPECTED_ERROR',
      err.message,
      correlationId,
      err.field,
      err.statusCode
    );
  }
}

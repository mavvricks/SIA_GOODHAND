import { databaseRoute } from "../../../../../../packages/database/postgres.mjs";
import { NextResponse, type NextRequest } from 'next/server';
import { verifyServiceToken } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { jobsStore } from '@/lib/services/jobs-store';
import { logger } from '@prototype/logger';
import { simulationService } from '@/lib/simulation/simulation-service';

async function handlePOST(req: NextRequest) {
  if (simulationService.getFlag('partner_outage_simulated')) return createErrorResponse('SERVICE_UNAVAILABLE', 'System B outage simulation is active');
  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
  const idempotencyKey = req.headers.get('idempotency-key');
  const authHeader = req.headers.get('authorization');

  // 1. Verify Scope & Service Auth (CL-09, TC-10)
  const authResult = await verifyServiceToken(authHeader, 'installations:create');
  if (!authResult.valid) {
    logger.warn({ correlationId, category: authResult.errorCategory }, 'Service authentication failure on OP-01');
    return createErrorResponse(
      authResult.errorCategory || 'AUTHENTICATION_REQUIRED',
      authResult.errorCategory === 'FORBIDDEN_SCOPE' ? 'Missing installations:create scope' : 'Valid Bearer token required',
      correlationId
    );
  }

  // 2. Validate Idempotency Header
  if (!idempotencyKey) {
    return createErrorResponse(
      'VALIDATION_FAILED',
      'Idempotency-Key header is required',
      correlationId,
      'Idempotency-Key'
    );
  }

  try {
    const payload = await req.json();

    // 3. Invoke Jobs Store with Idempotency & Schema Validation (TC-01, TC-03, TC-05, TC-07, TC-08)
    const result = await jobsStore.createInstallationJob(payload, idempotencyKey, correlationId);

    logger.info(
      {
        correlationId,
        jobNumber: result.body.jobNumber,
        orderNumber: result.body.orderNumber,
        status: result.status
      },
      'OP-01 processed successfully'
    );

    return NextResponse.json(result.body, { status: result.status });
  } catch (err: any) {
    logger.error(
      {
        correlationId,
        category: err.category,
        message: err.message,
        field: err.field
      },
      'Error processing OP-01'
    );

    return createErrorResponse(
      err.category || 'VALIDATION_FAILED',
      err.message || 'Failed to create installation job',
      correlationId,
      err.field
    );
  }
}

export const POST = databaseRoute("fsm", handlePOST, { readOnly: false });

async function handleGET(req: NextRequest) {
  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
  const auth = await verifyServiceToken(req.headers.get('authorization'), 'installations:read');
  if (!auth.valid) return createErrorResponse(auth.errorCategory || 'AUTHENTICATION_REQUIRED', 'Valid installations:read Bearer token required', correlationId);
  const orderNumber = new URL(req.url).searchParams.get('orderNumber');
  if (!orderNumber || !/^GH-\d{8}-\d{6}$/.test(orderNumber)) return createErrorResponse('VALIDATION_FAILED', 'Valid orderNumber is required', correlationId);
  const job = jobsStore.listJobs().find(item => item.orderNumber === orderNumber);
  if (!job) return createErrorResponse('NOT_FOUND', 'Installation job not found', correlationId);
  return NextResponse.json({ jobNumber: job.jobNumber, orderNumber, status: job.status, technicianName: job.technicianName, scheduledStart: job.scheduledStart, scheduledEnd: job.scheduledEnd, items: job.items.map(item => ({ sku: item.sku, quantity: item.quantity })), createdAt: job.createdAt });
}
export const GET = databaseRoute('fsm', handleGET, { readOnly: true });

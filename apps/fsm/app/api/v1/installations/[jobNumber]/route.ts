import { NextResponse, type NextRequest } from 'next/server';
import { verifyServiceToken } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { jobsStore } from '@/lib/services/jobs-store';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobNumber: string }> }
) {
  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
  const authHeader = req.headers.get('authorization');
  const { jobNumber } = await params;

  // 1. Verify Scope
  const authResult = await verifyServiceToken(authHeader, 'installations:read');
  if (!authResult.valid) {
    return createErrorResponse(
      authResult.errorCategory || 'AUTHENTICATION_REQUIRED',
      'Valid installations:read Bearer token required',
      correlationId
    );
  }

  // 2. Fetch Job
  const job = jobsStore.getJob(jobNumber);
  if (!job) {
    return createErrorResponse('NOT_FOUND', `Job ${jobNumber} not found`, correlationId);
  }

  return NextResponse.json({
    jobNumber: job.jobNumber,
    orderNumber: job.orderNumber,
    status: job.status,
    technicianName: job.technicianName,
    scheduledStart: job.scheduledStart,
    scheduledEnd: job.scheduledEnd,
    items: job.items.map(i => ({ sku: i.sku, quantity: i.quantity })),
    createdAt: job.createdAt
  });
}

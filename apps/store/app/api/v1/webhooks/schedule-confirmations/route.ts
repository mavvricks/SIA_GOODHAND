import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { ordersService } from '@/lib/services/orders-service';
import { ScheduleConfirmationWebhookRequestSchema } from '@prototype/contract';
import { logger } from '@prototype/logger';

export async function POST(req: NextRequest) {
  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
  const signatureHeader = req.headers.get('x-signature');
  const timestampHeader = req.headers.get('x-timestamp');

  // 1. Timestamp Skew Validation (CL-10, TC-12) - 5 minutes max skew
  if (!timestampHeader) {
    return NextResponse.json({ error: { category: 'AUTHENTICATION_REQUIRED', message: 'Missing X-Timestamp header' } }, { status: 401 });
  }

  const timestampMs = new Date(timestampHeader).getTime();
  const nowMs = Date.now();
  if (Math.abs(nowMs - timestampMs) > 5 * 60 * 1000) {
    return NextResponse.json({ error: { category: 'AUTHENTICATION_REQUIRED', message: 'X-Timestamp exceeds 5 minute skew' } }, { status: 401 });
  }

  // 2. Read body raw text for HMAC verification
  const rawBody = await req.text();
  const signingSecret = process.env.STORE_WEBHOOK_SIGNING_SECRET || 'change_me_webhook_signing_secret_at_least_32_characters';

  // Compute expected HMAC: sha256=HMAC(timestamp + "." + body)
  const expectedSig = 'sha256=' + crypto
    .createHmac('sha256', signingSecret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest('hex');

  // If in production or test where signature is provided, verify
  if (signatureHeader && signatureHeader !== expectedSig) {
    logger.warn({ correlationId }, 'Invalid HMAC signature on OP-05 webhook');
    return NextResponse.json({ error: { category: 'AUTHENTICATION_REQUIRED', message: 'Invalid webhook HMAC signature' } }, { status: 401 });
  }

  // 3. Schema validation
  try {
    const payload = JSON.parse(rawBody);
    const parsed = ScheduleConfirmationWebhookRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: { category: 'VALIDATION_FAILED', message: parsed.error.issues[0]?.message } }, { status: 422 });
    }

    const { orderNumber, technicianName, scheduledStart, scheduledEnd, status } = parsed.data;

    // 4. Update order state
    ordersService.updateInstallationSchedule(
      orderNumber,
      technicianName,
      scheduledStart,
      scheduledEnd,
      status
    );

    logger.info({ correlationId, orderNumber, technicianName, status }, 'OP-05 schedule confirmation recorded on order');

    return NextResponse.json({ success: true, message: 'Schedule confirmation processed' });
  } catch (err: any) {
    return NextResponse.json({ error: { category: 'UNEXPECTED_ERROR', message: err.message } }, { status: 500 });
  }
}

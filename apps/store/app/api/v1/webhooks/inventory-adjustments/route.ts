import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { ordersService } from '@/lib/services/orders-service';
import { InventoryAdjustmentWebhookRequestSchema } from '@prototype/contract';
import { logger } from '@prototype/logger';

export async function POST(req: NextRequest) {
  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
  const timestampHeader = req.headers.get('x-timestamp');
  const signatureHeader = req.headers.get('x-signature');

  // 1. Timestamp validation (CL-10)
  if (!timestampHeader) {
    return NextResponse.json({ error: { category: 'AUTHENTICATION_REQUIRED', message: 'Missing X-Timestamp header' } }, { status: 401 });
  }

  const timestampMs = new Date(timestampHeader).getTime();
  if (Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    return NextResponse.json({ error: { category: 'AUTHENTICATION_REQUIRED', message: 'X-Timestamp skew exceeds 5 minutes' } }, { status: 401 });
  }

  // 2. Signature verification
  const rawBody = await req.text();
  const signingSecret = process.env.STORE_WEBHOOK_SIGNING_SECRET || 'change_me_webhook_signing_secret_at_least_32_characters';

  const expectedSig = 'sha256=' + crypto
    .createHmac('sha256', signingSecret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest('hex');

  if (signatureHeader && signatureHeader !== expectedSig) {
    return NextResponse.json({ error: { category: 'AUTHENTICATION_REQUIRED', message: 'Invalid webhook HMAC signature' } }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    const parsed = InventoryAdjustmentWebhookRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: { category: 'VALIDATION_FAILED', message: parsed.error.issues[0]?.message } }, { status: 422 });
    }

    const movement = ordersService.processInventoryAdjustment(parsed.data, correlationId);

    logger.info({ correlationId, transactionId: parsed.data.transactionId, sku: parsed.data.sku }, 'OP-08 inventory adjustment recorded');

    return NextResponse.json({
      success: true,
      transactionId: movement.transactionId,
      sku: movement.sku,
      onHandDelta: movement.onHandDelta,
      reservedDelta: movement.reservedDelta
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: {
          category: err.category || 'INSUFFICIENT_STOCK',
          message: err.message || 'Inventory adjustment rejected'
        }
      },
      { status: err.category === 'INSUFFICIENT_STOCK' ? 409 : 500 }
    );
  }
}

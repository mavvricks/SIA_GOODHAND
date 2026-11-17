import { databaseRoute } from "../../../../../../../packages/database/postgres.mjs";
import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { ordersService } from "@/lib/services/orders-service";
import { StatusChangeWebhookRequestSchema } from "@prototype/contract";
import { logger } from "@prototype/logger";

async function handlePOST(req: NextRequest) {
  const correlationId =
    req.headers.get("x-correlation-id") || crypto.randomUUID();
  const timestampHeader = req.headers.get("x-timestamp");
  const signatureHeader = req.headers.get("x-signature");

  // 1. Timestamp Skew Check (CL-10)
  if (!timestampHeader) {
    return NextResponse.json(
      {
        error: {
          category: "AUTHENTICATION_REQUIRED",
          message: "Missing X-Timestamp",
        },
      },
      { status: 401 },
    );
  }

  const timestampMs = new Date(timestampHeader).getTime();
  if (
    !Number.isFinite(timestampMs) ||
    Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000
  ) {
    return NextResponse.json(
      {
        error: {
          category: "AUTHENTICATION_REQUIRED",
          message: "Timestamp skew exceeds 5 minutes",
        },
      },
      { status: 401 },
    );
  }

  // 2. Read body raw text
  const rawBody = await req.text();
  const signingSecret =
    process.env.STORE_WEBHOOK_SIGNING_SECRET ||
    "change_me_webhook_signing_secret_at_least_32_characters";

  const expectedSig =
    "sha256=" +
    crypto
      .createHmac("sha256", signingSecret)
      .update(`${timestampHeader}.${rawBody}`)
      .digest("hex");

  if (
    !signatureHeader ||
    signatureHeader.length !== expectedSig.length ||
    !crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expectedSig),
    )
  ) {
    return NextResponse.json(
      {
        error: {
          category: "AUTHENTICATION_REQUIRED",
          message: "Invalid HMAC signature",
        },
      },
      { status: 401 },
    );
  }

  try {
    const payload = JSON.parse(rawBody);
    const parsed = StatusChangeWebhookRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            category: "VALIDATION_FAILED",
            message: parsed.error.issues[0]?.message,
          },
        },
        { status: 422 },
      );
    }

    ordersService.updateStatusChange(
      parsed.data.orderNumber,
      parsed.data.status,
      parsed.data.timestamp,
    );

    logger.info(
      {
        correlationId,
        orderNumber: parsed.data.orderNumber,
        status: parsed.data.status,
      },
      "OP-06 status change processed",
    );

    return NextResponse.json({
      success: true,
      message: "Status change processed",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { category: "UNEXPECTED_ERROR", message: err.message } },
      { status: 500 },
    );
  }
}

export const POST = databaseRoute("store", handlePOST, { readOnly: false });

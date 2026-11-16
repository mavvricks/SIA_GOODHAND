import { getSessionUser } from "@/lib/auth";
import { persistService } from "../../../../../packages/local-db/index.mjs";
import { after, NextResponse, type NextRequest } from "next/server";
import { ordersService } from "@/lib/services/orders-service";
import {
  drainStoreOutbox,
  startLocalOutboxWorker,
} from "@/lib/outbox/dispatch";

export async function POST(req: NextRequest) {
  const correlationId =
    req.headers.get("x-correlation-id") || crypto.randomUUID();
  const idempotencyKey =
    req.headers.get("idempotency-key") || crypto.randomUUID();
  try {
    const user = await getSessionUser(req);
    if (!user)
      return NextResponse.json(
        {
          error: {
            message:
              "Sign in before checkout so you can securely track your order.",
          },
        },
        { status: 401 },
      );
    const body = await req.json();
    body.customerEmail = user.email;
    const { order, outboxId } = await ordersService.processCheckout(
      body,
      `${user.userId}:${idempotencyKey}`,
      correlationId,
      body.simulatePaymentFailure || false,
    );
    order.ownerId = user.userId;
    persistService(ordersService);
    if (order.includeInstallation && outboxId)
      after(async () => {
        startLocalOutboxWorker();
        await drainStoreOutbox();
      });
    return NextResponse.json(
      {
        orderNumber: order.orderNumber,
        status: order.status,
        totalPhp: order.totalPhp,
        includeInstallation: order.includeInstallation,
        include_installation: order.includeInstallation,
        installationStatus: order.installationStatus,
      },
      { status: 201 },
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        error: {
          category: err.category || "VALIDATION_FAILED",
          message: err.message || "Checkout failed",
          correlationId,
        },
      },
      { status: err.category === "INSUFFICIENT_STOCK" ? 409 : 422 },
    );
  }
}

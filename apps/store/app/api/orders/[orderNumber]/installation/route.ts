import { withDatabase } from "../../../../../../../packages/database/postgres.mjs";
import { NextResponse, type NextRequest } from "next/server";
import { RescheduleRequestSchema } from "@prototype/contract";
import { getSessionUser, createStoreToFsmServiceToken } from "@/lib/auth";
import { ordersService } from "@/lib/services/orders-service";
import { canViewOrder } from "@/lib/order-access";

const canChange = (status?: string) =>
  Boolean(
    status &&
    !["Completed", "Cancelled", "In Progress", "Reschedule Required"].includes(
      status,
    ),
  );

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const user = await getSessionUser(req);
  if (!user)
    return NextResponse.json(
      {
        error: {
          category: "AUTHENTICATION_REQUIRED",
          message: "Sign in to manage your installation.",
        },
      },
      { status: 401 },
    );
  const { orderNumber } = await params;
  const key = req.headers.get("idempotency-key");
  if (!key || key.length > 256)
    return NextResponse.json(
      {
        error: {
          category: "VALIDATION_FAILED",
          message: "Idempotency-Key is required.",
        },
      },
      { status: 422 },
    );
  const input = await req.json().catch(() => null);
  const action = input?.action;
  if (action !== "reschedule" && action !== "cancel")
    return NextResponse.json(
      {
        error: {
          category: "VALIDATION_FAILED",
          message: "Choose reschedule or cancel.",
        },
      },
      { status: 422 },
    );
  const reason = input.reason;
  if (
    typeof reason !== "string" ||
    reason.trim().length < 3 ||
    reason.length > 500
  )
    return NextResponse.json(
      {
        error: {
          category: "VALIDATION_FAILED",
          message: "Give a reason of 3–500 characters.",
        },
      },
      { status: 422 },
    );
  let body: Record<string, string>;
  if (action === "reschedule") {
    const parsed = RescheduleRequestSchema.safeParse({
      requestedStart: input.requestedStart,
      requestedEnd: input.requestedEnd,
      reason: reason.trim(),
    });
    if (
      !parsed.success ||
      Date.parse(input.requestedEnd) <= Date.parse(input.requestedStart)
    )
      return NextResponse.json(
        {
          error: {
            category: "VALIDATION_FAILED",
            message: "Choose a valid new installation window.",
          },
        },
        { status: 422 },
      );
    body = parsed.data;
  } else
    body = {
      reason: reason.trim(),
      cancelledBy: user.role === "store_admin" ? "store_admin" : "customer",
    };
  const order = await withDatabase(
    "store",
    () => {
      const found = ordersService.getOrder(orderNumber);
      return found && canViewOrder(user, found) ? structuredClone(found) : null;
    },
    { readOnly: true },
  );
  if (!order)
    return NextResponse.json(
      { error: { category: "NOT_FOUND", message: "Order not found." } },
      { status: 404 },
    );
  if (order.customerRequestKeys?.includes(key))
    return NextResponse.json({
      success: true,
      status: order.installationStatus,
    });
  if (!order.includeInstallation || !canChange(order.installationStatus))
    return NextResponse.json(
      {
        error: {
          category: "BUSINESS_RULE_VIOLATED",
          message: "This installation cannot be changed in its current state.",
        },
      },
      { status: 409 },
    );
  if (action === "reschedule" && (order.rescheduleCount || 0) >= 2)
    return NextResponse.json(
      {
        error: {
          category: "BUSINESS_RULE_VIOLATED",
          message: "Two reschedule requests have already been used.",
        },
      },
      { status: 409 },
    );
  if (
    action === "cancel" &&
    order.scheduledStart &&
    Date.parse(order.scheduledStart) - Date.now() < 24 * 3600000
  )
    return NextResponse.json(
      {
        error: {
          category: "BUSINESS_RULE_VIOLATED",
          message:
            "Cancellation requires at least 24 hours before the appointment.",
        },
      },
      { status: 409 },
    );
  const base = (
    process.env.STORE_FSM_BASE_URL || "http://localhost:3100/api/v1"
  ).replace(/\/$/, "");
  try {
    const token = await createStoreToFsmServiceToken([
      "installations:read",
      "installations:update",
    ]);
    const headers = {
      Authorization: `Bearer ${token}`,
      "X-Correlation-Id": crypto.randomUUID(),
    };
    const found = await fetch(
      `${base}/installations?orderNumber=${encodeURIComponent(orderNumber)}`,
      { headers, signal: AbortSignal.timeout(8000), cache: "no-store" },
    );
    if (found.status === 404)
      return NextResponse.json(
        {
          error: {
            category: "BUSINESS_RULE_VIOLATED",
            message:
              "Installation dispatch is still pending. Try again shortly.",
          },
        },
        { status: 409 },
      );
    if (!found.ok) throw new Error("Installation lookup failed");
    const job = await found.json();
    if (!canChange(job.status))
      return NextResponse.json(
        {
          error: {
            category: "BUSINESS_RULE_VIOLATED",
            message:
              "This installation cannot be changed in its current state.",
          },
        },
        { status: 409 },
      );
    const response = await fetch(
      `${base}/installations/${encodeURIComponent(job.jobNumber)}/${action === "reschedule" ? "reschedule-requests" : "cancellations"}`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "Idempotency-Key": `${user.userId}:${orderNumber}:${key}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: {
            category: failure.error?.category || "SERVICE_UNAVAILABLE",
            message:
              failure.error?.message || "Could not update the installation.",
          },
        },
        { status: response.status },
      );
    }
    await withDatabase("store", () => {
      const current = ordersService.getOrder(orderNumber);
      if (!current) return;
      if (!current.customerRequestKeys?.includes(key)) {
        current.customerRequestKeys = [
          ...(current.customerRequestKeys || []),
          key,
        ];
        if (action === "reschedule")
          current.rescheduleCount = (current.rescheduleCount || 0) + 1;
      }
      ordersService.updateStatusChange(
        orderNumber,
        action === "cancel" ? "Cancelled" : "Reschedule Required",
        new Date().toISOString(),
      );
    });
    return NextResponse.json(
      {
        success: true,
        status: action === "cancel" ? "Cancelled" : "Reschedule Required",
      },
      { status: response.status },
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          category: "SERVICE_UNAVAILABLE",
          message:
            "Field service is unavailable. Please retry with the same request.",
        },
      },
      { status: 503 },
    );
  }
}

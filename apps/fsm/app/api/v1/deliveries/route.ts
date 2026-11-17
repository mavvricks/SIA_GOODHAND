import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
const updateSchema = z
  .object({
    orderNumber: z.string().min(1).max(50),
    status: z.enum([
      "Order received",
      "Packing order",
      "Ready for dispatch",
      "On the way",
      "Delivered",
    ]),
    estimatedArrival: z.string().datetime({ offset: true }).optional(),
    note: z.string().trim().max(500),
    version: z.number().int().nonnegative(),
  })
  .strict();
async function proxy(req: NextRequest, update: boolean) {
  const user = await getSessionUser(req);
  if (!user || !["dispatcher", "admin"].includes(user.role))
    return NextResponse.json(
      { error: { message: "Dispatcher or admin access required." } },
      { status: 403 },
    );
  try {
    const body = JSON.stringify(
      update
        ? {
            ...updateSchema.parse(await req.json()),
            action: "update",
            actor: user.email,
          }
        : { action: "list" },
    );
    const timestamp = new Date().toISOString();
    const signature =
      "sha256=" +
      crypto
        .createHmac(
          "sha256",
          process.env.STORE_WEBHOOK_SIGNING_SECRET ||
            "change_me_webhook_signing_secret_at_least_32_characters",
        )
        .update(`${timestamp}.${body}`)
        .digest("hex");
    const base = (
      process.env.FSM_STORE_BASE_URL || "http://localhost:3000/api/v1"
    ).replace(/\/$/, "");
    const res = await fetch(base + "/operations/deliveries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Timestamp": timestamp,
        "X-Signature": signature,
        "X-Correlation-Id": crypto.randomUUID(),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    return NextResponse.json(await res.json(), {
      status: res.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: {
          message:
            e instanceof z.ZodError
              ? "Invalid delivery update."
              : "System A is unavailable. The update was not confirmed; refresh before retrying.",
        },
      },
      { status: e instanceof z.ZodError ? 422 : 503 },
    );
  }
}
export async function GET(req: NextRequest) {
  return proxy(req, false);
}
export async function PATCH(req: NextRequest) {
  return proxy(req, true);
}

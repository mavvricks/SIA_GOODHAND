import { databaseRoute } from "../../../../../../../packages/database/postgres.mjs";
import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { ordersService, deliveryStatuses } from "@/lib/services/orders-service";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }).strict(),
  z
    .object({
      action: z.literal("update"),
      orderNumber: z.string().max(50),
      actor: z.string().min(1).max(120),
      status: z.enum(deliveryStatuses),
      estimatedArrival: z.string().datetime({ offset: true }).optional(),
      note: z.string().trim().max(500),
      version: z.number().int().nonnegative(),
    })
    .strict(),
]);
async function handlePOST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' && !process.env.STORE_WEBHOOK_SIGNING_SECRET) return NextResponse.json({ error: { message: 'Delivery signing is not configured.' } }, { status: 503 });
  const raw = await req.text();
  const timestamp = req.headers.get("x-timestamp") || "";
  const signature = req.headers.get("x-signature") || "";
  const expected =
    "sha256=" +
    crypto
      .createHmac(
        "sha256",
        process.env.STORE_WEBHOOK_SIGNING_SECRET ||
          "change_me_webhook_signing_secret_at_least_32_characters",
      )
      .update(`${timestamp}.${raw}`)
      .digest("hex");
  if (
    !Number.isFinite(Date.parse(timestamp)) ||
    Math.abs(Date.now() - Date.parse(timestamp)) > 300000 ||
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return NextResponse.json(
      { error: { message: "Invalid service signature" } },
      { status: 401 },
    );
  try {
    const input = schema.parse(JSON.parse(raw));
    if (input.action === "list")
      return NextResponse.json(
        {
          orders: ordersService
            .listOrders()
            .map(
              ({ customerPhone, customerEmail, ownerId, ...order }) => order,
            ),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    const { action, orderNumber, actor, ...update } = input;
    const order = ordersService.updateDelivery(orderNumber, update, actor);
    return NextResponse.json({ success: true, version: order.deliveryVersion });
  } catch (e: any) {
    return NextResponse.json(
      { error: { message: e.message } },
      { status: e.category === "NOT_FOUND" ? 404 : e.category ? 409 : 422 },
    );
  }
}

export const POST = databaseRoute("store", handlePOST, { readOnly: false });

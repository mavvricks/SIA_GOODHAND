import { databaseRoute } from "../../../../../packages/database/postgres.mjs";
import { after, NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { outboxEngine } from "@/lib/outbox/outbox-engine";
import { drainStoreOutbox } from "@/lib/outbox/dispatch";

async function admin(req: NextRequest) {
  return (await getSessionUser(req))?.role === "store_admin";
}
async function handleGET(req: NextRequest) {
  if (!(await admin(req)))
    return NextResponse.json(
      { error: { message: "Store administrator access required." } },
      { status: 403 },
    );
  return NextResponse.json(
    {
      messages: outboxEngine
        .getOutboxRows()
        .map((row) => ({
          id: row.id,
          operationId: row.operationId,
          orderNumber: row.payload.orderNumber,
          status: row.status,
          attempts: row.attempts,
          nextAttemptAt: row.nextAttemptAt,
          createdAt: row.createdAt,
        })),
      failed: outboxEngine
        .getFailedRows()
        .map((row) => ({
          id: row.id,
          operationId: row.operationId,
          orderNumber: row.payload.orderNumber,
          finalError: row.finalError,
          createdAt: row.failedAt,
        })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
async function handlePOST(req: NextRequest) {
  if (!(await admin(req)))
    return NextResponse.json(
      { error: { message: "Store administrator access required." } },
      { status: 403 },
    );
  const input = await req.json().catch(() => ({}));
  if (typeof input.id !== "string")
    return NextResponse.json(
      { error: { message: "Message id required." } },
      { status: 422 },
    );
  const failed = outboxEngine
    .getFailedRows()
    .find((row) => row.id === input.id);
  if (!failed)
    return NextResponse.json(
      { error: { message: "Failed message not found." } },
      { status: 404 },
    );
  const replayed = await outboxEngine.replayFailedMessage(failed.id);
  after(drainStoreOutbox);
  return NextResponse.json({
    success: true,
    replayed: { id: replayed.id, status: replayed.status },
  });
}
export const GET = databaseRoute("store", handleGET, { readOnly: true });
export const POST = databaseRoute("store", handlePOST, { readOnly: false });

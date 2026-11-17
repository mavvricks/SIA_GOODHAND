import { databaseRoute } from "../../../../../../packages/database/postgres.mjs";
import { NextResponse } from "next/server";
import { outboxEngine, persistOutboxState } from "@/lib/outbox/outbox-engine";

async function handlePOST() {
  if (process.env.NODE_ENV === "production")
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const failedRows = outboxEngine.getFailedRows();
  if (failedRows.length === 0) {
    // If no failed queue, find most recent outbox message
    const outbox = outboxEngine.getOutboxRows();
    if (outbox.length === 0) {
      return NextResponse.json(
        { error: "No outbox messages to replay" },
        { status: 404 },
      );
    }
    const last = outbox[outbox.length - 1];
    last.status = "pending";
    last.attempts = 0;
    last.nextAttemptAt = new Date().toISOString();
    persistOutboxState();
    return NextResponse.json({ success: true, replayed: last });
  }

  const lastFailed = failedRows[failedRows.length - 1];
  try {
    const replayed = await outboxEngine.replayFailedMessage(lastFailed.id);
    return NextResponse.json({ success: true, replayed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const POST = databaseRoute("store", handlePOST, { readOnly: false });

import { databaseRoute } from "../../../../../../packages/database/postgres.mjs";
import { after, NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { jobsStore } from "@/lib/services/jobs-store";
import { flushFsmOutbox } from "@/lib/outbox";

async function handlePOST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !["admin", "dispatcher"].includes(user.role))
    return NextResponse.json(
      {
        error: {
          category: "FORBIDDEN_SCOPE",
          message: "Staff sign-in required.",
        },
      },
      { status: 403 },
    );
  const input = await req.json().catch(() => ({}));
  const failed = jobsStore
    .getOutboxMessages()
    .filter((message) => message.status === "failed");
  const row = input.id
    ? failed.find((message) => message.id === input.id)
    : failed.at(-1);
  if (!row)
    return NextResponse.json(
      {
        error: {
          category: "NOT_FOUND",
          message: "No failed message to replay.",
        },
      },
      { status: 404 },
    );
  row.status = "pending";
  row.attempts = 0;
  row.nextAttemptAt = new Date().toISOString();
  after(flushFsmOutbox);
  return NextResponse.json({
    success: true,
    replayed: { id: row.id, operationId: row.operationId, status: row.status },
  });
}
export const POST = databaseRoute("fsm", handlePOST, { readOnly: false });

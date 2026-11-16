import { NextResponse, type NextRequest } from "next/server";
import {
  drainStoreOutbox,
  startLocalOutboxWorker,
} from "@/lib/outbox/dispatch";
export async function POST(req: NextRequest) {
  const secret =
    process.env.CRON_SECRET_STORE ||
    "change_me_cron_secret_store_at_least_32_characters";
  if (
    req.headers.get("authorization") !== `Bearer ${secret}` &&
    process.env.DEMO_MODE !== "true"
  )
    return NextResponse.json(
      { error: "Unauthorized drain request" },
      { status: 401 },
    );
  startLocalOutboxWorker();
  return NextResponse.json(await drainStoreOutbox());
}

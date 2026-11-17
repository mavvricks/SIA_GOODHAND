import { NextResponse, type NextRequest } from "next/server";
import {
  drainStoreOutbox,
  startLocalOutboxWorker,
} from "@/lib/outbox/dispatch";
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' && !process.env.CRON_SECRET_STORE) return NextResponse.json({ error: 'Drain secret is not configured' }, { status: 503 });
  const secret =
    process.env.CRON_SECRET_STORE ||
    "change_me_cron_secret_store_at_least_32_characters";
  if (
    req.headers.get("authorization") !== `Bearer ${secret}`
  )
    return NextResponse.json(
      { error: "Unauthorized drain request" },
      { status: 401 },
    );
  startLocalOutboxWorker();
  return NextResponse.json(await drainStoreOutbox());
}

export const GET = POST;

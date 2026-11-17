import { databaseRoute } from "../../../../../../packages/database/postgres.mjs";
import { after, NextResponse, type NextRequest } from "next/server";
import { simulationService } from "@/lib/simulation/simulation-service";
import { outboxEngine, persistOutboxState } from "@/lib/outbox/outbox-engine";
import {
  drainStoreOutbox,
  startLocalOutboxWorker,
} from "@/lib/outbox/dispatch";

async function handlePOST(req: NextRequest) {
  if (process.env.NODE_ENV === "production")
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const { key, value } = await req.json();
    if (typeof key !== "string" || typeof value !== "boolean") {
      return NextResponse.json(
        { error: "key (string) and value (boolean) are required" },
        { status: 422 },
      );
    }

    simulationService.setFlag(key, value);
    if (key === "partner_outage_simulated" && !value) {
      // Ending the demo outage explicitly makes buffered messages eligible now.
      for (const row of outboxEngine.getOutboxRows())
        if (row.status === "pending")
          row.nextAttemptAt = new Date().toISOString();
      persistOutboxState();
      after(async () => {
        startLocalOutboxWorker();
        await drainStoreOutbox();
      });
    }
    return NextResponse.json({
      success: true,
      flags: simulationService.getAllFlags(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const POST = databaseRoute("store", handlePOST, { readOnly: false });

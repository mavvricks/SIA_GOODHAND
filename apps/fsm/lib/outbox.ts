import crypto from "node:crypto";
import { jobsStore } from "./services/jobs-store";
import { simulationService } from "./simulation/simulation-service";
import { persistService } from "../../../packages/local-db/index.mjs";

const runtime = globalThis as typeof globalThis & {
  fsmFlush?: Promise<void>;
  fsmFlushTimer?: ReturnType<typeof setInterval>;
};
export function flushFsmOutbox(): Promise<void> {
  if (process.env.NODE_ENV === "development" && !runtime.fsmFlushTimer) {
    runtime.fsmFlushTimer = setInterval(() => {
      void flushFsmOutbox().catch(() => {});
    }, 5000);
    runtime.fsmFlushTimer.unref?.();
  }
  if (runtime.fsmFlush) return runtime.fsmFlush;
  runtime.fsmFlush = (async () => {
    const base = (
      process.env.FSM_STORE_BASE_URL || "http://localhost:3000/api/v1"
    ).replace(/\/$/, "");
    const paths: Record<string, string> = {
      "OP-05": "schedule-confirmations",
      "OP-06": "status-changes",
      "OP-07": "completions",
      "OP-08": "inventory-adjustments",
    };
    const started = Date.now();
    const blockedOrders = new Set<string>();
    for (const message of jobsStore.getOutboxMessages()) {
      if (Date.now() - started >= 6000) break;
      if (message.status === "delivered") continue;
      const orderKey = message.payload.orderNumber || message.payload.jobNumber;
      if (blockedOrders.has(orderKey)) continue;
      // Preserve each order's event sequence across retries (schedule, unclaim, reclaim).
      if (
        message.status !== "pending" ||
        Date.parse(message.nextAttemptAt) > Date.now()
      ) {
        blockedOrders.add(orderKey);
        continue;
      }
      message.attempts += 1;
      let status = 503;
      try {
        if (
          !simulationService.getFlag("partner_outage_simulated") &&
          paths[message.operationId]
        ) {
          const body = JSON.stringify(message.payload);
          const timestamp = new Date().toISOString();
          const secret =
            process.env.STORE_WEBHOOK_SIGNING_SECRET ||
            "change_me_webhook_signing_secret_at_least_32_characters";
          const signature =
            "sha256=" +
            crypto
              .createHmac("sha256", secret)
              .update(`${timestamp}.${body}`)
              .digest("hex");
          const response = await fetch(
            `${base}/webhooks/${paths[message.operationId]}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Signature": signature,
                "X-Timestamp": timestamp,
                "Idempotency-Key": message.idempotencyKey,
                "X-Correlation-Id": message.correlationId,
              },
              body,
              signal: AbortSignal.timeout(3000),
            },
          );
          status = response.status;
        }
      } catch {}
      if (status >= 200 && status < 300) message.status = "delivered";
      else if (
        message.attempts >= 5 ||
        [400, 401, 403, 404, 409, 422].includes(status)
      )
        message.status = "failed";
      else
        message.nextAttemptAt = new Date(
          Date.now() + 5000 * 2 ** (message.attempts - 1),
        ).toISOString();
      if (message.status !== "delivered") blockedOrders.add(orderKey);
      persistService(jobsStore);
    }
  })().finally(() => {
    runtime.fsmFlush = undefined;
  });
  return runtime.fsmFlush;
}

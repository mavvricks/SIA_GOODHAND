import { outboxEngine } from "./outbox-engine";
import { createStoreToFsmServiceToken } from "../auth";
import { simulationService } from "../simulation/simulation-service";

export async function dispatchToFsm(
  operationId: string,
  payload: any,
  key: string,
  correlationId: string,
) {
  if (simulationService.getFlag("partner_outage_simulated"))
    return { status: 503 };
  const base = (
    process.env.STORE_FSM_BASE_URL || "http://localhost:3100/api/v1"
  ).replace(/\/$/, "");
  let endpoint = `${base}/installations`;
  let method = "POST";
  let scope = "installations:create";
  let body = payload;
  if (operationId === "OP-10" || operationId === "OP-11") {
    endpoint += `/${encodeURIComponent(payload.jobNumber)}/feedback`;
    scope = "feedback:write";
    method = operationId === "OP-11" ? "PATCH" : "POST";
    body = {
      rating: payload.rating,
      comment: payload.comment,
      technicianTags: payload.technicianTags || [],
      customerFirstName: payload.customerFirstName,
      submittedAt: payload.submittedAt,
    };
  } else if (operationId !== "OP-01") {
    return { status: 422 };
  }
  try {
    const token = await createStoreToFsmServiceToken([scope]);
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": key,
        "X-Correlation-Id": correlationId,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    return { status: response.status };
  } catch {
    return { status: 503 };
  }
}

const runtime = globalThis as typeof globalThis & {
  storeDrain?: Promise<{
    processed: number;
    successful: number;
    timedOut: boolean;
  }>;
  storeDrainTimer?: ReturnType<typeof setInterval>;
};
export function drainStoreOutbox() {
  if (!runtime.storeDrain)
    runtime.storeDrain = outboxEngine.drainQueue(dispatchToFsm).finally(() => {
      runtime.storeDrain = undefined;
    });
  return runtime.storeDrain;
}

// Local Node runtime retries queued requests; deployed cron uses the same drain.
export function startLocalOutboxWorker() {
  if (process.env.NODE_ENV !== "development" || runtime.storeDrainTimer) return;
  runtime.storeDrainTimer = setInterval(() => {
    void drainStoreOutbox().catch(() => {});
  }, 5000);
  runtime.storeDrainTimer.unref?.();
}

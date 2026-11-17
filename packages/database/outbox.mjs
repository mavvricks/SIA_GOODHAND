// A worker never holds a business transaction open across an HTTP call.
// Leases survive process restarts; receivers deduplicate the original message key.
import { withDatabase, outsideDatabase } from "./postgres.mjs";
// A replay occupies the original failed event's position in the order stream.
export function replayOrderedRows(rows) {
  const latest = new Map(
    rows.map((row) => [row.idempotencyKey || row.id, row]),
  );
  const seen = new Set();
  return rows.flatMap((row) => {
    const key = row.idempotencyKey || row.id;
    if (seen.has(key)) return [];
    seen.add(key);
    return [row.status === "failed" ? latest.get(key) : row];
  });
}
export async function drainPostgresOutbox(
  system,
  rows,
  dispatch,
  acknowledge,
  allowed = () => true,
) {
  return outsideDatabase(async () => {
    const started = Date.now();
    let processed = 0,
      successful = 0;
    while (Date.now() - started < 6000) {
      const claimed = await withDatabase(system, () => {
        if (!allowed()) return null;
        const blocked = new Set();
        const now = Date.now();
        for (const row of replayOrderedRows(rows())) {
          if (row.status === "delivered") continue;
          const order =
            row.payload.orderNumber || row.payload.jobNumber || row.id;
          if (blocked.has(order)) continue;
          blocked.add(order);
          if (
            row.status !== "pending" ||
            Date.parse(row.nextAttemptAt) > now ||
            row.leaseUntil > now
          )
            continue;
          row.leaseToken = crypto.randomUUID();
          row.leaseUntil = now + 60000;
          return structuredClone(row);
        }
        return null;
      });
      if (!claimed) break;
      let response;
      try {
        response = await dispatch(claimed);
      } catch {
        response = { status: 503 };
      }
      await withDatabase(system, async () => {
        const row = rows().find((row) => row.id === claimed.id);
        if (!row || row.leaseToken !== claimed.leaseToken) return;
        await acknowledge(row, response);
        delete row.leaseToken;
        delete row.leaseUntil;
        if (row.status === "delivered") successful++;
      });
      processed++;
    }
    return { processed, successful, timedOut: Date.now() - started >= 6000 };
  });
}

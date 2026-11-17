import crypto from "node:crypto";
import { postgresEnabled, queryDatabase } from "./postgres.mjs";
const memory = (globalThis[Symbol.for("goodhand.authThrottle")] ??= new Map());
export async function allowAuthAttempt(system, kind, address, identity = "") {
  const key = crypto
    .createHash("sha256")
    .update(
      `${kind}:${address || "unknown"}:${String(identity).trim().toLowerCase()}`,
    )
    .digest("hex");
  const limit = kind === "oauth" ? 30 : 20;
  if (postgresEnabled(system)) {
    const result = await queryDatabase(
      system,
      `INSERT INTO goodhand.auth_throttle(key,attempts,reset_at) VALUES($1,1,now()+interval '5 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN goodhand.auth_throttle.reset_at < now() THEN 1 ELSE goodhand.auth_throttle.attempts+1 END, reset_at=CASE WHEN goodhand.auth_throttle.reset_at < now() THEN now()+interval '5 minutes' ELSE goodhand.auth_throttle.reset_at END RETURNING attempts`,
      [key],
    );
    return result.rows[0].attempts <= limit;
  }
  const now = Date.now();
  const row = memory.get(key);
  const next =
    !row || row.reset < now
      ? { count: 1, reset: now + 300000 }
      : { count: row.count + 1, reset: row.reset };
  memory.set(key, next);
  if (memory.size > 1000)
    for (const [id, value] of memory) if (value.reset < now) memory.delete(id);
  return next.count <= limit;
}

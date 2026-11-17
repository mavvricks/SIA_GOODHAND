import crypto from "node:crypto";
import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
const runtime = (globalThis[Symbol.for("goodhand.postgres")] ??= {
  pools: new Map(),
  context: new AsyncLocalStorage(),
  services: new Map(),
});
export function postgresEnabled(system) {
  if (process.env.VERCEL && process.env.NODE_ENV === "production") {
    if (process.env.GOODHAND_E2E_SQLITE === "1")
      throw new Error("SQLite is not supported in a Vercel deployment");
    if (!process.env[`${system.toUpperCase()}_DATABASE_URL`])
      throw new Error(`Missing ${system.toUpperCase()}_DATABASE_URL on Vercel`);
  }
  if (process.env.GOODHAND_E2E_SQLITE === "1") return false;
  return (
    (process.env.NODE_ENV !== "test" &&
      Boolean(process.env[`${system.toUpperCase()}_DATABASE_URL`])) ||
    process.env.GOODHAND_POSTGRES_TEST === "true"
  );
}
export function poolFor(system) {
  if (!["store", "fsm"].includes(system))
    throw new Error("Unknown database system");
  const connectionString = process.env[`${system.toUpperCase()}_DATABASE_URL`];
  if (!connectionString)
    throw new Error(`Missing ${system.toUpperCase()}_DATABASE_URL`);
  const key = system + connectionString;
  if (!runtime.pools.has(key)) {
    const parsed = new URL(connectionString);
    // Verify the server certificate; never disable TLS verification for hosted databases.
    if (parsed.searchParams.has("sslmode"))
      parsed.searchParams.set("sslmode", "verify-full");
    const pool = new pg.Pool({
      connectionString: parsed.toString(),
      max: 3,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 10000,
      allowExitOnIdle: true,
      enableChannelBinding: true,
    });
    pool.on("error", () =>
      console.error(
        "PostgreSQL idle connection failed; the next request will reconnect.",
      ),
    );
    runtime.pools.set(key, pool);
  }
  return runtime.pools.get(key);
}
export const collections = {
  store: [
    ["orders", "orders", "orders", "map"],
    ["orders", "checkoutResults", "checkout_receipts", "object"],
    ["inventory", "inventory", "inventory", "map"],
    ["inventory", "movements", "stock_movements", "map"],
    ["outbox", "outbox", "outbox_messages", "map"],
    ["outbox", "failedQueue", "failed_messages", "map"],
    ["feedback", "feedbacks", "feedback", "map"],
    ["feedback", "followups", "followups", "array"],
    ["mail", "logs", "mail_log", "array"],
  ],
  fsm: [
    ["jobs", "jobs", "jobs", "map"],
    ["jobs", "appointments", "appointments", "array"],
    ["jobs", "processedMessages", "processed_messages", "map"],
    ["jobs", "outboxMessages", "outbox_messages", "array"],
    ["jobs", "technicianFeedbacks", "technician_feedback", "map"],
    ["jobs", "followups", "followups", "array"],
    ["jobs", "technicianDetails", "technician_details", "object"],
    ["mail", "logs", "mail_log", "array"],
  ],
};
export const encode = (value) =>
  JSON.stringify(value, (_key, v) =>
    v instanceof Map ? { __goodhandMap: Array.from(v) } : v,
  );
export const decode = (text) =>
  JSON.parse(text, (_key, v) =>
    v && Object.keys(v).length === 1 && Array.isArray(v.__goodhandMap)
      ? new Map(v.__goodhandMap)
      : v,
  );
const clone = (value) => decode(encode(value));
const stateOf = (service) =>
  Object.fromEntries(
    Object.entries(service).filter(([, v]) => typeof v !== "function"),
  );
export function registerService(service, system, name) {
  const key = system + ":" + name;
  runtime.services.set(key, {
    service,
    system,
    name,
    initial: clone(stateOf(service)),
  });
  return new Proxy(service, {
    get(target, property) {
      if (property === "__postgresService") return true;
      const context = runtime.context.getStore();
      if (!context || context.system !== system || !context.active)
        throw new Error(
          `Database context required for ${system}/${name}. Use withDatabase().`,
        );
      const local = context.instances.get(name);
      if (!local)
        throw new Error(
          `Service ${name} was loaded after the database transaction started.`,
        );
      const value = local[property];
      return typeof value === "function" ? value.bind(local) : value;
    },
    set(_target, property, value) {
      const context = runtime.context.getStore();
      if (!context?.active || context.system !== system)
        throw new Error("Database context required");
      context.instances.get(name)[property] = value;
      return true;
    },
  });
}
export async function loadStates(client, system) {
  const states = new Map();
  const meta = await client.query(
    "SELECT service, field, value FROM goodhand.metadata",
  );
  for (const row of meta.rows) {
    if (!states.has(row.service)) states.set(row.service, {});
    states.get(row.service)[row.field] = decode(JSON.stringify(row.value));
  }
  // A single round trip loads all domain rows; records are stored individually, not whole-service snapshots.
  const union = collections[system]
    .map(
      ([, , table]) =>
        `SELECT '${table}' AS source, id, payload, position FROM goodhand.${table}`,
    )
    .join(" UNION ALL ");
  const rows = (await client.query(union)).rows;
  for (const [service, field, table, kind] of collections[system]) {
    if (!states.has(service)) states.set(service, {});
    const selected = rows
      .filter((r) => r.source === table)
      .sort((a, b) => a.position - b.position);
    states.get(service)[field] =
      kind === "map"
        ? new Map(selected.map((r) => [r.id, r.payload]))
        : kind === "array"
          ? selected.map((r) => r.payload)
          : Object.fromEntries(selected.map((r) => [r.id, r.payload]));
  }
  return states;
}
export function rowsFor(value, kind) {
  if (kind === "map") return Array.from(value || []);
  if (kind === "object") return Object.entries(value || {});
  return (value || []).map((item, index) => [
    String(item.id || item.jobNumber || index),
    item,
  ]);
}
export async function saveStates(client, system, states, before = new Map()) {
  // Queue mutations, stock, idempotency receipts and business rows commit in the same transaction.
  for (const [service, state] of states) {
    const previous = before.get(service) || {};
    for (const [field, value] of Object.entries(state)) {
      const config = collections[system].find(
        (c) => c[0] === service && c[1] === field,
      );
      if (!config) {
        if (encode(previous[field]) !== encode(value))
          await client.query(
            "INSERT INTO goodhand.metadata(service,field,value) VALUES($1,$2,$3::jsonb) ON CONFLICT(service,field) DO UPDATE SET value=excluded.value",
            [service, field, encode(value)],
          );
        continue;
      }
      const [, , table, kind] = config;
      const oldRows = new Map(rowsFor(previous[field], kind));
      const entries = rowsFor(value, kind);
      const ids = new Set(entries.map(([id]) => String(id)));
      const removed = [...oldRows.keys()].filter((id) => !ids.has(String(id)));
      if (removed.length)
        await client.query(
          `DELETE FROM goodhand.${table} WHERE id=ANY($1::text[])`,
          [removed],
        );
      const changes = entries
        .map(([id, payload], position) => ({
          id: String(id),
          payload,
          position,
        }))
        .filter(
          (row) =>
            JSON.stringify(oldRows.get(row.id)) !==
              JSON.stringify(row.payload) ||
            (kind === "array" &&
              rowsFor(previous[field], kind)[row.position]?.[0] !== row.id),
        );
      if (changes.length)
        await client.query(
          `INSERT INTO goodhand.${table}(id,payload,position) SELECT id,payload,position FROM jsonb_to_recordset($1::jsonb) AS r(id text,payload jsonb,position integer) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,position=excluded.position`,
          [JSON.stringify(changes)],
        );
    }
  }
}
export async function withDatabase(system, fn, { readOnly = false } = {}) {
  if (!postgresEnabled(system)) {
    const { withLocalTransaction } = await import("../local-db/index.mjs");
    return withLocalTransaction(system, fn, { readOnly });
  }
  const existing = runtime.context.getStore();
  if (existing?.active && existing.system === system) return fn();
  const client = await poolFor(system).connect();
  let context;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '15s'");
    await client.query("SET LOCAL statement_timeout = '25s'");
    // Shared read locks and an exclusive write lock make the legacy synchronous domain rules safe across processes.
    await client.query(
      `SELECT pg_advisory_xact_lock${readOnly ? "_shared" : ""}(742019,1)`,
    );
    const saved = await loadStates(client, system);
    const instances = new Map();
    for (const entry of runtime.services.values())
      if (entry.system === system) {
        const local = Object.create(Object.getPrototypeOf(entry.service));
        Object.assign(
          local,
          clone(entry.initial),
          clone(saved.get(entry.name) || {}),
        );
        instances.set(entry.name, local);
      }
    context = { system, client, instances, active: true };
    const result = await runtime.context.run(context, fn);
    if (result instanceof Response && result.status >= 400) {
      await client.query("ROLLBACK");
      return result;
    }
    if (!readOnly)
      await saveStates(
        client,
        system,
        new Map(
          [...instances].map(([name, instance]) => [name, stateOf(instance)]),
        ),
        saved,
      );
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23P01")
      throw Object.assign(
        new Error("Schedule conflict: leave at least two hours between jobs."),
        { category: "SCHEDULE_CONFLICT" },
      );
    throw error;
  } finally {
    if (context) context.active = false;
    client.release();
  }
}
export function databaseRoute(system, handler, { readOnly = false } = {}) {
  return async (...args) => {
    const request = args[0];
    const pathname = request?.url ? new URL(request.url).pathname : "";
    if (
      pathname.startsWith("/api/demo/") &&
      process.env.NODE_ENV === "production"
    )
      return Response.json(
        { error: { message: "Not found" } },
        { status: 404 },
      );
    const webhook =
      system === "store" && pathname.startsWith("/api/v1/webhooks/");
    if (
      webhook &&
      process.env.NODE_ENV === "production" &&
      !process.env.STORE_WEBHOOK_SIGNING_SECRET
    )
      return Response.json(
        {
          error: {
            category: "SERVICE_UNAVAILABLE",
            message: "Webhook signing is not configured.",
          },
        },
        { status: 503 },
      );
    let hash, key;
    if (webhook) {
      const raw = await request.clone().text();
      const timestamp = request.headers.get("x-timestamp") || "";
      const signature = request.headers.get("x-signature") || "";
      const expected =
        "sha256=" +
        crypto
          .createHmac(
            "sha256",
            process.env.STORE_WEBHOOK_SIGNING_SECRET ||
              "change_me_webhook_signing_secret_at_least_32_characters",
          )
          .update(`${timestamp}.${raw}`)
          .digest("hex");
      if (
        !Number.isFinite(Date.parse(timestamp)) ||
        Math.abs(Date.now() - Date.parse(timestamp)) > 300000 ||
        signature.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      )
        return Response.json(
          {
            error: {
              category: "AUTHENTICATION_REQUIRED",
              message: "Invalid webhook signature or timestamp",
            },
          },
          { status: 401 },
        );
      const id = request.headers.get("idempotency-key");
      if (!id || id.length > 256)
        return Response.json(
          {
            error: {
              category: "VALIDATION_FAILED",
              message: "Idempotency-Key required (maximum 256 characters).",
            },
          },
          { status: 422 },
        );
      hash = crypto.createHash("sha256").update(raw).digest("hex");
      key = pathname + ":" + id;
    }
    try {
      return await withDatabase(
        system,
        async () => {
          const context = runtime.context.getStore();
          let local;
          if (webhook) {
            const old = context
              ? (
                  await context.client.query(
                    "SELECT hash,response FROM goodhand.inbound_messages WHERE id=$1",
                    [key],
                  )
                ).rows[0]
              : (local = (
                  await import("../local-db/index.mjs")
                ).getLocalDatabase("store")).inboundMessage(key);
            if (old) {
              if (old.hash !== hash)
                return Response.json(
                  {
                    error: {
                      category: "IDEMPOTENCY_KEY_CONFLICT",
                      message: "Key already used for another payload",
                    },
                  },
                  { status: 409 },
                );
              const response =
                typeof old.response === "string"
                  ? JSON.parse(old.response)
                  : old.response;
              return Response.json(response.body, { status: response.status });
            }
          }
          const result = await handler(...args);
          if (webhook && result.status >= 200 && result.status < 300) {
            const response = {
              status: result.status,
              body: await result.clone().json(),
            };
            if (context)
              await context.client.query(
                "INSERT INTO goodhand.inbound_messages(id,hash,response) VALUES($1,$2,$3::jsonb)",
                [key, hash, JSON.stringify(response)],
              );
            else local.saveInboundMessage(key, hash, response);
          }
          return result;
        },
        { readOnly },
      );
    } catch (error) {
      console.error("Database request failed", {
        code: error.code || error.category || "DATABASE_ERROR",
        message: String(error.message)
          .replace(/postgres(?:ql)?:\/\/\S+/g, "[REDACTED]")
          .slice(0, 200),
      });
      return Response.json(
        {
          error: {
            category: error.category || "DATABASE_UNAVAILABLE",
            message:
              error.category === "SCHEDULE_CONFLICT"
                ? error.message
                : "Unable to complete the request. Please retry.",
            referenceId: crypto.randomUUID(),
          },
        },
        { status: error.category === "SCHEDULE_CONFLICT" ? 409 : 503 },
      );
    }
  };
}
export async function closePools() {
  await Promise.all([...runtime.pools.values()].map((pool) => pool.end()));
  runtime.pools.clear();
}

export function outsideDatabase(fn) {
  return runtime.context.run(undefined, fn);
}

export function queryDatabase(system, sql, args) {
  const context = runtime.context.getStore();
  return context?.active && context.system === system
    ? context.client.query(sql, args)
    : poolFor(system).query(sql, args);
}

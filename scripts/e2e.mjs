import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";

const root = resolve(import.meta.dirname, "..");
const dataDir = mkdtempSync(join(tmpdir(), "goodhand-e2e-"));
const secret = crypto.randomBytes(48).toString("hex");
const env = {
  ...process.env,
  NODE_ENV: "development",
  GOODHAND_E2E_SQLITE: "1",
  STORE_DATABASE_URL: "",
  FSM_DATABASE_URL: "",
  GOODHAND_DATA_DIR: dataDir,
  DEMO_MODE: "true",
  STORE_SESSION_SECRET: secret,
  FSM_SESSION_SECRET: secret,
  STORE_SERVICE_CLIENT_SECRET: secret,
  STORE_WEBHOOK_SIGNING_SECRET: secret,
  CRON_SECRET_STORE: secret,
  CRON_SECRET_FSM: secret,
  STORE_FSM_BASE_URL: "http://127.0.0.1:3100/api/v1",
  FSM_STORE_BASE_URL: "http://127.0.0.1:3000/api/v1",
};
const children = [];
let isolatedModeVerified = false;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function start(app) {
  const appDir = join(root, "apps", app);
  const child = spawn(
    process.execPath,
    [
      join(appDir, "node_modules", "next", "dist", "bin", "next"),
      "dev",
      "-p",
      app === "store" ? "3000" : "3100",
    ],
    {
      cwd: appDir,
      env,
      detached: process.platform !== "win32",
      stdio: "ignore",
    },
  );
  children.push(child);
}
async function ready(url) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error(`Server did not start: ${url}`);
}
async function request(
  url,
  { method = "GET", body, cookie, headers = {} } = {},
) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  return {
    status: response.status,
    data,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
async function waitFor(fn, description) {
  for (let i = 0; i < 45; i++) {
    const result = await fn();
    if (result) return result;
    await sleep(1000);
  }
  throw new Error(`Timed out: ${description}`);
}
try {
  for (const port of [3000, 3100]) {
    try {
      await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
        signal: AbortSignal.timeout(500),
      });
      throw new Error(
        `Port ${port} is already in use; stop the existing app before running E2E.`,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("already in use"))
        throw error;
    }
  }
  start("store");
  start("fsm");
  await Promise.all([
    ready("http://127.0.0.1:3000/api/v1/catalog"),
    ready("http://127.0.0.1:3100/api/auth/me"),
  ]);
  const storeMode = await request(
    "http://127.0.0.1:3000/api/internal/e2e-mode",
  );
  const fsmMode = await request("http://127.0.0.1:3100/api/internal/e2e-mode");
  assert.equal(
    storeMode.data.isolated,
    true,
    `Store must use isolated test data: ${JSON.stringify(storeMode)}`,
  );
  assert.equal(
    fsmMode.data.isolated,
    true,
    `FSM must use isolated test data: ${JSON.stringify(fsmMode)}`,
  );
  isolatedModeVerified = true;
  const store = "http://127.0.0.1:3000",
    fsm = "http://127.0.0.1:3100";
  const customer = await request(`${store}/api/auth/login`, {
    method: "POST",
    body: { email: "customer1@example.com", password: "CustomerPassword123!" },
  });
  const admin = await request(`${store}/api/auth/login`, {
    method: "POST",
    body: { email: "admin@goodhand88.com", password: "AdminPassword123!" },
  });
  const dispatcher = await request(`${fsm}/api/auth/login`, {
    method: "POST",
    body: { email: "dispatcher1@fsm.local", password: "DispatcherPass123!" },
  });
  const technician = await request(`${fsm}/api/auth/login`, {
    method: "POST",
    body: { email: "arnel.mendoza@fsm.local", password: "TechPassword123!" },
  });
  for (const login of [customer, admin, dispatcher, technician])
    assert.equal(login.status, 200, JSON.stringify(login.data));
  const tokenRequest = async (scope) =>
    request(`${fsm}/api/oauth/token`, {
      method: "POST",
      body: {
        grant_type: "client_credentials",
        client_id: "store-service",
        client_secret: secret,
        scope,
      },
    });
  assert.equal(
    (await tokenRequest("unapproved:scope")).status,
    403,
    "OAuth rejects unknown scopes",
  );
  const serviceToken = (await tokenRequest("stock:read")).data.access_token;
  assert(serviceToken, "scoped service token issued");
  assert.equal(
    (
      await request(`${store}/api/v1/stock/availability?sku=GH-CCTV-001`, {
        headers: { Authorization: `Bearer ${serviceToken}` },
      })
    ).status,
    200,
  );
  const expiredPayload = {
    sub: "store-service",
    scope: "stock:read",
    exp: Math.floor(Date.now() / 1000) - 60,
  };
  const encoded = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encoded({ alg: "HS256", typ: "JWT" })}.${encoded(expiredPayload)}`;
  const expired = `${unsigned}.${crypto.createHmac("sha256", secret).update(unsigned).digest("base64url")}`;
  assert.equal(
    (
      await request(`${store}/api/v1/stock/availability?sku=GH-CCTV-001`, {
        headers: { Authorization: `Bearer ${expired}` },
      })
    ).status,
    401,
  );
  const invalidEmail = `e2e-${crypto.randomUUID()}@example.test`;
  let throttled;
  for (let attempt = 0; attempt < 21; attempt++)
    throttled = await request(`${store}/api/auth/login`, {
      method: "POST",
      body: { email: invalidEmail, password: "incorrect" },
    });
  assert.equal(throttled.status, 429, "login requests are throttled");
  assert(
    new DatabaseSync(join(dataDir, "store.sqlite"), {
      readOnly: true,
    }).close() === undefined,
    "Store uses isolated SQLite",
  );
  assert(
    new DatabaseSync(join(dataDir, "fsm.sqlite"), {
      readOnly: true,
    }).close() === undefined,
    "FSM uses isolated SQLite",
  );
  const initial = (
    await request(`${store}/api/v1/stock/availability?sku=GH-CCTV-001`)
  ).status;
  assert.equal(initial, 401, "stock requires a scoped service token");
  assert.equal(
    (
      await request(`${store}/api/demo/flags`, {
        method: "POST",
        body: { key: "partner_outage_simulated", value: true },
      })
    ).status,
    200,
  );
  const checkout = await request(`${store}/api/checkout`, {
    method: "POST",
    cookie: customer.cookie,
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: {
      customerName: "E2E Customer",
      customerPhone: "09171234567",
      address: {
        line1: "100 Test Street",
        city: "Makati",
        province: "Metro Manila",
        postalCode: "1226",
      },
      items: [{ sku: "GH-CCTV-001", quantity: 1, unitPricePhp: "3850.00" }],
      include_installation: true,
      preferredStart: "2038-08-10T09:00:00+08:00",
      preferredEnd: "2038-08-10T11:00:00+08:00",
    },
  });
  assert.equal(checkout.status, 201, JSON.stringify(checkout.data));
  const orderNumber = checkout.data.orderNumber;
  const queue = await request(`${store}/api/operations`, {
    cookie: admin.cookie,
  });
  assert.equal(queue.status, 200);
  assert(
    queue.data.messages.some(
      (row) => row.orderNumber === orderNumber && row.status === "pending",
    ),
  );
  assert(
    !(
      await request(`${fsm}/api/v1/jobs`, { cookie: dispatcher.cookie })
    ).data.jobs.some((job) => job.orderNumber === orderNumber),
  );
  assert.equal(
    (
      await request(`${store}/api/demo/flags`, {
        method: "POST",
        body: { key: "partner_outage_simulated", value: false },
      })
    ).status,
    200,
  );
  const job = await waitFor(
    async () =>
      (
        await request(`${fsm}/api/v1/jobs`, { cookie: dispatcher.cookie })
      ).data.jobs.find((row) => row.orderNumber === orderNumber),
    "OP-01 dispatch",
  );
  const change = await request(
    `${store}/api/orders/${orderNumber}/installation`,
    {
      method: "POST",
      cookie: customer.cookie,
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: {
        action: "reschedule",
        reason: "Customer available next day",
        requestedStart: "2038-08-11T09:00:00+08:00",
        requestedEnd: "2038-08-11T11:00:00+08:00",
      },
    },
  );
  assert.equal(change.status, 202, JSON.stringify(change.data));
  assert.equal(
    (
      await request(`${fsm}/api/v1/jobs`, { cookie: dispatcher.cookie })
    ).data.jobs.find((row) => row.jobNumber === job.jobNumber).status,
    "Reschedule Required",
  );
  assert.equal(
    (
      await request(`${fsm}/api/demo/flags`, {
        method: "POST",
        body: { key: "partner_outage_simulated", value: true },
      })
    ).status,
    200,
  );
  const claims = await Promise.all([
    request(`${fsm}/api/v1/jobs/${job.jobNumber}/claim`, {
      method: "POST",
      cookie: technician.cookie,
    }),
    request(`${fsm}/api/v1/jobs/${job.jobNumber}/claim`, {
      method: "POST",
      cookie: technician.cookie,
    }),
  ]);
  assert.deepEqual(
    claims.map((item) => item.status).sort(),
    [200, 409],
    "concurrent claims have one winner",
  );
  assert.equal(
    (
      await request(`${fsm}/api/demo/flags`, {
        method: "POST",
        body: { key: "partner_outage_simulated", value: false },
      })
    ).status,
    200,
  );
  await sleep(5500);
  await request(`${fsm}/api/internal/drain`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  await waitFor(
    async () =>
      (
        await request(`${store}/api/orders`, { cookie: customer.cookie })
      ).data.orders.find((row) => row.orderNumber === orderNumber)
        ?.installationStatus === "Scheduled",
    "OP-05 delivery after outage",
  );
  const loaded = await request(`${fsm}/api/v1/jobs/${job.jobNumber}/loading`, {
    method: "POST",
    cookie: technician.cookie,
    body: { sku: "GH-CCTV-001", loadedQuantity: 1 },
  });
  assert.equal(loaded.status, 200, JSON.stringify(loaded.data));
  const started = await request(`${fsm}/api/v1/jobs/${job.jobNumber}/start`, {
    method: "POST",
    cookie: technician.cookie,
  });
  assert.equal(started.status, 200, JSON.stringify(started.data));
  const completed = await request(
    `${fsm}/api/v1/jobs/${job.jobNumber}/complete`,
    {
      method: "POST",
      cookie: technician.cookie,
      body: {
        result: "success",
        usedItems: [
          {
            sku: "GH-CCTV-001",
            quantity: 1,
            serialNumbers: [`E2E-${crypto.randomUUID()}`],
          },
        ],
        returnedItems: [],
      },
    },
  );
  assert.equal(completed.status, 200, JSON.stringify(completed.data));
  await waitFor(
    async () =>
      (
        await request(`${store}/api/orders`, { cookie: customer.cookie })
      ).data.orders.find((row) => row.orderNumber === orderNumber)?.status ===
      "fulfilled",
    "completion webhook",
  );
  const database = new DatabaseSync(join(dataDir, "fsm.sqlite"), {
    readOnly: true,
  });
  const snapshot = JSON.parse(
    database
      .prepare("SELECT payload FROM service_state WHERE name='jobs'")
      .get().payload,
  );
  database.close();
  const adjustment = snapshot.outboxMessages.find(
    (row) =>
      row.operationId === "OP-08" && row.payload.orderNumber === orderNumber,
  );
  assert(adjustment, "OP-08 record");
  const stock = () => {
    const db = new DatabaseSync(join(dataDir, "store.sqlite"), {
      readOnly: true,
    });
    const data = JSON.parse(
      db
        .prepare("SELECT payload FROM service_state WHERE name='inventory'")
        .get().payload,
    );
    db.close();
    return data.inventory.__goodhandMap.find(
      ([sku]) => sku === "GH-CCTV-001",
    )[1];
  };
  const stockBefore = await waitFor(() => {
    const item = stock();
    return item.reserved === 0 && item.onHand === 49 ? item : null;
  }, "OP-08 inventory adjustment");
  assert.equal(stockBefore.reserved, 0);
  assert.equal(stockBefore.onHand, 49);
  const raw = JSON.stringify(adjustment.payload),
    timestamp = new Date().toISOString();
  const signature =
    "sha256=" +
    crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${raw}`)
      .digest("hex");
  const duplicate = await fetch(
    `${store}/api/v1/webhooks/inventory-adjustments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Timestamp": timestamp,
        "X-Signature": signature,
        "Idempotency-Key": adjustment.idempotencyKey,
      },
      body: raw,
    },
  );
  assert.equal(duplicate.status, 200);
  const changed = JSON.stringify({ ...adjustment.payload, quantity: 2 });
  const changedSignature =
    "sha256=" +
    crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${changed}`)
      .digest("hex");
  assert.equal(
    (
      await fetch(`${store}/api/v1/webhooks/inventory-adjustments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Timestamp": timestamp,
          "X-Signature": changedSignature,
          "Idempotency-Key": adjustment.idempotencyKey,
        },
        body: changed,
      })
    ).status,
    409,
  );
  assert.deepEqual(
    stock(),
    stockBefore,
    "duplicate webhook did not deduct stock twice",
  );
  const cancelledCheckout = await request(`${store}/api/checkout`, {
    method: "POST",
    cookie: customer.cookie,
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: {
      customerName: "E2E Cancellation",
      customerPhone: "09171234567",
      address: {
        line1: "100 Test Street",
        city: "Makati",
        province: "Metro Manila",
        postalCode: "1226",
      },
      items: [{ sku: "GH-CCTV-002", quantity: 1, unitPricePhp: "4950.00" }],
      include_installation: true,
      preferredStart: "2038-08-12T09:00:00+08:00",
      preferredEnd: "2038-08-12T11:00:00+08:00",
    },
  });
  assert.equal(cancelledCheckout.status, 201);
  const cancelledOrder = cancelledCheckout.data.orderNumber;
  await waitFor(
    async () =>
      (
        await request(`${fsm}/api/v1/jobs`, { cookie: dispatcher.cookie })
      ).data.jobs.some((row) => row.orderNumber === cancelledOrder),
    "second installation dispatch",
  );
  const cancellation = await request(
    `${store}/api/orders/${cancelledOrder}/installation`,
    {
      method: "POST",
      cookie: customer.cookie,
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: { action: "cancel", reason: "Customer will install the equipment" },
    },
  );
  assert.equal(cancellation.status, 200, JSON.stringify(cancellation.data));
  const cancelledState = (
    await request(`${store}/api/orders`, { cookie: customer.cookie })
  ).data.orders.find((row) => row.orderNumber === cancelledOrder);
  assert.equal(
    cancelledState.status,
    "paid",
    "hardware order continues after installation cancellation",
  );
  assert.equal(cancelledState.installationStatus, "Cancelled");
  const db = new DatabaseSync(join(dataDir, "store.sqlite"), {
    readOnly: true,
  });
  const inventory = JSON.parse(
    db.prepare("SELECT payload FROM service_state WHERE name='inventory'").get()
      .payload,
  );
  db.close();
  const converted = inventory.inventory.__goodhandMap.find(
    ([sku]) => sku === "GH-CCTV-002",
  )[1];
  assert.equal(converted.onHand, 49);
  assert.equal(
    converted.reserved,
    0,
    "cancelled installation converts reservation to hardware sale",
  );
  console.log(
    "PASS checkout, stock reservation, outage recovery, OP-01, customer reschedule, claim, OP-05, loading, start, OP-07/08, duplicate webhook and final order",
  );
} finally {
  for (const child of children)
    try {
      if (process.platform === "win32") process.kill(child.pid);
      else process.kill(-child.pid, "SIGTERM");
    } catch {}
  if (process.platform === "win32" && isolatedModeVerified) {
    const listeners = execFileSync("netstat", ["-ano", "-p", "tcp"], {
      encoding: "utf8",
    });
    const pids = new Set(
      [
        ...listeners.matchAll(
          /^\s*TCP\s+\S+:(?:3000|3100)\s+\S+\s+LISTENING\s+(\d+)/gm,
        ),
      ].map((match) => match[1]),
    );
    for (const pid of pids)
      try {
        process.kill(Number(pid));
      } catch {}
  }
  const target = resolve(dataDir),
    parent = resolve(tmpdir());
  if (target.startsWith(parent + "\\") || target.startsWith(parent + "/")) {
    await sleep(750);
    try {
      rmSync(target, {
        recursive: true,
        force: true,
        maxRetries: 20,
        retryDelay: 500,
      });
    } catch {
      console.warn(
        "Temporary E2E data could not be removed immediately; remove the goodhand-e2e directory from the system temp folder after all Node processes exit.",
      );
    }
  }
}

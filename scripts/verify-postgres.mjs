import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { loadDatabaseEnvironment } from "../packages/database/environment.mjs";
import {
  poolFor,
  registerService,
  withDatabase,
  closePools,
} from "../packages/database/postgres.mjs";
loadDatabaseEnvironment();
const token = process.argv[3] || crypto.randomUUID();
const service = "verification_" + token;
class Counter {
  counter = 0;
  increment() {
    this.counter++;
  }
}
const counter = registerService(new Counter(), "fsm", service);
async function child() {
  await withDatabase("fsm", () => counter.increment());
}
async function runChild() {
  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [process.argv[1], "child", token], {
      env: process.env,
      stdio: ["ignore", "ignore", "ignore"],
    });
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Child verification failed")),
    );
  });
}
try {
  if (process.argv[2] === "child") {
    await child();
  } else {
    await Promise.all([runChild(), runChild()]);
    const value = (
      await poolFor("fsm").query(
        "SELECT value FROM goodhand.metadata WHERE service=$1 AND field=$2",
        [service, "counter"],
      )
    ).rows[0].value;
    assert.equal(value, 2);
    console.log(
      "PASS: independent Node processes serialize domain writes without lost updates.",
    );
    await assert.rejects(
      withDatabase("fsm", () => {
        counter.increment();
        throw new Error("rollback verification");
      }),
      /rollback verification/,
    );
    assert.equal(
      (
        await poolFor("fsm").query(
          "SELECT value FROM goodhand.metadata WHERE service=$1",
          [service],
        )
      ).rows[0].value,
      2,
    );
    console.log("PASS: failed domain transaction rolls back changes.");
    const db = poolFor("fsm");
    const a = await db.connect(),
      b = await db.connect();
    const first = "verify-a-" + token,
      second = "verify-b-" + token;
    const payload = (id, start, end) => ({
      id,
      jobId: id,
      technicianId: "verify-tech-" + token,
      status: "active",
      periodStart: start,
      periodEnd: end,
    });
    try {
      await a.query("BEGIN");
      await a.query(
        "INSERT INTO goodhand.appointments(id,payload) VALUES($1,$2::jsonb)",
        [
          first,
          JSON.stringify(
            payload(first, "2045-01-01T09:00:00Z", "2045-01-01T11:00:00Z"),
          ),
        ],
      );
      await b.query("BEGIN");
      const conflicting = b
        .query(
          "INSERT INTO goodhand.appointments(id,payload) VALUES($1,$2::jsonb)",
          [
            second,
            JSON.stringify(
              payload(second, "2045-01-01T12:59:00Z", "2045-01-01T15:00:00Z"),
            ),
          ],
        )
        .then(
          () => null,
          (error) => error.code,
        );
      await a.query("COMMIT");
      assert.equal(await conflicting, "23P01");
      await b.query("ROLLBACK");
      await b.query("BEGIN");
      await b.query(
        "INSERT INTO goodhand.appointments(id,payload) VALUES($1,$2::jsonb)",
        [
          second,
          JSON.stringify(
            payload(second, "2045-01-01T13:00:00Z", "2045-01-01T15:00:00Z"),
          ),
        ],
      );
      await b.query("ROLLBACK");
      console.log(
        "PASS: PostgreSQL rejects concurrent appointments inside the two-hour buffer and accepts the exact boundary.",
      );
    } finally {
      await a.query("ROLLBACK").catch(() => {});
      await b.query("ROLLBACK").catch(() => {});
      await a.query(
        "DELETE FROM goodhand.appointments WHERE id=ANY($1::text[])",
        [[first, second]],
      );
      a.release();
      b.release();
    }
    const store = await poolFor("store").connect();
    const id = "verify-rollback-" + token;
    try {
      await store.query("BEGIN");
      await store.query(
        "INSERT INTO goodhand.orders(id,payload) VALUES($1,$2::jsonb)",
        [id, JSON.stringify({ orderNumber: id })],
      );
      await assert.rejects(
        store.query(
          "INSERT INTO goodhand.inventory(id,payload) VALUES($1,$2::jsonb)",
          [id, JSON.stringify({ onHand: 1, reserved: 2 })],
        ),
        (error) => error.code === "23514",
      );
      await store.query("ROLLBACK");
      assert.equal(
        (await store.query("SELECT 1 FROM goodhand.orders WHERE id=$1", [id]))
          .rowCount,
        0,
      );
      console.log(
        "PASS: database stock constraints roll back the entire order transaction.",
      );
    } finally {
      await store.query("ROLLBACK").catch(() => {});
      store.release();
    }
    console.log("PostgreSQL verification complete. Temporary probes removed.");
  }
} catch (error) {
  console.error("PostgreSQL verification failed:", error.code || error.message);
  process.exitCode = 1;
} finally {
  if (process.argv[2] !== "child")
    await poolFor("fsm")
      .query("DELETE FROM goodhand.metadata WHERE service=$1", [service])
      .catch(() => {});
  await closePools();
}

import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("../", import.meta.url)));
import fs from "node:fs";
import crypto from "node:crypto";
import {
  poolFor,
  collections,
  decode,
  saveStates,
  closePools,
} from "../packages/database/postgres.mjs";
import { loadDatabaseEnvironment } from "../packages/database/environment.mjs";
async function migrate(system) {
  const client = await poolFor(system).connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(742019,2)");
    const common = fs.readFileSync(
      "packages/database/migrations/001-common.sql",
      "utf8",
    );
    await client.query(common);
    for (const [version, file] of [
      [1, "001-common.sql"],
      [2, `002-${system}.sql`],
      [3, "003-common.sql"],
    ]) {
      const sql = fs.readFileSync(
        "packages/database/migrations/" + file,
        "utf8",
      );
      const hash = crypto.createHash("sha256").update(sql).digest("hex");
      const previous = (
        await client.query(
          "SELECT checksum FROM goodhand.schema_migrations WHERE version=$1",
          [version],
        )
      ).rows[0];
      if (previous && previous.checksum !== hash)
        throw new Error("Applied migration checksum changed");
      if (!previous) {
        if (version !== 1) await client.query(sql);
        await client.query(
          "INSERT INTO goodhand.schema_migrations(version,checksum) VALUES($1,$2)",
          [version, hash],
        );
      }
    }
    await client.query("COMMIT");
    console.log(`${system}: PostgreSQL migrations applied.`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
async function importLocal(system) {
  const { DatabaseSync } = await import("node:sqlite");
  const filename = `.data/${system}.sqlite`;
  if (!fs.existsSync(filename))
    throw new Error(`Missing local ${system} database`);
  const local = new DatabaseSync(filename, { readOnly: true });
  const states = new Map(
    local
      .prepare("SELECT name,payload FROM service_state")
      .all()
      .map((row) => [row.name, decode(row.payload)]),
  );
  const users = local.prepare("SELECT * FROM users").all();
  const client = await poolFor(system).connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(742019,1)");
    if (
      (
        await client.query("SELECT 1 FROM goodhand.imports WHERE source=$1", [
          "local-sqlite-v1",
        ])
      ).rowCount
    ) {
      console.log(`${system}: local import already completed; skipped.`);
      await client.query("ROLLBACK");
      return;
    }
    for (const table of [
      "users",
      ...new Set(collections[system].map((c) => c[2])),
    ])
      if (
        (await client.query(`SELECT 1 FROM goodhand.${table} LIMIT 1`)).rowCount
      )
        throw new Error(
          `${system}: destination is not empty; refusing to overwrite existing records.`,
        );
    // A completed/cancelled job no longer owns a live appointment.
    if (system === "fsm") {
      const state = states.get("jobs");
      const terminal = new Set(
        [...state.jobs.values()]
          .filter((job) => ["Completed", "Cancelled"].includes(job.status))
          .map((job) => job.id),
      );
      for (const appointment of state.appointments)
        if (terminal.has(appointment.jobId)) appointment.status = "released";
    }
    await saveStates(client, system, states);
    for (const user of users)
      await client.query(
        "INSERT INTO goodhand.users(id,email,password_hash,role,full_name,active,created_at) VALUES($1,lower($2),$3,$4,$5,$6,$7)",
        [
          user.id,
          user.email,
          user.password_hash,
          user.role,
          user.full_name,
          Boolean(user.active),
          user.created_at,
        ],
      );
    // Sessions intentionally do not migrate: all users sign in again after cutover.
    const summary = { services: states.size, users: users.length };
    await client.query(
      "INSERT INTO goodhand.imports(source,summary) VALUES($1,$2::jsonb)",
      ["local-sqlite-v1", JSON.stringify(summary)],
    );
    await client.query("COMMIT");
    console.log(
      `${system}: imported ${users.length} users and ${states.size} domain services; local data unchanged.`,
    );
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    local.close();
  }
}
async function status(system) {
  const db = poolFor(system);
  const userCount = (await db.query("SELECT count(*) FROM goodhand.users"))
    .rows[0].count;
  const table = system === "store" ? "orders" : "jobs";
  const count = (await db.query(`SELECT count(*) FROM goodhand.${table}`))
    .rows[0].count;
  console.log(`${system}: connected; ${userCount} users; ${count} ${table}.`);
}
try {
  const systems = process.argv[3] ? [process.argv[3]] : ["store", "fsm"];
  if (systems.some((system) => !["store", "fsm"].includes(system)))
    throw new Error("Unknown system");
  loadDatabaseEnvironment(process.cwd(), systems);
  const mode = process.argv[2] || "status";
  for (const system of systems) {
    if (mode === "migrate") await migrate(system);
    else if (mode === "import-local") await importLocal(system);
    else if (mode === "status") await status(system);
    else throw new Error("Use migrate, import-local or status");
  }
} catch (error) {
  console.error(
    "Database operation failed:",
    error.code || "CONFIGURATION",
    String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, "[REDACTED]"),
  );
  process.exitCode = 1;
} finally {
  await closePools();
}

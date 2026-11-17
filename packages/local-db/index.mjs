import { createRequire } from "node:module";
import { postgresEnabled, registerService } from "../database/postgres.mjs";
const require = createRequire(import.meta.url);
import fs from "node:fs";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
let root = process.cwd();
while (
  !fs.existsSync(path.join(root, "pnpm-workspace.yaml")) &&
  path.dirname(root) !== root
)
  root = path.dirname(root);
const runtime = (globalThis[Symbol.for("goodhand.localDatabase")] ??= {
  databases: new Map(),
  services: new WeakMap(),
  transactionContext: new AsyncLocalStorage(),
});
runtime.transactionContext ||= new AsyncLocalStorage();

export class LocalDatabase {
  constructor(filename) {
    this.services = new Set();
    this.transactionTail = Promise.resolve();
    if (filename !== ":memory:")
      fs.mkdirSync(path.dirname(filename), { recursive: true });
    const { DatabaseSync } = require("node:sqlite");
    this.connection = new DatabaseSync(filename);
    this.connection
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      INSERT OR IGNORE INTO schema_migrations VALUES(1, datetime('now'));
      CREATE TABLE IF NOT EXISTS service_state(name TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, role TEXT NOT NULL, full_name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS inbound_messages(id TEXT PRIMARY KEY, hash TEXT NOT NULL, response TEXT NOT NULL, received_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);`);
  }
  inboundMessage(id) {
    return this.connection
      .prepare("SELECT hash,response FROM inbound_messages WHERE id=?")
      .get(id);
  }
  saveInboundMessage(id, hash, response) {
    this.connection
      .prepare(
        "INSERT OR IGNORE INTO inbound_messages(id,hash,response,received_at) VALUES(?,?,?,?)",
      )
      .run(id, hash, JSON.stringify(response), new Date().toISOString());
  }
  readState(name) {
    return this.connection
      .prepare("SELECT payload FROM service_state WHERE name=?")
      .get(name)?.payload;
  }
  writeState(name, payload) {
    this.connection
      .prepare(
        "INSERT INTO service_state VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at",
      )
      .run(name, payload, new Date().toISOString());
  }
  findUser(email) {
    return this.connection
      .prepare("SELECT * FROM users WHERE email=? AND active=1")
      .get(email);
  }
  userById(id) {
    return this.connection
      .prepare("SELECT * FROM users WHERE id=? AND active=1")
      .get(id);
  }
  addUser(user) {
    this.connection
      .prepare(
        "INSERT INTO users(id,email,password_hash,role,full_name,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(
        user.id,
        user.email,
        user.passwordHash,
        user.role,
        user.fullName,
        new Date().toISOString(),
      );
  }
  createSession(id, userId, expiresAt) {
    this.connection
      .prepare("DELETE FROM sessions WHERE expires_at <= ?")
      .run(Date.now());
    this.connection
      .prepare("INSERT INTO sessions VALUES(?,?,?,?)")
      .run(id, userId, expiresAt, Date.now());
  }
  sessionUser(id, userId) {
    return this.connection
      .prepare(
        "SELECT users.* FROM users JOIN sessions ON sessions.user_id=users.id WHERE sessions.id=? AND users.id=? AND sessions.expires_at>? AND users.active=1",
      )
      .get(id, userId, Date.now());
  }
  revokeSession(id) {
    this.connection.prepare("DELETE FROM sessions WHERE id=?").run(id);
  }
  close() {
    this.connection.close();
  }
}

export function getLocalDatabase(system) {
  if (!["store", "fsm"].includes(system))
    throw new Error("Unknown database system");
  if (process.env.VERCEL)
    throw new Error(
      "Local SQLite is for local use only. A hosted database adapter is required before Vercel deployment.",
    );
  const directory = process.env.GOODHAND_DATA_DIR || path.join(root, ".data");
  const filename =
    process.env.NODE_ENV === "test" && !process.env.GOODHAND_DATA_DIR
      ? ":memory:"
      : path.resolve(directory, `${system}.sqlite`);
  const key = `${system}:${filename}`;
  if (!runtime.databases.has(key))
    runtime.databases.set(key, new LocalDatabase(filename));
  return runtime.databases.get(key);
}

const encode = (state) =>
  JSON.stringify(state, (_key, value) =>
    value instanceof Map
      ? { __goodhandMap: Array.from(value.entries()) }
      : value,
  );
const decode = (value) =>
  JSON.parse(value, (_key, item) =>
    item &&
    typeof item === "object" &&
    Object.keys(item).length === 1 &&
    Array.isArray(item.__goodhandMap)
      ? new Map(item.__goodhandMap)
      : item,
  );
const stateOf = (service) =>
  Object.fromEntries(
    Object.entries(service).filter(([, value]) => typeof value !== "function"),
  );

export function persistService(service) {
  if (service.__postgresService) return;
  const record = runtime.services.get(service);
  if (!record) return;
  const payload = encode(stateOf(service));
  if (payload !== record.last) {
    record.database.writeState(record.name, payload);
    record.last = payload;
  }
}

// One local app process owns one SQLite connection. Queue request units of work
// and restore in-memory service state if a transaction is rejected.
export async function withLocalTransaction(
  system,
  fn,
  { readOnly = false } = {},
) {
  if (process.env.NODE_ENV === "test" && !process.env.GOODHAND_DATA_DIR)
    return fn();
  const existing = runtime.transactionContext.getStore();
  if (existing?.active && existing.system === system) return fn();
  const database = getLocalDatabase(system);
  const previous = database.transactionTail;
  let release;
  database.transactionTail = new Promise((resolve) => {
    release = resolve;
  });
  await previous;
  const before = [...database.services].map((service) => ({
    service,
    state: decode(encode(stateOf(service))),
    last: runtime.services.get(service).last,
  }));
  const context = { system, active: true };
  try {
    if (!readOnly) database.connection.exec("BEGIN IMMEDIATE");
    const result = await runtime.transactionContext.run(context, fn);
    if (!readOnly)
      database.connection.exec(
        result instanceof Response && result.status >= 400
          ? "ROLLBACK"
          : "COMMIT",
      );
    if (result instanceof Response && result.status >= 400)
      for (const entry of before) {
        Object.assign(entry.service, entry.state);
        runtime.services.get(entry.service).last = entry.last;
      }
    return result;
  } catch (error) {
    if (!readOnly) database.connection.exec("ROLLBACK");
    for (const entry of before) {
      Object.assign(entry.service, entry.state);
      runtime.services.get(entry.service).last = entry.last;
    }
    throw error;
  } finally {
    context.active = false;
    release();
  }
}

// Local single-process adapter: persist existing domain state without changing OP contracts.
// The later hosted Postgres adapter must replace snapshots with normalized transactions.
export function attachPersistence(service, system, name) {
  if (postgresEnabled(system)) return registerService(service, system, name);
  if (process.env.NODE_ENV === "test" && !process.env.GOODHAND_DATA_DIR)
    return service;
  if (!runtime.services.has(service)) {
    const database = getLocalDatabase(system);
    database.services.add(service);
    const saved = database.readState(name);
    if (saved) Object.assign(service, decode(saved));
    runtime.services.set(service, { database, name, last: saved, depth: 0 });
  }
  const record = runtime.services.get(service);
  for (const method of Object.getOwnPropertyNames(
    Object.getPrototypeOf(service),
  )) {
    const original = Object.getPrototypeOf(service)[method];
    if (method === "constructor" || typeof original !== "function") continue;
    Object.defineProperty(service, method, {
      configurable: true,
      writable: true,
      value: function (...args) {
        record.depth++;
        try {
          const result = original.apply(service, args);
          if (result && typeof result.then === "function")
            return result.then(
              (value) => {
                persistService(service);
                return value;
              },
              (error) => {
                persistService(service);
                throw error;
              },
            );
          return result;
        } finally {
          record.depth--;
          if (record.depth === 0) persistService(service);
        }
      },
    });
  }
  persistService(service);
  return service;
}

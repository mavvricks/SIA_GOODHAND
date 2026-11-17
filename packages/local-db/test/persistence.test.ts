import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  LocalDatabase,
  attachPersistence,
  getLocalDatabase,
} from "../index.mjs";

const folders: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of folders.splice(0)) {
    if (
      !path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep)
    )
      throw new Error("Unsafe test cleanup");
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
function temporary() {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "goodhand-database-"),
  );
  folders.push(directory);
  return directory;
}

describe("Local SQLite persistence", () => {
  it("uses an isolated in-memory database while Next collects build routes", () => {
    const directory = temporary();
    vi.stubEnv("GOODHAND_DATA_DIR", directory);
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    const database = getLocalDatabase("fsm");
    const files = database.connection.prepare("PRAGMA database_list").all();
    expect(files[0].file).toBe("");
    expect(fs.readdirSync(directory)).toEqual([]);
  });
  it("restores domain Maps, nested changes, and counters from the database", async () => {
    vi.stubEnv("GOODHAND_DATA_DIR", temporary());
    class Example {
      records = new Map<string, { status: string }>();
      counter = 0;
      async add() {
        this.records.set("order", { status: "paid" });
        this.counter++;
      }
      get() {
        return this.records.get("order");
      }
      schedule() {
        this.records.get("order")!.status = "Scheduled";
      }
    }
    const first = attachPersistence(new Example(), "store", "test-orders");
    await first.add();
    first.schedule();
    const restored = attachPersistence(new Example(), "store", "test-orders");
    expect(restored.counter).toBe(1);
    expect(restored.records).toBeInstanceOf(Map);
    expect(restored.get()?.status).toBe("Scheduled");
    getLocalDatabase("store").close();
  });
  it("stores data on disk and reads it after closing and reopening the connection", () => {
    const filename = path.join(temporary(), "restart.sqlite");
    const first = new LocalDatabase(filename);
    first.writeState(
      "orders",
      JSON.stringify({ orderNumber: "GH-PERSIST", status: "paid" }),
    );
    first.close();
    const reopened = new LocalDatabase(filename);
    expect(JSON.parse(reopened.readState("orders"))).toEqual({
      orderNumber: "GH-PERSIST",
      status: "paid",
    });
    reopened.close();
  });
  it("requires an active, unexpired session and revokes it on sign-out", () => {
    const database = new LocalDatabase(":memory:");
    database.addUser({
      id: "user-1",
      email: "user@example.com",
      passwordHash: "hashed-value",
      role: "customer",
      fullName: "User",
    });
    database.createSession("session-1", "user-1", Date.now() + 60000);
    expect(database.sessionUser("session-1", "user-1")?.email).toBe(
      "user@example.com",
    );
    database.revokeSession("session-1");
    expect(database.sessionUser("session-1", "user-1")).toBeUndefined();
    database.createSession("expired", "user-1", Date.now() - 1000);
    expect(database.sessionUser("expired", "user-1")).toBeUndefined();
    database.close();
  });
});

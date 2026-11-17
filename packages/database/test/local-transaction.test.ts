import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  attachPersistence,
  getLocalDatabase,
  withLocalTransaction,
} from "../../local-db/index.mjs";

describe("local SQLite request transaction", () => {
  it("rolls back rejected service changes and serializes concurrent writers", async () => {
    const directory = mkdtempSync(
      join(tmpdir(), "goodhand-local-transaction-"),
    );
    const prior = process.env.GOODHAND_DATA_DIR;
    process.env.GOODHAND_DATA_DIR = directory;
    class Counter {
      value = 0;
      increment() {
        this.value++;
      }
    }
    try {
      const counter = attachPersistence(
        new Counter(),
        "store",
        "transaction-probe",
      );
      const rejected = await withLocalTransaction("store", () => {
        counter.increment();
        return Response.json({ error: true }, { status: 409 });
      });
      expect(rejected.status).toBe(409);
      expect(counter.value).toBe(0);
      await Promise.all([
        withLocalTransaction("store", async () => {
          counter.increment();
          await new Promise((resolve) => setTimeout(resolve, 20));
        }),
        withLocalTransaction("store", () => {
          counter.increment();
        }),
      ]);
      expect(counter.value).toBe(2);
      const row = getLocalDatabase("store").readState("transaction-probe");
      expect(JSON.parse(row).value).toBe(2);
      getLocalDatabase("store").close();
    } finally {
      if (prior === undefined) delete process.env.GOODHAND_DATA_DIR;
      else process.env.GOODHAND_DATA_DIR = prior;
      rmSync(directory, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
    }
  });
});

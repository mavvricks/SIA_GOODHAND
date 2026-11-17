import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  query: vi.fn(async (..._args: any[]) => ({ rows: [], rowCount: 0 })),
  release: vi.fn(),
  outsideQuery: vi.fn(),
}));
vi.mock("pg", () => ({
  default: {
    Pool: class {
      on() {}
      connect() {
        return Promise.resolve({ query: mocks.query, release: mocks.release });
      }
      query(...args: any[]) {
        return mocks.outsideQuery(...args);
      }
      end() {
        return Promise.resolve();
      }
    },
  },
}));
import {
  registerService,
  withDatabase,
  databaseRoute,
  queryDatabase,
} from "../postgres.mjs";
beforeEach(() => {
  vi.stubEnv("GOODHAND_POSTGRES_TEST", "true");
  vi.stubEnv("FSM_DATABASE_URL", "postgresql://test:test@localhost/test");
  mocks.query.mockClear();
  mocks.release.mockClear();
  mocks.outsideQuery.mockClear();
});
afterEach(() => vi.unstubAllEnvs());
class Counter {
  counter = 0;
  increment() {
    this.counter++;
  }
}
describe("PostgreSQL request transaction boundaries", () => {
  it("rolls back a rejected HTTP operation without writing partially mutated business data", async () => {
    const service = registerService(new Counter(), "fsm", "probe");
    const route = databaseRoute("fsm", async () => {
      service.increment();
      return Response.json({ error: "rejected" }, { status: 409 });
    });
    expect((await route()).status).toBe(409);
    expect(mocks.query.mock.calls.some(([sql]) => sql === "ROLLBACK")).toBe(
      true,
    );
    expect(
      mocks.query.mock.calls.some(([sql]) => String(sql).startsWith("INSERT")),
    ).toBe(false);
    expect(mocks.release).toHaveBeenCalledOnce();
  });
  it("uses the transaction connection for authentication queries instead of deadlocking the pool", async () => {
    await withDatabase("fsm", () =>
      queryDatabase("fsm", "SELECT authentication", []),
    );
    expect(mocks.query).toHaveBeenCalledWith("SELECT authentication", []);
    expect(mocks.outsideQuery).not.toHaveBeenCalled();
  });
  it("refuses business access outside a live context and does not leak mutation between requests", async () => {
    const service = registerService(new Counter(), "fsm", "isolated");
    expect(() => service.increment()).toThrow("Database context required");
    await expect(
      withDatabase("fsm", () => {
        service.increment();
        throw new Error("failure");
      }),
    ).rejects.toThrow("failure");
    expect(
      await withDatabase("fsm", () => service.counter, { readOnly: true }),
    ).toBe(0);
  });
  it("rolls back thrown failures and always returns the pooled connection", async () => {
    await expect(
      withDatabase("fsm", () => {
        throw new Error("failure");
      }),
    ).rejects.toThrow("failure");
    expect(mocks.query.mock.calls.some(([sql]) => sql === "COMMIT")).toBe(
      false,
    );
    expect(mocks.query.mock.calls.some(([sql]) => sql === "ROLLBACK")).toBe(
      true,
    );
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});

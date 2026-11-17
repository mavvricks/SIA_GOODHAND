import { describe, it, expect } from "vitest";
import { replayOrderedRows } from "../outbox.mjs";

describe("Postgres dead-letter replay ordering", () => {
  it("replays a failed event before subsequent events for the same order", () => {
    const failed = { id: "old", idempotencyKey: "original", status: "failed" };
    const subsequent = {
      id: "next",
      idempotencyKey: "next",
      status: "pending",
    };
    const replay = {
      id: "replay",
      idempotencyKey: "original",
      status: "pending",
    };
    expect(replayOrderedRows([failed, subsequent, replay])).toEqual([
      replay,
      subsequent,
    ]);
    expect(replayOrderedRows([failed, subsequent])).toEqual([
      failed,
      subsequent,
    ]);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchToFsm } from "../lib/outbox/dispatch";
import { simulationService } from "../lib/simulation/simulation-service";

afterEach(() => {
  vi.unstubAllGlobals();
  simulationService.reset();
});
describe("Live Store to FSM transport", () => {
  it("uses the OAuth token endpoint before posting OP-01 with the original idempotency key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "real-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await dispatchToFsm(
        "OP-01",
        { orderNumber: "GH-20300101-000001" },
        "original-key",
        "corr-live",
      ),
    ).toEqual({ status: 201 });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/oauth/token");
    const credentials = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(credentials.get("grant_type")).toBe("client_credentials");
    expect(credentials.get("scope")).toBe("installations:create");
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({
      Authorization: "Bearer real-token",
      "Idempotency-Key": "original-key",
      "X-Correlation-Id": "corr-live",
    });
    expect(fetchMock.mock.calls[1][1].signal).toBeInstanceOf(AbortSignal);
  });
  it("buffers outage failures without making partner requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    simulationService.setFlag("partner_outage_simulated", true);
    expect(await dispatchToFsm("OP-01", {}, "key", "correlation")).toEqual({
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("withholds store feedback and contact fields from the live technician feedback request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await dispatchToFsm(
      "OP-10",
      {
        jobNumber: "JOB-20300101-000001",
        rating: 1,
        technicianTags: ["late"],
        customerFirstName: "Test",
        submittedAt: "2030-01-10T12:00:00Z",
        storeRating: 5,
        customerEmail: "private@example.com",
      },
      "key",
      "corr",
    );
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body).not.toHaveProperty("storeRating");
    expect(body).not.toHaveProperty("customerEmail");
    expect(body.rating).toBe(1);
  });
});

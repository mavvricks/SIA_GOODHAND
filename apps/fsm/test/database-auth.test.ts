import { describe, it, expect } from "vitest";
import { authenticateFsmUser, fsmAccounts } from "../lib/accounts";
import {
  createSessionToken,
  verifySessionToken,
  revokeSessionToken,
} from "../lib/auth";
describe("Database-backed FSM authentication", () => {
  it("requires the correct password and rejects unknown users and the old demo bypass", async () => {
    expect(
      await authenticateFsmUser("unknown@example.com", "TechPassword123!"),
    ).toBeNull();
    expect(await authenticateFsmUser("arnel.mendoza@fsm.local", "")).toBeNull();
    expect(
      await authenticateFsmUser("arnel.mendoza@fsm.local", "demo"),
    ).toBeNull();
    expect(
      await authenticateFsmUser("arnel.mendoza@fsm.local", "wrong"),
    ).toBeNull();
    const user = await authenticateFsmUser(
      "ARNEL.MENDOZA@FSM.LOCAL",
      "TechPassword123!",
    );
    expect(user?.role).toBe("technician");
    expect(
      fsmAccounts().findUser("arnel.mendoza@fsm.local").password_hash,
    ).not.toBe("TechPassword123!");
  });
  it("validates saved sessions and makes copied tokens unusable after sign-out", async () => {
    const user = await authenticateFsmUser(
      "dispatcher1@fsm.local",
      "DispatcherPass123!",
    );
    const token = await createSessionToken(user!);
    expect((await verifySessionToken(token))?.role).toBe("dispatcher");
    await revokeSessionToken(token);
    expect(await verifySessionToken(token)).toBeNull();
  });
});

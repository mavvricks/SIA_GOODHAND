import { describe, it, expect } from "vitest";
import { authenticateStoreUser } from "../lib/accounts";

describe("Database-backed Store accounts", () => {
  it("keeps admin aliases distinct and rejects password-free arbitrary login", async () => {
    const first = await authenticateStoreUser(
      "admin@goodhand88.com",
      "AdminPassword123!",
    );
    const second = await authenticateStoreUser(
      "admin@store.test",
      "AdminPassword123!",
    );
    expect(first?.role).toBe("store_admin");
    expect(second?.role).toBe("store_admin");
    expect(first?.userId).not.toBe(second?.userId);
    expect(
      await authenticateStoreUser("new-customer@example.com", "anything"),
    ).toBeNull();
    expect(await authenticateStoreUser("customer1@example.com", "")).toBeNull();
  });
});

import bcrypt from "bcryptjs";
import { getLocalDatabase } from "../../../packages/local-db/index.mjs";

export function storeAccounts() {
  const database = getLocalDatabase("store");
  const seeds = [
    {
      email: "customer1@example.com",
      fullName: "Juan Dela Cruz",
      role: "customer",
      password: "CustomerPassword123!",
    },
    {
      email: "juan@example.com",
      fullName: "Juan Dela Cruz",
      role: "customer",
      password: "CustomerPassword123!",
    },
    {
      email: "admin@goodhand88.com",
      fullName: "GoodHand Store Admin",
      role: "store_admin",
      password: "AdminPassword123!",
    },
    {
      email: "admin@store.test",
      fullName: "Store Administrator",
      role: "store_admin",
      password: "AdminPassword123!",
    },
  ];
  for (const user of seeds) {
    if (
      !database.connection
        .prepare("SELECT id FROM users WHERE email=?")
        .get(user.email)
    )
      database.addUser({
        id: `usr-${user.role}-${user.email}`,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        passwordHash: bcrypt.hashSync(user.password, 10),
      });
  }
  return database;
}

export async function authenticateStoreUser(email: unknown, password: unknown) {
  if (typeof email !== "string" || typeof password !== "string" || !password)
    return null;
  const row = storeAccounts().findUser(email.trim().toLowerCase());
  if (!row || !(await bcrypt.compare(password, row.password_hash))) return null;
  return {
    userId: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
  };
}

import bcrypt from "bcryptjs";
import { accountDatabase } from "../../../packages/database/accounts.mjs";
import { postgresEnabled } from "../../../packages/database/postgres.mjs";
import { technicians } from "./technicians";

export function fsmAccounts() {
  const database: any = accountDatabase("fsm");
  if (postgresEnabled("fsm")) return database;
  const seeds = [
    {
      email: "dispatcher1@fsm.local",
      fullName: "Chief Dispatcher",
      role: "dispatcher",
      password: "DispatcherPass123!",
    },
    {
      email: "admin@fsm.local",
      fullName: "Operations Administrator",
      role: "admin",
      password: "FsmAdminPass123!",
    },
    ...technicians.map((tech) => ({
      email: tech.email,
      fullName: tech.name,
      role: "technician",
      password: "TechPassword123!",
    })),
  ];
  for (const user of seeds) {
    if (
      !database.connection
        .prepare("SELECT id FROM users WHERE email=?")
        .get(user.email)
    )
      database.addUser({
        id: `usr-${user.role}-${user.email.split("@")[0]}`,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        passwordHash: bcrypt.hashSync(user.password, 10),
      });
  }
  return database;
}

export async function authenticateFsmUser(email: unknown, password: unknown) {
  if (typeof email !== "string" || typeof password !== "string" || !password)
    return null;
  const row = await fsmAccounts().findUser(email.trim().toLowerCase());
  if (!row || !(await bcrypt.compare(password, row.password_hash))) return null;
  return {
    userId: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
  };
}

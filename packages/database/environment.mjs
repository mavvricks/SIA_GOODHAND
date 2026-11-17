import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
export function loadDatabaseEnvironment(
  root = process.cwd(),
  systems = ["store", "fsm"],
) {
  for (const system of systems) {
    const file = path.join(root, "apps", system, ".env.local");
    if (!fs.existsSync(file)) continue;
    for (const [key, value] of Object.entries(
      parseEnv(fs.readFileSync(file, "utf8")),
    ))
      if (!process.env[key]) process.env[key] = value;
  }
  for (const system of systems) {
    const key = `${system.toUpperCase()}_DATABASE_URL`;
    try {
      const url = new URL(process.env[key]);
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !url.password ||
        /\*{3}|PASTE_/.test(url.password)
      )
        throw new Error();
    } catch {
      throw new Error(
        `${key} is missing or is not a complete PostgreSQL URL. Update its .env.local file; do not share the value.`,
      );
    }
  }
}

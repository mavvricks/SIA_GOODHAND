import { getLocalDatabase } from "../packages/local-db/index.mjs";
import { backup } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const action = process.argv[2] || "status";
if (!["init", "status", "backup"].includes(action))
  throw new Error(
    "Usage: node scripts/local-database.mjs [init|status|backup]",
  );
for (const system of ["store", "fsm"]) {
  const database = getLocalDatabase(system);
  if (action === "backup") {
    const directory = path.resolve(
      process.env.GOODHAND_DATA_DIR || ".data",
      "backups",
    );
    fs.mkdirSync(directory, { recursive: true });
    const filename = path.join(
      directory,
      `${system}-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
    );
    await backup(database.connection, filename);
    console.log(`${system}: backup saved to ${filename}`);
  } else {
    const users = database.connection
      .prepare("SELECT count(*) AS count FROM users")
      .get().count;
    const sessions = database.connection
      .prepare("SELECT count(*) AS count FROM sessions WHERE expires_at>?")
      .get(Date.now()).count;
    const states = database.connection
      .prepare("SELECT name,updated_at FROM service_state ORDER BY name")
      .all();
    console.log(
      JSON.stringify(
        { system, users, activeSessions: sessions, savedDomains: states },
        null,
        2,
      ),
    );
  }
}

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadDatabaseEnvironment } from "../packages/database/environment.mjs";
import { poolFor, closePools } from "../packages/database/postgres.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const system = process.argv[2];
if (!(["store", "fsm"].includes(system) && process.argv[3] === "--apply")) {
  console.error(
    "Usage: node scripts/rotate-seed-passwords.mjs store|fsm --apply",
  );
  process.exit(1);
}

const seededEmails = {
  store: [
    "customer1@example.com",
    "juan@example.com",
    "admin@goodhand88.com",
    "admin@store.test",
  ],
  fsm: [
    "dispatcher1@fsm.local",
    "admin@fsm.local",
    "arnel.mendoza@fsm.local",
    "danilo.reyes@fsm.local",
    "crispin.bautista@fsm.local",
    "eduardo.lim@fsm.local",
    "fernando.garcia@fsm.local",
    "gabriel.soriano@fsm.local",
  ],
};
const requireForApp = createRequire(
  path.join(root, "apps", system, "package.json"),
);
const bcrypt = requireForApp("bcryptjs");
const outputDir = path.join(root, ".data");
const outputFile = path.join(outputDir, `rotated-${system}-credentials.json`);
if (fs.existsSync(outputFile)) {
  console.error(
    `Private credentials file already exists: ${outputFile}. Move it securely before rotating again.`,
  );
  process.exit(1);
}

loadDatabaseEnvironment(root, [system]);
const client = await poolFor(system).connect();
let createdFile = false;
try {
  await client.query("BEGIN");
  const { rows } = await client.query(
    "SELECT id,email,role FROM goodhand.users WHERE lower(email)=ANY($1::text[]) AND active=true ORDER BY email",
    [seededEmails[system]],
  );
  if (!rows.length)
    throw new Error("No active seeded accounts found; no passwords changed.");
  const credentials = [];
  for (const row of rows) {
    const password = crypto.randomBytes(32).toString("base64url");
    const hash = await bcrypt.hash(password, 12);
    await client.query(
      "UPDATE goodhand.users SET password_hash=$1 WHERE id=$2",
      [hash, row.id],
    );
    await client.query("DELETE FROM goodhand.sessions WHERE user_id=$1", [
      row.id,
    ]);
    credentials.push({ email: row.email, role: row.role, password });
  }
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    outputFile,
    JSON.stringify({ system, credentials }, null, 2) + "\n",
    {
      flag: "wx",
      mode: 0o600,
    },
  );
  createdFile = true;
  await client.query("COMMIT");
  console.log(
    `${system}: rotated ${credentials.length} seeded accounts and revoked their sessions.`,
  );
  console.log(
    `New passwords saved privately to ${outputFile}. Do not commit or share this file.`,
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  if (createdFile) fs.unlinkSync(outputFile);
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  client.release();
  await closePools();
}

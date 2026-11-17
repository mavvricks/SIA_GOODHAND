import fs from "node:fs";
import crypto from "node:crypto";
import { parseEnv } from "node:util";
const files = ["apps/store/.env.local", "apps/fsm/.env.local"];
const values = files.map((file) => parseEnv(fs.readFileSync(file, "utf8")));
const random = () => crypto.randomBytes(48).toString("hex");
const fsmSessionSecret = values[1].FSM_SESSION_SECRET || random();
const shared = {
  STORE_SERVICE_CLIENT_ID: "store-service",
  STORE_SERVICE_CLIENT_SECRET:
    values[0].STORE_SERVICE_CLIENT_SECRET ||
    values[1].STORE_SERVICE_CLIENT_SECRET ||
    random(),
  STORE_WEBHOOK_SIGNING_SECRET:
    values[0].STORE_WEBHOOK_SIGNING_SECRET ||
    values[1].STORE_WEBHOOK_SIGNING_SECRET ||
    random(),
};
for (const [index, file] of files.entries()) {
  const system = index === 0 ? "STORE" : "FSM";
  const additions = {
    ...shared,
    [system + "_SESSION_SECRET"]:
      system === "FSM" ? fsmSessionSecret : random(),
    ...(system === "STORE" ? { FSM_SESSION_SECRET: fsmSessionSecret } : {}),
    ["CRON_SECRET_" + system]: random(),
    DEMO_MODE: "false",
  };
  let text = fs.readFileSync(file, "utf8");
  for (const [key, value] of Object.entries(additions))
    if (!Object.hasOwn(values[index], key))
      text += "\n" + key + '="' + value + '"';
  fs.writeFileSync(file, text + "\n");
  console.log(
    system + ": local integration/session secrets configured; values hidden.",
  );
}

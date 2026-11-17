import { loadDatabaseEnvironment } from "../packages/database/environment.mjs";
try {
  loadDatabaseEnvironment();
  console.log(
    "Both database URLs are present and correctly formatted. Values hidden.",
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}

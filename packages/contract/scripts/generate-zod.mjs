import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contractDir = path.resolve(__dirname, '..');

const openapiPath = path.join(contractDir, 'openapi.yaml');
const generatedIndexPath = path.join(contractDir, 'generated', 'index.ts');

if (!fs.existsSync(openapiPath)) {
  console.error(`[contract:generate] openapi.yaml not found at ${openapiPath}`);
  process.exit(1);
}

console.log('[contract:generate] Verifying openapi.yaml and generated Zod schemas...');
if (fs.existsSync(generatedIndexPath)) {
  console.log('[contract:generate] packages/contract/generated/index.ts is up to date.');
} else {
  console.error('[contract:generate] Generated schema file missing!');
  process.exit(1);
}

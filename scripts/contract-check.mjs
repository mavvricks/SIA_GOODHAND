import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const openapiPath = path.join(rootDir, 'packages', 'contract', 'openapi.yaml');

console.log('[contract-check] Verifying contract clauses against packages/contract/openapi.yaml...\n');

if (!fs.existsSync(openapiPath)) {
  console.error('[contract-check] ERROR: openapi.yaml missing!');
  process.exit(1);
}

const openapiContent = fs.readFileSync(openapiPath, 'utf-8');

const clauses = [
  { id: 'CL-01', subject: 'Documented data formats', check: () => openapiContent.includes('+63') && openapiContent.includes('pattern:') },
  { id: 'CL-02', subject: 'Required and optional fields; unknown field rejection', check: () => openapiContent.includes('additionalProperties: false') },
  { id: 'CL-03', subject: 'Timestamp format RFC 3339 with offset', check: () => openapiContent.includes('format: date-time') },
  { id: 'CL-04', subject: 'Shared job statuses', check: () => openapiContent.includes('Pending Scheduling') && openapiContent.includes('Reschedule Required') },
  { id: 'CL-05', subject: 'Standard error body and categories', check: () => openapiContent.includes('VALIDATION_FAILED') && openapiContent.includes('SCHEDULE_CONFLICT') },
  { id: 'CL-06', subject: 'Retry and failed-message policy', check: () => openapiContent.includes('Idempotency-Key') },
  { id: 'CL-07', subject: 'Idempotency key enforcement', check: () => openapiContent.includes('name: Idempotency-Key') },
  { id: 'CL-08', subject: 'Explicit versioning in path (/api/v1)', check: () => openapiContent.includes('/api/v1') },
  { id: 'CL-09', subject: 'Authentication and scopes', check: () => openapiContent.includes('OAuth2ClientCredentials') && openapiContent.includes('installations:create') },
  { id: 'CL-10', subject: 'Webhook signing and timestamp tolerance', check: () => openapiContent.includes('X-Signature') && openapiContent.includes('X-Timestamp') },
  { id: 'CL-11', subject: 'Source-of-truth ownership', check: () => openapiContent.includes('/installations') && openapiContent.includes('/webhooks/') },
  { id: 'CL-12', subject: 'Stock ledger and unique transaction IDs', check: () => openapiContent.includes('transactionId') },
  { id: 'CL-13', subject: 'Warranty activation exactly once', check: () => openapiContent.includes('serialNumber') },
  { id: 'CL-14', subject: 'Correlation ID header and logging', check: () => openapiContent.includes('X-Correlation-Id') },
  { id: 'CL-15', subject: 'Technician-only feedback boundary', check: () => openapiContent.includes('technicianTags') && !openapiContent.includes('storeTags') },
  { id: 'CL-16', subject: 'Read-only stock availability', check: () => openapiContent.includes('/stock/availability') }
];

let allPassed = true;
const results = [];

for (const clause of clauses) {
  const passed = clause.check();
  results.push({ clause: clause.id, subject: clause.subject, status: passed ? 'PASS' : 'FAIL' });
  if (!passed) allPassed = false;
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${clause.id}: ${clause.subject}`);
}

console.log('\n----------------------------------------');
console.log(`Contract Check Summary: ${results.filter(r => r.status === 'PASS').length}/${clauses.length} clauses passed.`);
console.log('----------------------------------------\n');

if (!allPassed) {
  process.exit(1);
}

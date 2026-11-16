import { runStoreSeed } from '../apps/store/db/seed.mjs';
import { runFsmSeed } from '../apps/fsm/db/seed.mjs';

console.log('[reset-demo] Starting demo database reset...');

if (process.env.NODE_ENV === 'production' && (!process.env.DEMO_MODE || !process.argv.includes('--force-demo'))) {
  console.error('[reset-demo] ERROR: Cannot reset demo in production without DEMO_MODE=true and --force-demo');
  process.exit(1);
}

try {
  await runStoreSeed();
  await runFsmSeed();
  console.log('[reset-demo] Both databases successfully restored to seed baseline.');
} catch (err) {
  console.error('[reset-demo] Failed to reset demo databases:', err);
  process.exit(1);
}

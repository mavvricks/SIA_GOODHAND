import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

export async function runStoreSeed(poolOrDb) {
  console.log('[store:seed] Seeding store database...');
  // Production safety check
  if (process.env.NODE_ENV === 'production' && (!process.env.DEMO_MODE || !process.argv.includes('--force-demo'))) {
    throw new Error('Refusing to run seed in production without DEMO_MODE=true and --force-demo!');
  }

  const productsPath = path.resolve(__dirname, '..', 'public', '_clone', 'products.json');
  if (!fs.existsSync(productsPath)) {
    throw new Error(`Products catalog not found at ${productsPath}`);
  }

  const catalog = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
  console.log(`[store:seed] Loaded ${catalog.length} catalog products.`);

  // Return seed data structures for execution with Neon Pool
  return {
    admin: {
      email: 'admin@store.test',
      fullName: 'Store Admin',
      role: 'store_admin'
    },
    customers: [
      { email: 'juan@example.com', fullName: 'Juan Dela Cruz', phone: '+639171234567' },
      { email: 'maria@example.com', fullName: 'Maria Santos', phone: '+639189876543' },
      { email: 'robert@example.com', fullName: 'Robert Tan', phone: '+639205551234' }
    ],
    products: catalog,
    feedbacks: [
      { rating: 5, comment: 'Flawless camera installation and very polite technician.', tags: ['on_time', 'clean_work', 'professional'] },
      { rating: 3, comment: 'Technician was late by 30 mins but installed properly.', tags: ['late', 'explained_clearly'] },
      { rating: 1, comment: 'Unprofessional work, wires left hanging.', tags: ['unprofessional', 'messy_work'] }
    ]
  };
}

// Self-executing runner if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('[store:seed] Direct seed invocation verified.');
}

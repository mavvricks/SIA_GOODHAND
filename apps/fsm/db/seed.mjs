import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function runFsmSeed(poolOrDb) {
  console.log('[fsm:seed] Seeding FSM database...');
  if (process.env.NODE_ENV === 'production' && (!process.env.DEMO_MODE || !process.argv.includes('--force-demo'))) {
    throw new Error('Refusing to run seed in production without DEMO_MODE=true and --force-demo!');
  }

  const qualifications = [
    { code: 'CCTV', name: 'Closed-Circuit Television & IP Cameras' },
    { code: 'SMART_LOCK', name: 'Digital & Biometric Smart Door Locks' },
    { code: 'ACCESS_CONTROL', name: 'Commercial Access Control & Turnstiles' },
    { code: 'ALARM', name: 'Intrusion & Burglar Alarm Systems' },
    { code: 'ELECTRIC_FENCE', name: 'Perimeter High Voltage Electric Fence' },
    { code: 'RADIO', name: 'Commercial Two-Way VHF/UHF Radios' }
  ];

  const serviceAreas = [
    { name: 'Metro Manila', cities: ['Manila', 'Makati', 'Taguig', 'Quezon City', 'Pasig', 'Mandaluyong'] },
    { name: 'Cavite', cities: ['Bacoor', 'Imus', 'Dasmariñas', 'General Trias', 'Tagaytay'] },
    { name: 'Laguna', cities: ['Santa Rosa', 'Biñan', 'Calamba', 'Cabuyao', 'San Pedro'] },
    { name: 'Bulacan', cities: ['San Jose del Monte', 'Malolos', 'Meycauayan', 'Marilao'] }
  ];

  const users = [
    { email: 'admin@field.test', fullName: 'FSM Operations Admin', role: 'admin' },
    { email: 'dispatcher1@field.test', fullName: 'Dispatch Supervisor Joy', role: 'dispatcher' },
    { email: 'dispatcher2@field.test', fullName: 'Dispatcher Mark', role: 'dispatcher' },
    { email: 'tech1@field.test', fullName: 'Arnel Mendoza', role: 'technician', code: 'TECH-001' },
    { email: 'tech2@field.test', fullName: 'Danilo Reyes', role: 'technician', code: 'TECH-002' },
    { email: 'tech3@field.test', fullName: 'Crispin Bautista', role: 'technician', code: 'TECH-003' },
    { email: 'tech4@field.test', fullName: 'Eduardo Lim', role: 'technician', code: 'TECH-004' },
    { email: 'tech5@field.test', fullName: 'Fernando Garcia', role: 'technician', code: 'TECH-005' },
    { email: 'tech6@field.test', fullName: 'Gabriel Soriano', role: 'technician', code: 'TECH-006' }
  ];

  return {
    qualifications,
    serviceAreas,
    users
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('[fsm:seed] Direct seed invocation verified.');
}

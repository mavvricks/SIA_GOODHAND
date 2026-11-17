import { NextResponse } from 'next/server';
import { postgresEnabled } from '../../../../../../packages/database/postgres.mjs';
export async function GET() { return process.env.NODE_ENV === 'development' ? NextResponse.json({ isolated: process.env.GOODHAND_E2E_SQLITE === '1' && !postgresEnabled('store'), flag: process.env.GOODHAND_E2E_SQLITE === '1', dataDir: Boolean(process.env.GOODHAND_DATA_DIR), postgres: postgresEnabled('store') }) : NextResponse.json({ error: 'Not found' }, { status: 404 }); }

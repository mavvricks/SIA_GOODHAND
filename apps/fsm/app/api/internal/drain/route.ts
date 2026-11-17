import { NextResponse, type NextRequest } from 'next/server';
import { flushFsmOutbox } from '@/lib/outbox';
export async function POST(req: NextRequest) {
 const secret=process.env.CRON_SECRET_FSM;
 if(!secret || req.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized drain request'},{status:401});
 await flushFsmOutbox();return NextResponse.json({success:true});
}
export const GET=POST;

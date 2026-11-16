import { NextResponse, type NextRequest } from 'next/server';
import { simulationService } from '@/lib/simulation/simulation-service';

export async function POST(req: NextRequest) {
  try {
    const { key, value } = await req.json();
    if (typeof key !== 'string' || typeof value !== 'boolean') {
      return NextResponse.json({ error: 'key (string) and value (boolean) are required' }, { status: 422 });
    }

    simulationService.setFlag(key, value);
    return NextResponse.json({ success: true, flags: simulationService.getAllFlags() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { databaseRoute } from "../../../../../../../packages/database/postgres.mjs";
import { NextResponse, type NextRequest } from 'next/server';
import { stockLedger } from '@/lib/ledger/stock-ledger';
import type { StockAvailabilityResponse } from '@prototype/contract';
import { hasServiceScope } from '@/lib/service-auth';

async function handleGET(req: NextRequest) {
  if (!(await hasServiceScope(req.headers.get('authorization'), 'stock:read'))) return NextResponse.json({ error: { category: 'AUTHENTICATION_REQUIRED', message: 'Valid stock:read service token required.' } }, { status: 401 });
  const url = new URL(req.url);
  const skuQuery = url.searchParams.get('sku');

  const skus = skuQuery ? skuQuery.split(',').map(s => s.trim()).filter(Boolean) : [];

  const items = skus.slice(0, 50).map(sku => {
    const stock = stockLedger.getStock(sku);
    return {
      sku,
      onHand: stock.onHand,
      reserved: stock.reserved,
      available: stock.available,
      asOf: new Date().toISOString()
    };
  });

  const response: StockAvailabilityResponse = {
    items
  };

  return NextResponse.json(response);
}

export const GET = databaseRoute("store", handleGET, { readOnly: true });

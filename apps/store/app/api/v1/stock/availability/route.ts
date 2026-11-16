import { NextResponse, type NextRequest } from 'next/server';
import { stockLedger } from '@/lib/ledger/stock-ledger';
import type { StockAvailabilityResponse } from '@prototype/contract';

export async function GET(req: NextRequest) {
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

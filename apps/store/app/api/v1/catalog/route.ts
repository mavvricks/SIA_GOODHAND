import { NextResponse, type NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import type { CatalogResponse } from '@prototype/contract';

export async function GET(req: NextRequest) {
  try {
    const productsPath = path.join(process.cwd(), 'public', '_clone', 'products.json');
    let rawProducts: any[] = [];
    if (fs.existsSync(productsPath)) {
      rawProducts = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
    }

    const response: CatalogResponse = {
      products: rawProducts.map(p => ({
        sku: p.sku,
        name: p.name,
        category: p.category,
        brand: p.brand,
        pricePhp: p.price_php,
        requiresInstallation: p.requires_installation,
        warrantyMonths: p.warranty_months || 12
      })),
      syncedAt: new Date().toISOString()
    };

    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json(
      { error: { category: 'UNEXPECTED_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}

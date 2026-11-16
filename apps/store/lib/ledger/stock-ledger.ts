import { attachPersistence } from '../../../../packages/local-db/index.mjs';
import crypto from 'node:crypto';

export interface StockItem {
  sku: string;
  name: string;
  onHand: number;
  reserved: number;
  // available = onHand - reserved
}

export interface StockMovement {
  id: string;
  transactionId: string;
  sku: string;
  onHandDelta: number;
  reservedDelta: number;
  reason:
    | 'reservation'
    | 'reservation_release'
    | 'install_use'
    | 'replacement_use'
    | 'direct_sale'
    | 'manual_adjustment';
  orderNumber?: string;
  jobNumber?: string;
  createdAt: string;
}

export class StockLedger {
  private inventory: Map<string, StockItem> = new Map();
  private movements: Map<string, StockMovement> = new Map(); // keyed by transactionId

  constructor() {
    this.seedInventory();
  }

  public seedInventory() {
    // Default 50 units for each SKU
    const skus = [
      'GH-CCTV-001', 'GH-CCTV-002', 'GH-CCTV-003', 'GH-CCTV-004',
      'GH-ALM-001', 'GH-ALM-002', 'GH-ALM-003', 'GH-ALM-004',
      'GH-LCK-001', 'GH-LCK-002', 'GH-LCK-003', 'GH-LCK-004',
      'GH-FNC-001', 'GH-FNC-002', 'GH-FNC-003', 'GH-FNC-004',
      'GH-RAD-001', 'GH-RAD-002', 'GH-RAD-003',
      'GH-NET-001', 'GH-NET-002', 'GH-NET-003',
      'GH-STR-001', 'GH-STR-002'
    ];

    for (const sku of skus) {
      this.inventory.set(sku, {
        sku,
        name: sku,
        onHand: 50,
        reserved: 0
      });
    }
  }

  public setStock(sku: string, onHand: number, reserved: number = 0) {
    if (reserved < 0 || onHand < 0 || reserved > onHand) {
      throw new Error(`Invalid stock state: onHand=${onHand}, reserved=${reserved}`);
    }
    this.inventory.set(sku, {
      sku,
      name: sku,
      onHand,
      reserved
    });
  }

  public getStock(sku: string): { onHand: number; reserved: number; available: number } {
    const item = this.inventory.get(sku);
    if (!item) {
      return { onHand: 0, reserved: 0, available: 0 };
    }
    return {
      onHand: item.onHand,
      reserved: item.reserved,
      available: item.onHand - item.reserved
    };
  }

  public checkAvailability(sku: string, requestedQty: number): boolean {
    const stock = this.getStock(sku);
    return stock.available >= requestedQty;
  }

  // Applies an event-driven stock movement under section 6.9 rules
  public applyMovement(
    transactionId: string,
    sku: string,
    reason: StockMovement['reason'],
    quantity: number,
    orderNumber?: string,
    jobNumber?: string
  ): StockMovement {
    // Invariant 3: Replays with same transactionId change nothing (idempotent)
    const existing = this.movements.get(transactionId);
    if (existing) {
      return existing;
    }

    const item = this.inventory.get(sku);
    if (!item) {
      const err: any = new Error(`SKU ${sku} not found in inventory`);
      err.category = 'NOT_FOUND';
      throw err;
    }

    let onHandDelta = 0;
    let reservedDelta = 0;

    switch (reason) {
      case 'reservation':
        // Paid with installation: reserved increases by quantity
        reservedDelta = +quantity;
        break;

      case 'direct_sale':
        // Paid without installation: physical stock leaves
        onHandDelta = -quantity;
        break;

      case 'reservation_release':
        // Cancelled or unit returned unused: reservation releases
        reservedDelta = -quantity;
        break;

      case 'install_use':
        // Hardware completed: physical stock leaves, reservation cleared
        onHandDelta = -quantity;
        reservedDelta = -quantity;
        break;

      case 'replacement_use':
        // Extra part used on site: physical stock leaves
        onHandDelta = -quantity;
        break;

      case 'manual_adjustment':
        onHandDelta = quantity;
        break;

      default:
        throw new Error(`Unknown stock movement reason: ${reason}`);
    }

    const newOnHand = item.onHand + onHandDelta;
    const newReserved = item.reserved + reservedDelta;

    // Invariant 1: 0 <= reserved <= on_hand
    if (newOnHand < 0 || newReserved < 0 || newReserved > newOnHand) {
      const err: any = new Error(
        `Movement violates stock invariant: target onHand=${newOnHand}, reserved=${newReserved}`
      );
      err.category = 'INSUFFICIENT_STOCK';
      throw err;
    }

    // Apply mutation
    item.onHand = newOnHand;
    item.reserved = newReserved;

    const movement: StockMovement = {
      id: crypto.randomUUID(),
      transactionId,
      sku,
      onHandDelta,
      reservedDelta,
      reason,
      orderNumber,
      jobNumber,
      createdAt: new Date().toISOString()
    };

    this.movements.set(transactionId, movement);
    return movement;
  }

  public getAllStock(): Array<StockItem & { available: number }> {
    return Array.from(this.inventory.values()).map(item => ({
      ...item,
      available: item.onHand - item.reserved
    }));
  }
}

const runtime = globalThis as typeof globalThis & { goodhandStockLedger?: StockLedger };
export const stockLedger = runtime.goodhandStockLedger ??= new StockLedger();

Object.setPrototypeOf(stockLedger, StockLedger.prototype);
attachPersistence(stockLedger, 'store', 'inventory');


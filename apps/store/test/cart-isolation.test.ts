import { describe, expect, it } from "vitest";
import { verifiedCheckoutItems } from "../lib/checkout-items";
import {
  cartStorageKey,
  LEGACY_CART_STORAGE_KEY,
  readCart,
  type CartItem,
} from "../lib/cart-storage";

const camera: CartItem = {
  sku: "GH-CCTV-001",
  name: "Camera",
  category: "CCTV",
  pricePhp: "3850.00",
  quantity: 1,
  requiresInstallation: false,
};
const radio: CartItem = {
  ...camera,
  sku: "GH-RAD-002",
  name: "Radio",
};

describe("Store cart identity isolation", () => {
  it("keeps guest, customer A, and customer B carts separate across login and logout", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
    };
    const guest = cartStorageKey(null);
    const customerA = cartStorageKey("customer-a-id");
    const customerB = cartStorageKey("customer-b-id");
    values.set(guest, JSON.stringify([radio]));
    values.set(customerA, JSON.stringify([camera]));
    values.set(LEGACY_CART_STORAGE_KEY, JSON.stringify([camera, radio]));

    expect(readCart(storage, guest)).toEqual([radio]);
    expect(readCart(storage, customerA)).toEqual([camera]);
    expect(readCart(storage, customerB)).toEqual([]);
    expect(readCart(storage, guest)).toEqual([radio]);
    expect([guest, customerA, customerB]).toEqual([
      "gh_store_cart_v2:guest",
      "gh_store_cart_v2:user:customer-a-id",
      "gh_store_cart_v2:user:customer-b-id",
    ]);
  });

  it("rejects corrupt or malformed saved cart entries", () => {
    const key = cartStorageKey(null);
    const storage = { getItem: () => JSON.stringify([
      { ...camera, quantity: -3 },
      { ...camera, quantity: 1, pricePhp: "Infinity" },
      camera,
    ]) };
    expect(readCart(storage, key)).toEqual([camera]);
    expect(readCart({ getItem: () => "not json" }, key)).toEqual([]);
  });

  it("uses catalog prices and rejects browser-edited prices and duplicate SKUs", () => {
    const catalog = [{ sku: camera.sku, price_php: camera.pricePhp }];
    const item = { sku: camera.sku, quantity: 1, unitPricePhp: camera.pricePhp };
    expect(verifiedCheckoutItems([item], catalog)).toEqual([item]);
    expect(() => verifiedCheckoutItems([{ ...item, unitPricePhp: "1.00" }], catalog))
      .toThrow("price changed");
    expect(() => verifiedCheckoutItems([item, item], catalog))
      .toThrow("duplicate");
  });
});

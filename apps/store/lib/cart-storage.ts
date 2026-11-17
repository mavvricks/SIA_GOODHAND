export interface CartItem {
  sku: string;
  name: string;
  category: string;
  pricePhp: string;
  quantity: number;
  requiresInstallation: boolean;
  imagePath?: string;
}

export const LEGACY_CART_STORAGE_KEY = "gh_store_cart_v1";

export function cartStorageKey(userId: string | null): string {
  return userId
    ? `gh_store_cart_v2:user:${encodeURIComponent(userId)}`
    : "gh_store_cart_v2:guest";
}

export function readCart(
  storage: Pick<Storage, "getItem">,
  key: string,
): CartItem[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(key) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is CartItem => {
      if (!item || typeof item !== "object") return false;
      const entry = item as Record<string, unknown>;
      return (
        typeof entry.sku === "string" &&
        typeof entry.name === "string" &&
        typeof entry.category === "string" &&
        typeof entry.pricePhp === "string" &&
        Number.isFinite(Number(entry.pricePhp)) &&
        Number(entry.pricePhp) >= 0 &&
        typeof entry.quantity === "number" &&
        Number.isInteger(entry.quantity) &&
        entry.quantity >= 1 &&
        entry.quantity <= 99 &&
        typeof entry.requiresInstallation === "boolean" &&
        (entry.imagePath === undefined || typeof entry.imagePath === "string")
      );
    });
  } catch {
    return [];
  }
}

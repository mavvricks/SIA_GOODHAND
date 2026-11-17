interface CatalogPrice {
  sku: string;
  price_php: string;
}

interface CheckoutItem {
  sku: string;
  quantity: number;
  unitPricePhp: string;
}

export function verifiedCheckoutItems(
  submitted: unknown,
  catalog: CatalogPrice[],
): CheckoutItem[] {
  if (!Array.isArray(submitted) || submitted.length < 1 || submitted.length > 99)
    throw new Error("Choose between 1 and 99 catalog items.");
  const prices = new Map(catalog.map((product) => [product.sku, product.price_php]));
  const seen = new Set<string>();
  return submitted.map((item: unknown) => {
    if (!item || typeof item !== "object")
      throw new Error("Invalid cart item.");
    const entry = item as Record<string, unknown>;
    if (
      typeof entry.sku !== "string" ||
      typeof entry.quantity !== "number" ||
      !Number.isInteger(entry.quantity) ||
      entry.quantity < 1 ||
      entry.quantity > 99 ||
      seen.has(entry.sku)
    ) throw new Error("Invalid or duplicate cart item.");
    const catalogPrice = prices.get(entry.sku);
    if (!catalogPrice) throw new Error("A product is no longer available.");
    if (
      typeof entry.unitPricePhp !== "string" ||
      Number(entry.unitPricePhp) !== Number(catalogPrice)
    ) throw new Error("A product price changed. Refresh your cart and try again.");
    seen.add(entry.sku);
    return {
      sku: entry.sku,
      quantity: entry.quantity,
      unitPricePhp: catalogPrice,
    };
  });
}

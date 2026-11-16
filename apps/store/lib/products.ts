import fs from "node:fs";
import path from "node:path";
import type { StoreProduct } from "@/components/ProductCard";

export function getProducts(): StoreProduct[] {
  const productsPath = path.join(
    process.cwd(),
    "public",
    "_clone",
    "products.json",
  );
  return JSON.parse(fs.readFileSync(productsPath, "utf-8"));
}

"use client";

import { useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { categories } from "./StoreHeader";
import { ProductCard, type StoreProduct } from "./ProductCard";
import { findProductSubcategory } from "@/lib/product-navigation";

export function ProductCatalog({
  products,
  initialCategory = "",
  initialQuery = "",
  initialSubcategory = "",
}: {
  products: StoreProduct[];
  initialCategory?: string;
  initialQuery?: string;
  initialSubcategory?: string;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [sort, setSort] = useState("featured");
  const [subcategory, setSubcategory] = useState(initialSubcategory);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasFilters = Boolean(
    query || category || subcategory || brand || price,
  );
  const removeUrlFilters = (keys: string[]) => {
    if (window.location.pathname !== "/products") return;
    const url = new URL(window.location.href);
    keys.forEach((key) => url.searchParams.delete(key));
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  };
  const clearSearch = () => {
    setQuery("");
    removeUrlFilters(["q"]);
    searchInputRef.current?.focus();
  };
  const showAllProducts = () => {
    setCategory("");
    setSubcategory("");
    setQuery("");
    setBrand("");
    setPrice("");
    setSort("featured");
    removeUrlFilters(["q", "category", "subcategory"]);
  };
  const selectedSubcategory = findProductSubcategory(subcategory, category);
  const brands = Array.from(
    new Set(products.map((p) => p.brand).filter(Boolean)),
  ) as string[];
  const filtered = products.filter(
    (p) =>
      (!category || p.category === category) &&
      (!selectedSubcategory || selectedSubcategory.skus.includes(p.sku)) &&
      (!brand || p.brand === brand) &&
      (!price ||
        (price === "under"
          ? Number(p.price_php) < 5000
          : Number(p.price_php) >= 5000)) &&
      `${p.name} ${p.brand} ${p.sku} ${p.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  if (sort !== "featured")
    filtered.sort((a, b) =>
      sort === "low"
        ? Number(a.price_php) - Number(b.price_php)
        : sort === "high"
          ? Number(b.price_php) - Number(a.price_php)
          : a.name.localeCompare(b.name),
    );
  return (
    <div className="gh-catalog">
      <div className="gh-category-pills">
        <button
          className={!category ? "selected" : ""}
          onClick={showAllProducts}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={category === c.id ? "selected" : ""}
            onClick={() => {
              setCategory(c.id);
              setSubcategory("");
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      {selectedSubcategory && (
        <div className="gh-subcategory-filter">
          <span>{selectedSubcategory.label}</span>
          <button
            onClick={() => setSubcategory("")}
            aria-label="Clear subcategory filter"
          >
            ×
          </button>
        </div>
      )}
      <div className="gh-catalog-query">
        <Search size={18} />
        <label className="sr-only" htmlFor="catalog-search">
          Search catalog
        </label>
        <input
          ref={searchInputRef}
          id="catalog-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by model, brand, or keyword."
        />
        {query && (
          <button
            type="button"
            className="gh-clear-search"
            onClick={clearSearch}
            aria-label="Clear search"
            title="Clear search"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <div className="gh-catalog-filters">
        <label>
          <span className="sr-only">Brand</span>
          <select value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Price</span>
          <select value={price} onChange={(e) => setPrice(e.target.value)}>
            <option value="">Any price</option>
            <option value="under">Under ₱5,000</option>
            <option value="over">₱5,000 and above</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Sort products</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="featured">Sort: Featured</option>
            <option value="low">Price: Low to high</option>
            <option value="high">Price: High to low</option>
            <option value="name">Name: A–Z</option>
          </select>
        </label>
      </div>
      <div className="gh-results-toolbar">
        <p className="gh-result-count" aria-live="polite">
          <SlidersHorizontal size={15} />
          {filtered.length} {filtered.length === 1 ? "product" : "products"}
        </p>
        {hasFilters && (
          <button
            type="button"
            className="gh-show-all"
            onClick={showAllProducts}
          >
            Show all products <X size={14} />
          </button>
        )}
      </div>
      {filtered.length ? (
        <div className="gh-product-grid">
          {filtered.map((p) => (
            <ProductCard key={p.sku} product={p} />
          ))}
        </div>
      ) : (
        <div className="gh-empty">
          <h3>
            {selectedSubcategory
              ? `No ${selectedSubcategory.label.toLowerCase()} in the current catalog`
              : "No products found"}
          </h3>
          <p>
            Try another category or clear your filters to see available
            products.
          </p>
          <button className="gh-button" onClick={showAllProducts}>
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

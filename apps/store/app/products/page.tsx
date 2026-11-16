import { StoreHeader } from "@/components/StoreHeader";
import { StoreFooter } from "@/components/StoreFooter";
import { ProductCatalog } from "@/components/ProductCatalog";
import { getProducts } from "@/lib/products";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    subcategory?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <div className="gh-site">
      <StoreHeader />
      <section className="gh-container gh-section gh-products-page">
        <div className="gh-section-heading">
          <span className="gh-eyebrow">The Goodhand store</span>
          <h1>Find your security essentials</h1>
          <p>
            Trusted hardware. Professional installation. Support that stays.
          </p>
        </div>
        <ProductCatalog
          key={`${params.q}-${params.category}-${params.subcategory}`}
          products={getProducts()}
          initialCategory={params.category}
          initialQuery={params.q}
          initialSubcategory={params.subcategory}
        />
      </section>
      <StoreFooter />
    </div>
  );
}

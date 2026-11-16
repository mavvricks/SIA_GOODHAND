"use client";

import React, { useState } from "react";
import { ShoppingCart, Check, Wrench } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { getProductImage } from "@/lib/product-images";

export interface StoreProduct {
  sku: string;
  name: string;
  category: string;
  brand?: string;
  price_php: string;
  requires_installation: boolean;
  image_path?: string;
  description?: string;
}

export function ProductCard({ product }: { product: StoreProduct }) {
  const { addItem } = useCart();
  const [isAdded, setIsAdded] = useState(false);
  const image = getProductImage(product.sku, product.image_path);
  return (
    <article className="gh-product-card">
      <div className="gh-product-image">
        <img
          src={image.src}
          alt={
            image.isIllustration
              ? `AI-generated illustration of ${product.name}`
              : product.name
          }
          loading="lazy"
          width={900}
          height={900}
        />
        <span className="gh-product-brand">
          {product.brand || product.category}
        </span>
        {image.isIllustration && (
          <span
            className="gh-product-illustration"
            title="AI-generated product illustration; actual appearance may vary."
          >
            AI product illustration
          </span>
        )}
      </div>
      <div className="gh-product-body">
        <span className="gh-product-sku">{product.sku}</span>
        <h3>{product.name}</h3>
        <p className="gh-price">
          ₱
          {Number(product.price_php).toLocaleString("en-PH", {
            minimumFractionDigits: 2,
          })}
        </p>
        <p className="gh-product-install">
          <Wrench size={13} />
          {product.requires_installation
            ? "Optional professional installation"
            : "Ready for your security setup"}
        </p>
        <button
          className={`gh-button gh-add ${isAdded ? "is-added" : ""}`}
          onClick={() => {
            addItem(product, 1);
            setIsAdded(true);
            setTimeout(() => setIsAdded(false), 1400);
          }}
        >
          {isAdded ? <Check size={16} /> : <ShoppingCart size={16} />}
          {isAdded ? "Added to cart!" : "Add to Cart"}
        </button>
      </div>
    </article>
  );
}

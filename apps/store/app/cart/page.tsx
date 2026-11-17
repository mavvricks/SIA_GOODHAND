"use client";

import React from "react";
import Link from "next/link";
import {
  ShoppingCart,
  ArrowRight,
  ShieldCheck,
  Trash2,
  ArrowLeft,
  Wrench,
} from "lucide-react";
import { Button } from "@prototype/ui";
import { StoreHeader } from "@/components/StoreHeader";
import { useCart } from "@/lib/cart-context";
import { getProductImage } from "@/lib/product-images";

export default function CartPage() {
  const { items, isReady, updateQuantity, removeItem, clearCart, subtotal, totalCount } =
    useCart();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StoreHeader />

      <main className="max-w-4xl mx-auto px-6 py-10 w-full flex-1">
        <div className="mb-6 border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Your Shopping Cart
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Review selected security equipment before scheduling installation
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Product images are AI-generated illustrations; actual appearance
              may vary.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full font-bold border border-emerald-200 self-start sm:self-auto">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Stock Verified via Ledger
          </div>
        </div>

        {!isReady ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-600" role="status">
            Loading your cart…
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-4">
            <div className="w-16 h-16 bg-blue-50 text-[#0e2378] rounded-full flex items-center justify-center mx-auto">
              <ShoppingCart className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Your cart is currently empty
            </h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Explore our selection of CCTV cameras, smart locks, alarms, and
              perimeter security hardware.
            </p>
            <div className="pt-2">
              <Link href="/">
                <Button
                  variant="primary"
                  size="md"
                  className="bg-[#0e2378] hover:bg-[#193893] text-xs font-bold"
                >
                  Browse Catalog
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 divide-y divide-slate-100">
              {items.map((item) => {
                const itemPrice = parseFloat(item.pricePhp) || 0;
                const itemTotal = itemPrice * item.quantity;

                return (
                  <div
                    key={item.sku}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-5 first:pt-0"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-xl p-2 flex items-center justify-center shrink-0">
                        <img
                          src={getProductImage(item.sku, item.imagePath).src}
                          alt={`Product illustration: ${item.name}`}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-[#0e2378] uppercase tracking-wider">
                          {item.category}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900 line-clamp-1">
                          {item.name}
                        </h3>
                        <span className="font-mono text-xs text-slate-400">
                          SKU: {item.sku}
                        </span>
                        {item.requiresInstallation && (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold mt-0.5">
                            <Wrench className="w-3 h-3" />
                            Optional installation available
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6 self-end sm:self-center shrink-0">
                      {/* Quantity Controls */}
                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.sku, item.quantity - 1)
                          }
                          className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 font-bold text-sm transition-colors"
                        >
                          -
                        </button>
                        <span className="px-3 py-1.5 text-xs font-bold text-slate-900 bg-white min-w-[32px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.sku, item.quantity + 1)
                          }
                          className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 font-bold text-sm transition-colors"
                        >
                          +
                        </button>
                      </div>

                      {/* Line Item Total */}
                      <div className="text-right min-w-[90px]">
                        <span className="text-base font-extrabold text-[#D60000]">
                          ₱
                          {itemTotal.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          ₱
                          {itemPrice.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}{" "}
                          each
                        </span>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeItem(item.sku)}
                        title="Remove item"
                        className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Subtotal & Action Bar */}
            <div className="bg-slate-50 p-6 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    Order Subtotal ({totalCount} units):
                  </span>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-[11px] text-slate-400 hover:text-red-600 underline"
                  >
                    Clear Cart
                  </button>
                </div>
                <div className="text-2xl font-black text-[#0e2378] tracking-tight">
                  ₱
                  {subtotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <span className="text-[11px] text-emerald-700 font-bold block mt-0.5">
                  Standard Metro Manila & Calabarzon Installation Included
                </span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Link href="/" className="hidden sm:inline-flex">
                  <Button
                    variant="secondary"
                    size="md"
                    className="text-xs font-bold flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Continue Shopping
                  </Button>
                </Link>

                <Link href="/checkout" className="flex-1 sm:flex-none">
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full sm:w-auto bg-[#0e2378] hover:bg-[#193893] text-sm font-bold flex items-center justify-center gap-2 shadow-md"
                  >
                    Proceed to Installation Checkout
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { CheckCircle2, ShoppingCart, X } from 'lucide-react';
import { useCart } from '@/lib/cart-context';

export function CartToast() {
  const { toast, dismissToast, totalCount } = useCart();

  if (!toast) return null;

  return (
    <aside aria-label="Notifications" className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 max-w-sm flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Item Added</div>
          <p className="text-sm font-semibold text-slate-100 mt-0.5 truncate">{toast.message}</p>
          <div className="mt-2.5 flex items-center gap-2">
            <Link
              href="/cart"
              onClick={dismissToast}
              className="inline-flex items-center gap-1.5 bg-[#0e2378] hover:bg-[#193893] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border border-blue-400/30"
            >
              <ShoppingCart className="w-3.5 h-3.5 text-[#ffc107]" />
              <span>View Cart ({totalCount})</span>
            </Link>
            <Link
              href="/checkout"
              onClick={dismissToast}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
            >
              <span>Checkout →</span>
            </Link>
          </div>
        </div>
        <button
          onClick={dismissToast}
          className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}

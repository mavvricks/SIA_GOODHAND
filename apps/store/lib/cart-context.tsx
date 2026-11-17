'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './auth-context';
import {
  cartStorageKey,
  LEGACY_CART_STORAGE_KEY,
  readCart,
  type CartItem,
} from './cart-storage';

export type { CartItem } from './cart-storage';

interface CartContextType {
  items: CartItem[];
  isReady: boolean;
  addItem: (product: {
    sku: string;
    name: string;
    category: string;
    price_php: string;
    requires_installation: boolean;
    image_path?: string;
  }, quantity?: number) => void;
  removeItem: (sku: string) => void;
  updateQuantity: (sku: string, quantity: number) => void;
  clearCart: () => void;
  totalCount: number;
  subtotal: number;
  toast: { message: string; sku?: string } | null;
  dismissToast: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const storageKey = isLoading ? null : cartStorageKey(user?.userId ?? null);
  const [cart, setCart] = useState<{ key: string; items: CartItem[] } | null>(null);
  const [toast, setToast] = useState<{ message: string; sku?: string } | null>(null);
  const isReady = storageKey !== null && cart?.key === storageKey;
  const items = isReady && cart ? cart.items : [];

  // Switching identity immediately hides the previous cart. The old shared
  // key is discarded rather than copied into either private scope.
  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.removeItem(LEGACY_CART_STORAGE_KEY); } catch {}
    setCart(previous => previous?.key === storageKey
      ? previous
      : { key: storageKey, items: readCart(localStorage, storageKey) });
    setToast(null);
  }, [storageKey]);

  useEffect(() => {
    if (!cart || !storageKey || cart.key !== storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(cart.items)); } catch {}
  }, [cart, isReady, storageKey]);

  const updateItems = (change: (previous: CartItem[]) => CartItem[]) => {
    if (!storageKey) return;
    setCart(previous => ({
      key: storageKey,
      items: change(previous?.key === storageKey
        ? previous.items
        : readCart(localStorage, storageKey)),
    }));
  };

  const addItem = (product: {
    sku: string;
    name: string;
    category: string;
    price_php: string;
    requires_installation: boolean;
    image_path?: string;
  }, quantity = 1) => {
    updateItems(prev => {
      const existing = prev.find(i => i.sku === product.sku);
      if (existing) {
        return prev.map(i =>
          i.sku === product.sku
            ? { ...i, quantity: Math.min(99, i.quantity + quantity) }
            : i
        );
      }
      return [
        ...prev,
        {
          sku: product.sku,
          name: product.name,
          category: product.category,
          pricePhp: product.price_php,
          quantity: Math.min(99, quantity),
          requiresInstallation: product.requires_installation,
          imagePath: product.image_path
        }
      ];
    });

    setToast({
      message: `Added "${product.name.slice(0, 38)}..." to cart!`,
      sku: product.sku
    });

    // Auto-dismiss toast after 3.5s
    setTimeout(() => {
      setToast(t => (t?.sku === product.sku ? null : t));
    }, 3500);
  };

  const removeItem = (sku: string) => {
    updateItems(prev => prev.filter(i => i.sku !== sku));
  };

  const updateQuantity = (sku: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(sku);
      return;
    }
    updateItems(prev =>
      prev.map(i => (i.sku === sku ? { ...i, quantity: Math.min(99, quantity) } : i))
    );
  };

  const clearCart = () => {
    updateItems(() => []);
  };

  const dismissToast = () => setToast(null);

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = items.reduce((sum, item) => {
    return sum + (parseFloat(item.pricePhp) || 0) * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        isReady,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalCount,
        subtotal,
        toast,
        dismissToast
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

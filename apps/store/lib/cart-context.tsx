'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CartItem {
  sku: string;
  name: string;
  category: string;
  pricePhp: string;
  quantity: number;
  requiresInstallation: boolean;
  imagePath?: string;
}

interface CartContextType {
  items: CartItem[];
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

const CART_STORAGE_KEY = 'gh_store_cart_v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [toast, setToast] = useState<{ message: string; sku?: string } | null>(null);

  // Initialize from localStorage on client
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored));
      } else {
        // Pre-populate with default CCTV item so direct demo of cart works out of the box
        const defaultItem: CartItem = {
          sku: 'GH-CCTV-001',
          name: 'Dahua DH-IPC-HDBW1431E-S4 4MP Entry IR Fixed Dome Camera',
          category: 'CCTV',
          pricePhp: '3850.00',
          quantity: 2,
          requiresInstallation: true,
          imagePath: '/_clone/images/cctv-dahua-dome-4mp.svg'
        };
        setItems([defaultItem]);
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([defaultItem]));
      }
    } catch {
      // Fallback
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Sync to localStorage
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } catch {
        // Ignore storage errors
      }
    }
  }, [items, isHydrated]);

  const addItem = (product: {
    sku: string;
    name: string;
    category: string;
    price_php: string;
    requires_installation: boolean;
    image_path?: string;
  }, quantity = 1) => {
    setItems(prev => {
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
    setItems(prev => prev.filter(i => i.sku !== sku));
  };

  const updateQuantity = (sku: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(sku);
      return;
    }
    setItems(prev =>
      prev.map(i => (i.sku === sku ? { ...i, quantity: Math.min(99, quantity) } : i))
    );
  };

  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch {}
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

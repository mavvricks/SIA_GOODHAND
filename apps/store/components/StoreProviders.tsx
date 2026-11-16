'use client';

import React from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { CartProvider } from '@/lib/cart-context';
import { CartToast } from './CartToast';

export function StoreProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        {children}
        <CartToast />
      </CartProvider>
    </AuthProvider>
  );
}

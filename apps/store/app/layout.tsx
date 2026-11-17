import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { StoreProviders } from '@/components/StoreProviders';

export const metadata: Metadata = {
  title: 'GoodHand Security Products Store',
  description: 'Security hardware and professional installation service.',
  icons: {
    icon: '/brand/goodhand-logo.png',
    shortcut: '/brand/goodhand-logo.png',
  },
  robots: {
    index: false,
    follow: false
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <StoreProviders>
          <main className="flex-1">{children}</main>
        </StoreProviders>
      </body>
    </html>
  );
}

import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import { FsmHeader } from "@/components/FsmHeader";

export const metadata: Metadata = {
  title: "GoodHand Field Service Management - Dispatch Console",
  description:
    "Technician dispatch, loading verification, and field job completion.",
  icons: {
    icon: "/brand/goodhand-camera.svg",
    shortcut: "/brand/goodhand-camera.svg",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col md:flex-row">
        <FsmHeader />
        <main className="min-w-0 flex-1">{children}</main>
      </body>
    </html>
  );
}

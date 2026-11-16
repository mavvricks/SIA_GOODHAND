import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import { FsmHeader } from "@/components/FsmHeader";

export const metadata: Metadata = {
  title: "GoodHand Field Service Management - Dispatch Console",
  description:
    "Technician dispatch, loading verification, and field job completion.",
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
      <body className="flex flex-col min-h-screen">
        <FsmHeader />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}

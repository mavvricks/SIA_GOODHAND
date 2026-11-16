import { canViewOrder } from "@/lib/order-access";
import { OrderTracking } from "@/components/OrderTracking";
import { OrderRefresh } from "@/components/OrderRefresh";
import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ordersService } from "@/lib/services/orders-service";
import { verifySessionToken } from "@/lib/auth";
import { getProducts } from "@/lib/products";
import { StatusChip } from "@prototype/ui";
import { ShieldCheck, Wrench, ArrowRight, Package } from "lucide-react";
import type { JobStatus } from "@prototype/contract";
import { FeedbackForm } from "@/components/FeedbackForm";
import { StoreHeader } from "@/components/StoreHeader";

export const dynamic = "force-dynamic";
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const order = ordersService.getOrder(orderNumber);
  if (!order) notFound();
  const installation = order.includeInstallation !== false;
  const sessionToken = (await cookies()).get("store_session")?.value;
  const user = sessionToken ? await verifySessionToken(sessionToken) : null;
  if (!canViewOrder(user, order)) notFound();
  const catalog = getProducts();
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StoreHeader />
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6 w-full flex-1">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase font-bold text-slate-500">
              {order.status === "pending_payment"
                ? "Payment pending"
                : "Order Confirmed"}
            </span>
            <h1 className="text-2xl font-extrabold text-[#0e2378] font-mono break-all">
              {orderNumber}
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              {order.status === "pending_payment"
                ? "Your order is awaiting payment."
                : installation
                  ? "Thank you for your purchase. Your professional installation request has been received."
                  : order.delivery?.status === "Delivered"
                    ? "Your hardware order has been delivered."
                    : "Thank you for your purchase. Your hardware delivery order is processing."}
            </p>
          </div>
          <div className="shrink-0">
            {order.status === "pending_payment" ? (
              <span className="text-xs font-semibold text-amber-800">
                Awaiting payment
              </span>
            ) : installation && order.installationStatus ? (
              <StatusChip status={order.installationStatus as JobStatus} />
            ) : (
              <span className="bg-blue-50 text-blue-900 text-xs px-3 py-1 rounded-full font-semibold">
                Hardware Only — No Installation Required
              </span>
            )}
          </div>
        </div>
        <OrderRefresh />
        <OrderTracking orderNumber={orderNumber} />
        {installation ? (
          <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b pb-3">
              <Wrench className="w-5 h-5 text-[#0e2378]" />
              Field Service Installation Progress
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">
                  Assigned Technician
                </span>
                <p className="font-bold text-sm text-slate-900">
                  {order.technicianName || "Pending Dispatcher Assignment"}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">
                  Scheduled Window
                </span>
                <p className="font-bold text-sm text-slate-900">
                  {order.scheduledStart
                    ? `${new Date(order.scheduledStart).toLocaleString("en-PH")} – ${new Date(order.scheduledEnd!).toLocaleString("en-PH")}`
                    : "Pending Scheduling"}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">
                  Hardware Warranty
                </span>
                <p className="font-bold text-sm text-emerald-700 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" />
                  {order.installationStatus === "Completed"
                    ? "12 Months Active"
                    : "Activates after installation"}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-blue-50 p-6 rounded-xl border border-blue-200 space-y-2">
            <h2 className="font-bold text-blue-950 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Self-Installation / Hardware Only
            </h2>
            <p className="text-sm text-blue-900">
              Hardware Delivery Only (Self-Installation). No technician or
              installation schedule is required for this order.
            </p>
          </section>
        )}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b pb-3">
            Ordered Equipment
          </h2>
          <div className="divide-y divide-slate-100 text-sm">
            {order.items.map((item) => (
              <div
                key={item.sku}
                className="py-3 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <span className="font-semibold text-slate-800">
                    {catalog.find((product) => product.sku === item.sku)
                      ?.name || item.sku}
                  </span>
                  <span className="block text-xs text-slate-500">
                    SKU: {item.sku} · Quantity: {item.quantity}
                  </span>
                </div>
                <span className="font-bold text-[#D60000]">
                  ₱
                  {(Number(item.unitPricePhp) * item.quantity).toLocaleString(
                    "en-PH",
                    { minimumFractionDigits: 2 },
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
        {installation && (
          <FeedbackForm
            orderNumber={orderNumber}
            technicianName={order.technicianName}
            isCompleted={
              order.installationStatus === "Completed" ||
              order.status === "fulfilled"
            }
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <Link
            href="/"
            className="text-xs font-semibold text-[#0e2378] hover:underline"
          >
            ← Return to Store Home
          </Link>
          {installation && user?.role === "store_admin" && (
            <Link
              href={
                new URL(
                  process.env.STORE_FSM_BASE_URL ||
                    "http://localhost:3100/api/v1",
                ).origin
              }
              className="text-xs font-bold text-indigo-700 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-200 flex items-center gap-1.5"
            >
              View in FSM Dispatcher Console (System B)
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}

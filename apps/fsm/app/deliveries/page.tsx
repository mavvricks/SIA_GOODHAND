"use client";
import { useEffect, useState } from "react";
const statuses = [
  "Order received",
  "Packing order",
  "Ready for dispatch",
  "On the way",
  "Delivered",
];
function DeliveryCard({
  order,
  onSaved,
}: {
  order: any;
  onSaved: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const current = statuses.indexOf(order.delivery?.status || "Order received");
  const local = (value: string) => {
    const d = new Date(value);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  return (
    <article className="rounded-xl border bg-white p-5 space-y-3">
      <h2 className="font-bold">
        {order.orderNumber} · {order.customerName}
      </h2>
      <p>
        {order.address.city}, {order.address.province} ·{" "}
        {order.includeInstallation
          ? "With installation"
          : "Hardware delivery only"}
      </p>
      <p className="font-semibold">
        {order.delivery?.status || "Order received"}
      </p>
      <form
        key={order.deliveryVersion || 0}
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setMessage("");
          try {
            const eta = String(form.get("eta") || "");
            const res = await fetch("/api/v1/deliveries", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderNumber: order.orderNumber,
                status: form.get("status"),
                estimatedArrival: eta ? new Date(eta).toISOString() : undefined,
                note: form.get("note"),
                version: order.deliveryVersion || 0,
              }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error?.message);
            setMessage("Saved. Customer tracking has been updated.");
            await onSaved();
          } catch (e: any) {
            setMessage(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block text-sm">
          Delivery status
          <select
            name="status"
            defaultValue={order.delivery?.status || "Order received"}
            className="block w-full border rounded p-2"
          >
            {statuses.map((s, i) => (
              <option key={s} disabled={i < current || i > current + 1}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Estimated arrival (local time)
          <input
            name="eta"
            type="datetime-local"
            defaultValue={
              order.delivery?.estimatedArrival
                ? local(order.delivery.estimatedArrival)
                : ""
            }
            className="block w-full border rounded p-2"
          />
        </label>
        <label className="block text-sm">
          Customer-visible update
          <textarea
            name="note"
            maxLength={500}
            placeholder="e.g. Your parcel has left our branch."
            className="block w-full border rounded p-2"
          />
        </label>
        <button
          disabled={
            busy ||
            order.status === "pending_payment" ||
            order.status === "cancelled"
          }
          className="rounded bg-indigo-700 text-white px-4 py-2 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Update customer tracking"}
        </button>
      </form>
      <p role="status">{message}</p>
      <details>
        <summary className="cursor-pointer text-sm">Update history</summary>
        {order.deliveryHistory?.map((event: any, i: number) => (
          <p key={i} className="text-sm mt-2">
            {event.status} · {event.actor} ·{" "}
            {new Date(event.at).toLocaleString("en-PH")}
            <br />
            {event.note}
          </p>
        ))}
      </details>
    </article>
  );
}
export default function DeliveriesPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const load = async () => {
    try {
      const res = await fetch("/api/v1/deliveries", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message);
      setOrders(data.orders);
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <main className="max-w-7xl mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-bold">Order deliveries</h1>
      <p>
        Update packing, dispatch, delivery and estimated arrival for all Store
        orders. Delivery status is separate from installation progress.
      </p>
      <button onClick={() => void load()} className="text-indigo-700 underline">
        Refresh orders
      </button>
      {error && (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      )}
      <input
        aria-label="Search deliveries"
        placeholder="Search order number or customer"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full border rounded p-3"
      />
      <div className="grid md:grid-cols-2 gap-4">
        {orders
          .filter((o) =>
            (o.orderNumber + " " + o.customerName)
              .toLowerCase()
              .includes(filter.toLowerCase()),
          )
          .map((o) => (
            <DeliveryCard key={o.orderNumber} order={o} onSaved={load} />
          ))}
      </div>
    </main>
  );
}

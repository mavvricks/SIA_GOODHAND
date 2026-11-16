"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export function OrderTracking({ orderNumber }: { orderNumber?: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/orders", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message);
        if (active) {
          setOrders(data.orders);
          setError("");
        }
      } catch (e: any) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoaded(true);
      }
    };
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const visible = orders.filter(
    (o) => !orderNumber || o.orderNumber === orderNumber,
  );
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">
        {orderNumber ? "Live delivery tracking" : "My orders"}
      </h2>
      <p className="text-sm text-slate-500">
        Updates every 5 seconds. Estimated arrival is set by the dispatch team.
      </p>
      {error && (
        <p role="alert" className="text-red-800">
          {error}{" "}
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </p>
      )}
      {!loaded && <p>Loading orders…</p>}
      {loaded && !error && !visible.length && (
        <p>No orders found for this account.</p>
      )}
      {visible.map((o) => (
        <article
          key={o.orderNumber}
          className="bg-white rounded-xl border p-5 space-y-3"
        >
          <Link
            href={"/orders/" + o.orderNumber}
            className="font-bold text-indigo-800"
          >
            {o.orderNumber}
          </Link>
          <p className="font-semibold">
            {o.status === "pending_payment"
              ? "Awaiting payment"
              : o.delivery?.status || "Order received"}
          </p>
          <p>
            Estimated arrival:{" "}
            {o.delivery?.estimatedArrival
              ? new Date(o.delivery.estimatedArrival).toLocaleString("en-PH")
              : "Not yet confirmed"}
          </p>
          <p>
            {o.includeInstallation
              ? "Installation: " +
                (o.installationStatus || "Pending Scheduling")
              : "Self-Installation / Hardware Only"}
          </p>
          {o.technicianName && <p>Technician: {o.technicianName}</p>}
          {o.scheduledStart && (
            <p>
              Installation: {new Date(o.scheduledStart).toLocaleString("en-PH")}{" "}
              – {new Date(o.scheduledEnd).toLocaleString("en-PH")}
            </p>
          )}
          <ol className="space-y-2 border-l-2 border-yellow-400 pl-4">
            <li className="text-sm">
              Order placed · {new Date(o.createdAt).toLocaleString("en-PH")}
            </li>
            {o.deliveryHistory?.map((event: any, i: number) => (
              <li key={i} className="text-sm">
                <strong>{event.status}</strong> ·{" "}
                {new Date(event.at).toLocaleString("en-PH")}
                {event.note && <p>{event.note}</p>}
              </li>
            ))}
          </ol>
        </article>
      ))}
    </section>
  );
}
